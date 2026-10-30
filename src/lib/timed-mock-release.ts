import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getDb } from "./db";
import { audit, contentHash, questionInput, type Actor } from "./editorial";
import { HttpError } from "./http";
import { mockSourceTopic, timedMockDefinition, timedMockDefinitions, type TimedMockSettings } from "./timed-mock-policy";

type Tx = Prisma.TransactionClient;
export const timedMockReleaseAction = "timed-mock.activate-unreviewed";
const releaseSchema = z.object({
  reviewStatus: z.literal("UNREVIEWED"),
  questions: z.array(z.object({ id: z.string(), key: z.string(), version: z.number().int().positive(), hash: z.string().regex(/^[a-f0-9]{64}$/) })).length(160),
});
export async function unreviewedTimedMockRelease(tx: Tx, template: TimedMockSettings & { id: string }) {
  const definition = timedMockDefinition(template);
  if (!definition) return null;
  const event = await tx.auditEvent.findFirst({ where: { targetId: template.id, action: timedMockReleaseAction }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const parsed = releaseSchema.safeParse(event?.metadata);
  if (!parsed.success || new Set(parsed.data.questions.map(q => q.id)).size !== 160 ||
    parsed.data.questions.some((q, index) => q.key !== definition.questionKeys[index])) return null;
  return parsed.data;
}

// Explicit release of two fixed FREE mocks; no question publication or review attestation.
export async function activateUnreviewedTimedMocks(actor: Actor) {
  if (actor.role !== "ADMIN") throw new HttpError(403, "An admin role is required.");
  return getDb().$transaction(async tx => {
    const identities = await tx.$queryRaw<{ role: string }[]>`SELECT role FROM "User" WHERE id=${actor.id} FOR SHARE`;
    if (identities[0]?.role !== "ADMIN") throw new HttpError(403, "A current ADMIN is required.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73642022)`;
    const slugs = timedMockDefinitions.map(d => d.slug);
    await tx.$queryRaw`SELECT id FROM "ExamTemplate" WHERE slug IN (${Prisma.join(slugs)}) ORDER BY id FOR UPDATE`;
    const keys = [...new Set(timedMockDefinitions.flatMap(d => d.questionKeys))];
    await tx.$queryRaw`SELECT id FROM "Question" WHERE key IN (${Prisma.join(keys)}) ORDER BY id FOR SHARE`;
    const questions = await tx.question.findMany({ where: { key: { in: keys } }, include: { choices: true, explanation: true, reviews: true },
      orderBy: [{ key: "asc" }, { version: "desc" }], distinct: ["key"] });
    const byKey = new Map(questions.map(q => [q.key, q]));
    for (const definition of timedMockDefinitions) for (const key of definition.questionKeys) {
      const q = byKey.get(key);
      if (!q || q.status === "ARCHIVED" || !["COMMON", definition.level].includes(q.level) ||
        !definition.topics.includes(q.topic) || mockSourceTopic(key) !== q.topic ||
        !questionInput.safeParse({ key: q.key, prompt: q.prompt, topic: q.topic, level: q.level, difficulty: q.difficulty,
          sourceNotes: q.sourceNotes, explanation: q.explanation?.rationale,
          choices: q.choices.map(c => ({ label: c.label, text: c.text, isCorrect: c.isCorrect })) }).success)
        throw new HttpError(409, "Import the five practice sets first. Each timed mock needs 160 complete, track-matched draft questions.");
    }
    let activated = 0;
    for (const definition of timedMockDefinitions) {
      const { questionKeys, ...configuration } = definition;
      let template = await tx.examTemplate.findUnique({ where: { slug: definition.slug } });
      if (template && !timedMockDefinition(template)) throw new HttpError(409, "A timed mock configuration was changed. Resolve it before releasing; no existing settings were overwritten.");
      if (!template) template = await tx.examTemplate.create({ data: configuration });
      const release = { reviewStatus: "UNREVIEWED" as const, questions: questionKeys.map(key => {
        const q = byKey.get(key)!;
        return { id: q.id, key: q.key, version: q.version, hash: contentHash(q) };
      }) };
      const previous = await unreviewedTimedMockRelease(tx, template);
      if (JSON.stringify(previous) !== JSON.stringify(release)) await audit(tx, actor, timedMockReleaseAction, template.id, release);
      if (!template.active) {
        await tx.examTemplate.update({ where: { id: template.id }, data: { active: true, version: { increment: 1 } } });
        await audit(tx, actor, "exam-template.activate", template.id, { reviewStatus: "UNREVIEWED", mode: "MOCK" });
        activated++;
      }
    }
    return { sessions: 2, activated, questionCount: 160, durationMinutes: 150 };
  }, { timeout: 180000 });
}
