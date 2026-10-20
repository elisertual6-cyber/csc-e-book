import "server-only";
import { z } from "zod";
import type { Prisma, ReviewStatus } from "@prisma/client";
import { getDb } from "@/lib/db";
import {
  questionSchema,
  checkLesson,
  normalize,
} from "@/lib/content-validation";
import { digest, canReview, canWrite } from "@/lib/security";
import { HttpError } from "@/lib/http";
export type Actor = {
  id: string;
  role: "CUSTOMER" | "EDITOR" | "REVIEWER" | "ADMIN";
};
export type ContentKind = "lessons" | "questions";
export const slug = z
  .string()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const lessonInput = z
  .object({
    slug,
    title: z.string().trim().min(5).max(200),
    chapterSlug: slug,
    objectives: z.array(z.string().trim().min(10).max(500)).min(1).max(12),
    markdown: z.string().min(100).max(100_000),
  })
  .strict();
export const questionInput = z
  .object({
    key: slug,
    prompt: z.string().trim().min(10).max(10_000),
    topic: slug,
    level: questionSchema.shape.level,
    difficulty: questionSchema.shape.difficulty,
    sourceNotes: z.string().trim().min(10).max(10_000),
    explanation: z.string().trim().min(20).max(10_000),
    choices: z
      .array(
        z
          .object({
            label: z.enum(["A", "B", "C", "D"]),
            text: z.string().trim().min(1).max(2000),
            isCorrect: z.boolean(),
          })
          .strict(),
      )
      .length(4),
  })
  .strict()
  .refine(
    (q) =>
      questionSchema.safeParse({ ...q, version: 1, status: "DRAFT" }).success,
    "Question needs four distinct options and one correct answer.",
  );
export const chapterInput = z
  .object({
    slug,
    title: z.string().trim().min(5).max(200),
    position: z.number().int().min(1).max(1000),
    level: questionSchema.shape.level,
  })
  .strict();
export async function loadContent(
  tx: Prisma.TransactionClient,
  kind: ContentKind,
  id: string,
) {
  const record =
    kind === "questions"
      ? await tx.question.findUnique({
          where: { id },
          include: { choices: true, explanation: true, reviews: true },
        })
      : await tx.lesson.findUnique({
          where: { id },
          include: { reviews: true, chapter: true },
        });
  if (!record) throw new HttpError(404, "Content not found.");
  return record;
}
export type ContentRecord = Awaited<ReturnType<typeof loadContent>>;
export function contentHash(record: ContentRecord) {
  return digest(
    JSON.stringify(
      "prompt" in record
        ? {
            key: record.key,
            version: record.version,
            prompt: record.prompt,
            topic: record.topic,
            level: record.level,
            difficulty: record.difficulty,
            sourceNotes: record.sourceNotes,
            choices: [...record.choices]
              .sort((a, b) => a.label.localeCompare(b.label))
              .map((c) => ({
                label: c.label,
                text: c.text,
                isCorrect: c.isCorrect,
              })),
            explanation: record.explanation?.rationale,
          }
        : {
            slug: record.slug,
            version: record.version,
            title: record.title,
            objectives: record.objectives,
            markdown: record.markdown,
          },
    ),
  );
}
export function independentlyApproved(record: ContentRecord) {
  return (
    !!record.authorId &&
    record.reviews.some(
      (r) =>
        r.decision === "APPROVED" &&
        r.reviewerId !== record.authorId &&
        r.contentHash === contentHash(record),
    )
  );
}
export async function audit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  action: string,
  targetId: string,
  metadata: Prisma.InputJsonValue = {},
) {
  await tx.auditEvent.create({
    data: { actorId: actor.id, action, targetId, metadata },
  });
}
async function createContent(
  tx: Prisma.TransactionClient,
  actor: Actor,
  kind: ContentKind,
  input: unknown,
) {
  if (!canWrite(actor.role))
    throw new HttpError(403, "An editor role is required.");
  if (kind === "questions") {
    const data = questionInput.parse(input);
    const previous = await tx.question.findFirst({
      where: { key: data.key },
      orderBy: { version: "desc" },
    });
    if (
      previous?.authorId &&
      previous.authorId !== actor.id &&
      actor.role !== "ADMIN"
    )
      throw new HttpError(
        403,
        "Only the author or an admin can create the next version.",
      );
    const existing = await tx.question.findMany({
      where: { key: { not: data.key } },
      select: { prompt: true },
    });
    if (existing.some((q) => normalize(q.prompt) === normalize(data.prompt)))
      throw new HttpError(409, "Another question already uses this prompt.");
    const { choices, explanation, ...fields } = data;
    const created = await tx.question.create({
      data: {
        ...fields,
        authorId: actor.id,
        version: (previous?.version ?? 0) + 1,
        status: "DRAFT",
        choices: { create: choices },
        explanation: { create: { rationale: explanation } },
      },
    });
    await audit(tx, actor, "question.create", created.id, {
      version: created.version,
    });
    return created;
  }
  const data = lessonInput.parse(input);
  try {
    checkLesson(data.markdown);
  } catch {
    throw new HttpError(
      400,
      "Lesson needs objectives, explanation, worked example, practice and rationale sections.",
    );
  }
  const chapter = await tx.chapter.findUnique({
    where: { slug: data.chapterSlug },
  });
  if (!chapter) throw new HttpError(400, "Choose an existing chapter.");
  const previous = await tx.lesson.findFirst({
    where: { slug: data.slug },
    orderBy: { version: "desc" },
  });
  if (
    previous?.authorId &&
    previous.authorId !== actor.id &&
    actor.role !== "ADMIN"
  )
    throw new HttpError(
      403,
      "Only the author or an admin can create the next version.",
    );
  const { chapterSlug: _chapterSlug, ...fields } = data;
  void _chapterSlug;
  const created = await tx.lesson.create({
    data: {
      ...fields,
      chapterId: chapter.id,
      authorId: actor.id,
      version: (previous?.version ?? 0) + 1,
    },
  });
  await audit(tx, actor, "lesson.create", created.id, {
    version: created.version,
  });
  return created;
}
export async function createDrafts(
  actor: Actor,
  kind: ContentKind,
  inputs: unknown[],
) {
  if (inputs.length < 1 || inputs.length > 100)
    throw new HttpError(400, "Import 1–100 records at a time.");
  return getDb().$transaction(
    async (tx) => {
      const created = [];
      for (const input of inputs)
        created.push(await createContent(tx, actor, kind, input));
      return created;
    },
    { isolationLevel: "Serializable", timeout: 20_000 },
  );
}
const commandSchema = z
  .object({
    action: z.enum([
      "save",
      "submit",
      "approve",
      "reject",
      "publish",
      "archive",
    ]),
    id: z.string().min(1),
    revision: z.number().int().positive(),
    data: z.unknown().optional(),
    notes: z.string().trim().max(4000).optional(),
    humanReviewed: z.boolean().optional(),
  })
  .strict();
export async function changeContent(
  actor: Actor,
  kind: ContentKind,
  input: unknown,
) {
  const command = commandSchema.parse(input);
  return getDb().$transaction(
    async (tx) => {
      const record = await loadContent(tx, kind, command.id);
      if (record.revision !== command.revision)
        throw new HttpError(
          409,
          "This version has changed. Refresh before editing.",
        );
      const own = record.authorId === actor.id;
      let status: ReviewStatus = record.status;
      if (command.action === "save" || command.action === "submit") {
        if (!canWrite(actor.role) || !own)
          throw new HttpError(
            403,
            "Only the author can edit or submit this draft.",
          );
        if (record.status !== "DRAFT")
          throw new HttpError(
            409,
            "Reviewed versions are immutable. Create a new version.",
          );
        if (command.action === "save") {
          if (kind === "questions") {
            const data = questionInput.parse(command.data);
            if (!("key" in record) || data.key !== record.key)
              throw new HttpError(400, "The question key cannot change.");
            const duplicates = await tx.question.findMany({
              where: { key: { not: data.key } },
              select: { prompt: true },
            });
            if (
              duplicates.some(
                (q) => normalize(q.prompt) === normalize(data.prompt),
              )
            )
              throw new HttpError(
                409,
                "Another question already uses this prompt.",
              );
            const { choices, explanation, ...fields } = data;
            await tx.question.update({
              where: { id: record.id },
              data: {
                ...fields,
                choices: { deleteMany: {}, create: choices },
                explanation: {
                  upsert: {
                    create: { rationale: explanation },
                    update: { rationale: explanation },
                  },
                },
              },
            });
          } else {
            const data = lessonInput.parse(command.data);
            if (!("slug" in record) || data.slug !== record.slug)
              throw new HttpError(400, "The lesson slug cannot change.");
            try {
              checkLesson(data.markdown);
            } catch {
              throw new HttpError(
                400,
                "Complete every required lesson section.",
              );
            }
            const chapter = await tx.chapter.findUnique({
              where: { slug: data.chapterSlug },
            });
            if (!chapter) throw new HttpError(400, "Chapter not found.");
            await tx.lesson.update({
              where: { id: record.id },
              data: {
                title: data.title,
                objectives: data.objectives,
                markdown: data.markdown,
                chapterId: chapter.id,
              },
            });
          }
        } else status = "IN_REVIEW";
      } else if (command.action === "approve" || command.action === "reject") {
        if (!canReview(actor.role) || own || !record.authorId)
          throw new HttpError(
            403,
            "An independent reviewer must review an authored version.",
          );
        if (record.status !== "IN_REVIEW")
          throw new HttpError(409, "Only submitted content can be reviewed.");
        if (
          !command.notes ||
          command.notes.length < 20 ||
          (command.action === "approve" && command.humanReviewed !== true)
        )
          throw new HttpError(
            400,
            "Document the human review, accuracy and source checks in at least 20 characters.",
          );
        status = command.action === "approve" ? "APPROVED" : "DRAFT";
        await tx.review.create({
          data: {
            reviewerId: actor.id,
            ...(kind === "questions"
              ? { questionId: record.id }
              : { lessonId: record.id }),
            decision: status,
            notes: command.notes,
            contentHash: contentHash(record),
          },
        });
      } else if (command.action === "publish") {
        if (actor.role !== "ADMIN")
          throw new HttpError(403, "An admin must publish reviewed content.");
        if (record.status !== "APPROVED" || !independentlyApproved(record))
          throw new HttpError(
            409,
            "Independent approval matching this content is required.",
          );
        status = "PUBLISHED";
      } else {
        if (
          actor.role !== "ADMIN" &&
          !(canWrite(actor.role) && own && record.status === "DRAFT")
        )
          throw new HttpError(403, "You cannot archive this version.");
        if (record.status === "ARCHIVED")
          throw new HttpError(409, "Already archived.");
        status = "ARCHIVED";
      }
      const where = {
        id: record.id,
        revision: command.revision,
        status: record.status,
      };
      const result =
        kind === "questions"
          ? await tx.question.updateMany({
              where,
              data: { status, revision: { increment: 1 } },
            })
          : await tx.lesson.updateMany({
              where,
              data: { status, revision: { increment: 1 } },
            });
      if (result.count !== 1)
        throw new HttpError(
          409,
          "Concurrent edit detected. Refresh and retry.",
        );
      await audit(tx, actor, `${kind}.${command.action}`, record.id, {
        from: record.status,
        to: status,
        revision: record.revision + 1,
      });
      return loadContent(tx, kind, record.id);
    },
    { isolationLevel: "Serializable", timeout: 20_000 },
  );
}
