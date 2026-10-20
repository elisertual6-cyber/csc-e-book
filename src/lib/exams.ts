import "server-only";
import { paymentAllowedInRuntime } from "@/lib/payment-policy";
import { z } from "zod";
import { randomInt, randomUUID } from "node:crypto";
import type { Prisma, ExamAccess } from "@prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import {
  audit,
  independentlyApproved,
  slug,
  type Actor,
} from "@/lib/editorial";
import { digest, staffRoles } from "@/lib/security";
import { grade, snapshotSchema, examMetadataSchema } from "@/lib/grading";
import type {
  AttemptView,
  AttemptSummary,
  TopicResult,
} from "@/lib/exam-types";
type Tx = Prisma.TransactionClient;
export const templateInput = z
  .object({
    slug,
    title: z.string().trim().min(5).max(160),
    level: z.enum(["PROFESSIONAL", "SUBPROFESSIONAL"]),
    mode: z.enum(["PRACTICE", "MOCK"]),
    access: z.enum(["FREE", "PREMIUM"]),
    topics: z
      .array(slug)
      .max(25)
      .refine((a) => new Set(a).size === a.length),
    questionCount: z.number().int().min(1).max(200),
    durationSeconds: z.number().int().min(0).max(14400),
  })
  .strict()
  .refine(
    (t) =>
      t.durationSeconds >= 60 ||
      (t.mode === "PRACTICE" && t.durationSeconds === 0),
    "Mock sessions require a timer; practice can be untimed.",
  );
export const startInput = z
  .object({
    templateId: z.string().min(1).max(100),
    startKey: z.uuid(),
    topic: slug.optional(),
    questionCount: z.number().int().min(1).max(200).optional(),
  })
  .strict();
export const saveInput = z
  .object({
    revision: z.number().int().nonnegative(),
    responses: z
      .array(
        z
          .object({
            questionKey: z.string().min(1).max(100),
            choiceLabel: z.enum(["A", "B", "C", "D"]).nullable(),
            flagged: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict()
  .refine(
    (d) =>
      new Set(d.responses.map((r) => r.questionKey)).size ===
      d.responses.length,
    "Duplicate responses.",
  );
async function now(tx: Tx) {
  const [row] = await tx.$queryRaw<
    { now: Date }[]
  >`SELECT clock_timestamp() AS now`;
  return row.now;
}
export async function hasExamAccess(
  tx: Tx,
  actor: Actor,
  access: ExamAccess,
  time: Date,
) {
  if (access === "FREE" || staffRoles.includes(actor.role)) return true;
  const entitlements = await tx.entitlement.findMany({
    where: {
      userId: actor.id,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: time } }],
      product: { grantsExams: true },
      order: { status: "PAID" },
    },
    include: {
      order: {
        include: {
          items: { include: { price: true } },
          payments: {
            where: { status: "VERIFIED", verifiedAt: { not: null } },
          },
        },
      },
    },
  });
  return entitlements.some(
    (e) =>
      e.order.userId === actor.id &&
      e.order.items.some((i) => i.productId === e.productId) &&
      e.order.items.every(
        (i) =>
          i.quantity > 0 &&
          i.unitPriceMinor >= 0 &&
          i.price.productId === i.productId &&
          i.price.currency === e.order.currency,
      ) &&
      e.order.items.reduce(
        (sum, i) => sum + i.unitPriceMinor * i.quantity,
        0,
      ) === e.order.totalMinor &&
      e.order.payments.some(
        (p) =>
          p.amountMinor === e.order.totalMinor &&
          p.currency === e.order.currency &&
          paymentAllowedInRuntime(p.provider),
      ),
  );
}
async function bank(
  tx: Tx,
  template: { level: string; topics: string[] },
  topic?: string,
) {
  const questions = await tx.question.findMany({
    where: {
      status: "PUBLISHED",
      level: {
        in: ["COMMON", template.level as "PROFESSIONAL" | "SUBPROFESSIONAL"],
      },
      ...(topic
        ? { topic }
        : template.topics.length
          ? { topic: { in: template.topics } }
          : {}),
    },
    include: { choices: true, explanation: true, reviews: true },
    orderBy: { version: "desc" },
    take: 10000,
  });
  const keys = new Set<string>();
  return questions.filter((q) => {
    if (
      keys.has(q.key) ||
      !independentlyApproved(q) ||
      q.choices.length !== 4 ||
      q.choices.filter((c) => c.isCorrect).length !== 1 ||
      !q.explanation?.rationale
    )
      return false;
    keys.add(q.key);
    return true;
  });
}
async function lockAttempt(tx: Tx, userId: string, id: string) {
  const found = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM "Attempt" WHERE id=${id} AND "userId"=${userId} FOR UPDATE`;
  if (!found.length) throw new HttpError(404, "Attempt not found.");
  return tx.attempt.findUniqueOrThrow({
    where: { id },
    include: { responses: true },
  });
}
type StoredAttempt = Awaited<ReturnType<typeof lockAttempt>>;
function readSnapshot(attempt: StoredAttempt) {
  const snapshot = snapshotSchema.safeParse(attempt.questionSnapshot),
    metadata = examMetadataSchema.safeParse(attempt.templateSnapshot);
  if (
    !snapshot.success ||
    !metadata.success ||
    snapshot.data.questions.length !== attempt.totalQuestions
  )
    throw new HttpError(
      409,
      "This attempt needs operator review; its version snapshot is unavailable.",
    );
  return { snapshot: snapshot.data, metadata: metadata.data };
}
async function finalize(
  tx: Tx,
  actor: Actor,
  attempt: StoredAttempt,
  time: Date,
  submit = false,
) {
  if (attempt.status !== "IN_PROGRESS") return attempt;
  const expired = !!attempt.deadlineAt && time >= attempt.deadlineAt;
  if (!submit && !expired) return attempt;
  const { snapshot } = readSnapshot(attempt);
  const result = grade(snapshot, attempt.responses);
  const updated = await tx.attempt.update({
    where: { id: attempt.id },
    data: {
      status: expired ? "EXPIRED" : "SUBMITTED",
      submittedAt: time,
      score: result.correct,
      revision: { increment: 1 },
    },
    include: { responses: true },
  });
  await audit(tx, actor, expired ? "exam.expire" : "exam.submit", attempt.id, {
    score: result.correct,
    total: result.total,
  });
  return updated;
}
function view(attempt: StoredAttempt, time: Date): AttemptView {
  const { snapshot, metadata } = readSnapshot(attempt);
  return {
    id: attempt.id,
    title: metadata.title,
    level: metadata.level,
    mode: metadata.mode,
    access: metadata.access,
    status: attempt.status,
    startedAt: attempt.startedAt.toISOString(),
    deadlineAt: attempt.deadlineAt?.toISOString() ?? null,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    serverNow: time.toISOString(),
    revision: attempt.revision,
    totalQuestions: attempt.totalQuestions,
    score: attempt.status === "IN_PROGRESS" ? null : attempt.score,
    questions: snapshot.questions.map((q) => ({
      questionKey: q.questionKey,
      prompt: q.prompt,
      topic: q.topic,
      choices: q.choices.map((c) => ({ label: c.label, text: c.text })),
    })),
    responses: attempt.responses.map((r) => ({
      questionKey: r.questionKey,
      choiceLabel: r.choiceLabel,
      flagged: r.flagged,
    })),
    result:
      attempt.status === "IN_PROGRESS"
        ? null
        : grade(snapshot, attempt.responses),
  };
}
async function authorize(
  tx: Tx,
  actor: Actor,
  attempt: StoredAttempt,
  time: Date,
) {
  if (
    !(await hasExamAccess(
      tx,
      actor,
      readSnapshot(attempt).metadata.access,
      time,
    ))
  )
    throw new HttpError(
      403,
      "Active purchased exam access is required for this attempt.",
    );
}
export async function templatesFor(actor: Actor) {
  return getDb().$transaction(async (tx) => {
    const time = await now(tx),
      premium = await hasExamAccess(tx, actor, "PREMIUM", time);
    const templates = await tx.examTemplate.findMany({
      where: { active: true },
      orderBy: { title: "asc" },
      take: 100,
    });
    return templates.map((t) => ({
      id: t.id,
      title: t.title,
      level: t.level,
      mode: t.mode,
      access: t.access,
      topics: t.topics,
      questionCount: t.questionCount,
      durationSeconds: t.durationSeconds,
      version: t.version,
      canStart: t.access === "FREE" || premium,
    }));
  });
}
export async function startAttempt(actor: Actor, input: unknown) {
  const data = startInput.parse(input);
  const requestHash = digest(
    JSON.stringify({
      templateId: data.templateId,
      topic: data.topic ?? null,
      questionCount: data.questionCount ?? null,
    }),
  );
  return getDb().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${actor.id},48293))`;
      const time = await now(tx);
      const previous = await tx.attempt.findUnique({
        where: {
          userId_startKey: { userId: actor.id, startKey: data.startKey },
        },
        include: { responses: true },
      });
      if (previous) {
        if (
          (previous.templateSnapshot as { requestHash?: string } | null)
            ?.requestHash !== requestHash
        )
          throw new HttpError(
            409,
            "This start key already belongs to a different request.",
          );
        const locked = await lockAttempt(tx, actor.id, previous.id);
        const replayTime = await now(tx);
        await authorize(tx, actor, locked, replayTime);
        return view(await finalize(tx, actor, locked, replayTime), replayTime);
      }
      await tx.$queryRaw`SELECT id FROM "ExamTemplate" WHERE id=${data.templateId} FOR SHARE`;
      const template = await tx.examTemplate.findUnique({
        where: { id: data.templateId },
      });
      if (!template?.active)
        throw new HttpError(404, "This exam template is not available.");
      if (!(await hasExamAccess(tx, actor, template.access, time)))
        throw new HttpError(
          403,
          "Active purchased exam access is required. Checkout is not available yet.",
        );
      if (
        template.mode === "MOCK" &&
        (data.topic !== undefined || data.questionCount !== undefined)
      )
        throw new HttpError(
          400,
          "Mock counts and topics are set by the exam template.",
        );
      if (
        data.topic &&
        template.topics.length &&
        !template.topics.includes(data.topic)
      )
        throw new HttpError(400, "Choose a topic from this template.");
      const count = data.questionCount ?? template.questionCount;
      if (count > template.questionCount)
        throw new HttpError(
          400,
          "The question count exceeds this template's limit.",
        );
      const expired = await tx.attempt.findMany({
        where: {
          userId: actor.id,
          status: "IN_PROGRESS",
          deadlineAt: { lte: time },
        },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      for (const row of expired)
        await finalize(
          tx,
          actor,
          await lockAttempt(tx, actor.id, row.id),
          time,
        );
      if (
        (await tx.attempt.count({
          where: { userId: actor.id, status: "IN_PROGRESS" },
        })) >= 3
      )
        throw new HttpError(
          409,
          "Submit an existing attempt before starting another (maximum three active sessions).",
        );
      const candidates = await bank(tx, template, data.topic);
      if (candidates.length < count)
        throw new HttpError(
          409,
          "There are not enough independently reviewed published questions for this selection.",
        );
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
      }
      const snapshot = snapshotSchema.parse({
        schemaVersion: 1,
        questions: candidates.slice(0, count).map((q) => ({
          questionKey: randomUUID(),
          sourceId: q.id,
          sourceVersion: q.version,
          prompt: q.prompt,
          topic: q.topic,
          choices: [...q.choices]
            .sort((a, b) => a.label.localeCompare(b.label))
            .map((c) => ({
              label: c.label,
              text: c.text,
              isCorrect: c.isCorrect,
            })),
          explanation: q.explanation!.rationale,
          sourceNotes: q.sourceNotes,
        })),
      });
      const metadata = {
        title: template.title,
        level: template.level,
        mode: template.mode,
        access: template.access,
        templateVersion: template.version,
        durationSeconds: template.durationSeconds,
        requestHash,
      };
      const attempt = await tx.attempt.create({
        data: {
          userId: actor.id,
          templateId: template.id,
          startKey: data.startKey,
          startedAt: time,
          deadlineAt: template.durationSeconds
            ? new Date(time.getTime() + template.durationSeconds * 1000)
            : null,
          totalQuestions: count,
          questionSnapshot: snapshot as Prisma.InputJsonValue,
          templateSnapshot: metadata as Prisma.InputJsonValue,
        },
        include: { responses: true },
      });
      await audit(tx, actor, "exam.start", attempt.id, {
        templateId: template.id,
        version: template.version,
        count,
      });
      return view(attempt, time);
    },
    { timeout: 20000 },
  );
}
export async function getAttempt(actor: Actor, id: string) {
  return getDb().$transaction(
    async (tx) => {
      let attempt = await lockAttempt(tx, actor.id, id);
      const time = await now(tx);
      await authorize(tx, actor, attempt, time);
      attempt = await finalize(tx, actor, attempt, time);
      return view(attempt, time);
    },
    { timeout: 15000 },
  );
}
export async function saveResponses(actor: Actor, id: string, input: unknown) {
  const data = saveInput.parse(input);
  return getDb().$transaction(
    async (tx) => {
      let attempt = await lockAttempt(tx, actor.id, id);
      const time = await now(tx);
      await authorize(tx, actor, attempt, time);
      if (attempt.status !== "IN_PROGRESS")
        throw new HttpError(409, "This attempt has already been graded.");
      if (attempt.deadlineAt && time >= attempt.deadlineAt)
        return view(await finalize(tx, actor, attempt, time), time);
      if (attempt.revision !== data.revision)
        throw new HttpError(
          409,
          "Progress changed in another tab. Reload before saving.",
        );
      const { snapshot } = readSnapshot(attempt);
      for (const response of data.responses) {
        const question = snapshot.questions.find(
          (q) => q.questionKey === response.questionKey,
        );
        if (
          !question ||
          (response.choiceLabel !== null &&
            !question.choices.some((c) => c.label === response.choiceLabel))
        )
          throw new HttpError(
            400,
            "A response does not belong to this attempt.",
          );
      }
      for (const response of data.responses)
        await tx.response.upsert({
          where: {
            attemptId_questionKey: {
              attemptId: id,
              questionKey: response.questionKey,
            },
          },
          create: { attemptId: id, ...response },
          update: {
            choiceLabel: response.choiceLabel,
            flagged: response.flagged,
          },
        });
      attempt = await tx.attempt.update({
        where: { id },
        data: { revision: { increment: 1 } },
        include: { responses: true },
      });
      return view(attempt, time);
    },
    { timeout: 15000 },
  );
}
export async function submitAttempt(actor: Actor, id: string) {
  return getDb().$transaction(
    async (tx) => {
      const attempt = await lockAttempt(tx, actor.id, id),
        time = await now(tx);
      await authorize(tx, actor, attempt, time);
      return view(await finalize(tx, actor, attempt, time, true), time);
    },
    { timeout: 15000 },
  );
}
export async function attemptHistory(actor: Actor) {
  return getDb().$transaction(
    async (tx) => {
      const time = await now(tx);
      const expired = await tx.attempt.findMany({
        where: {
          userId: actor.id,
          status: "IN_PROGRESS",
          deadlineAt: { lte: time },
        },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      for (const row of expired)
        await finalize(
          tx,
          actor,
          await lockAttempt(tx, actor.id, row.id),
          time,
        );
      const premium = await hasExamAccess(tx, actor, "PREMIUM", time);
      const active = await tx.attempt.findMany({
        where: { userId: actor.id, status: "IN_PROGRESS" },
        include: { responses: true },
        orderBy: { startedAt: "desc" },
      });
      const completed = await tx.attempt.findMany({
        where: { userId: actor.id, status: { not: "IN_PROGRESS" } },
        include: { responses: true },
        orderBy: { submittedAt: "desc" },
        take: 50,
      });
      const topics = new Map<string, TopicResult>();
      let totalPercent = 0;
      const attempts: AttemptSummary[] = [...active, ...completed].map((a) => {
        const { metadata, snapshot } = readSnapshot(a);
        const result =
          a.status !== "IN_PROGRESS" ? grade(snapshot, a.responses) : null;
        if (result) {
          totalPercent += result.percent;
          for (const row of result.byTopic) {
            const previous = topics.get(row.topic) ?? {
              topic: row.topic,
              correct: 0,
              total: 0,
              unanswered: 0,
            };
            previous.correct += row.correct;
            previous.total += row.total;
            previous.unanswered += row.unanswered;
            topics.set(row.topic, previous);
          }
        }
        return {
          id: a.id,
          title: metadata.title,
          level: metadata.level,
          mode: metadata.mode,
          status: a.status,
          startedAt: a.startedAt.toISOString(),
          deadlineAt: a.deadlineAt?.toISOString() ?? null,
          score: a.status === "IN_PROGRESS" ? null : a.score,
          totalQuestions: a.totalQuestions,
          accessLocked: metadata.access === "PREMIUM" && !premium,
          byTopic: result?.byTopic ?? [],
        };
      });
      return {
        attempts,
        byTopic: [...topics.values()],
        completedCount: completed.length,
        averagePercent: completed.length
          ? Math.round((totalPercent / completed.length) * 100) / 100
          : null,
        limit: 50,
      };
    },
    { timeout: 20000 },
  );
}
export async function manageTemplate(actor: Actor, input: unknown) {
  if (actor.role !== "ADMIN")
    throw new HttpError(403, "An admin role is required.");
  const command = z
    .object({
      action: z.enum(["create", "save", "activate", "deactivate"]),
      id: z.string().optional(),
      version: z.number().int().positive().optional(),
      data: z.unknown().optional(),
    })
    .strict()
    .parse(input);
  return getDb().$transaction(
    async (tx) => {
      if (command.action === "create") {
        const data = templateInput.parse(command.data);
        const template = await tx.examTemplate.create({ data });
        await audit(tx, actor, "exam-template.create", template.id);
        return template;
      }
      if (!command.id || !command.version)
        throw new HttpError(
          400,
          "Template ID and current version are required.",
        );
      await tx.$queryRaw`SELECT id FROM "ExamTemplate" WHERE id=${command.id} FOR UPDATE`;
      const current = await tx.examTemplate.findUnique({
        where: { id: command.id },
      });
      if (!current) throw new HttpError(404, "Template not found.");
      if (current.version !== command.version)
        throw new HttpError(409, "Template changed. Refresh before editing.");
      let data: Prisma.ExamTemplateUpdateInput = {
        active: false,
        version: { increment: 1 },
      };
      if (command.action === "save")
        data = {
          ...templateInput.parse(command.data),
          active: false,
          version: { increment: 1 },
        };
      if (command.action === "activate") {
        templateInput.parse({
          slug: current.slug,
          title: current.title,
          level: current.level,
          mode: current.mode,
          access: current.access,
          topics: current.topics,
          questionCount: current.questionCount,
          durationSeconds: current.durationSeconds,
        });
        if ((await bank(tx, current)).length < current.questionCount)
          throw new HttpError(
            409,
            "Publish enough independently reviewed questions before activating this template.",
          );
        data.active = true;
      }
      const result = await tx.examTemplate.update({
        where: { id: current.id },
        data,
      });
      await audit(tx, actor, `exam-template.${command.action}`, current.id, {
        version: result.version,
        active: result.active,
      });
      return result;
    },
    { timeout: 20000 },
  );
}
