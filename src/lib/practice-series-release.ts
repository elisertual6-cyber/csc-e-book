import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getDb } from "./db";
import { audit, contentHash, questionInput, type Actor, type ContentRecord } from "./editorial";
import { HttpError } from "./http";
import { practiceSeriesKey, practiceSetCount, practiceSetSize, validSeriesSettings, type SeriesSettings } from "./practice-series-policy";

type Tx = Prisma.TransactionClient;
type Question = Extract<ContentRecord, { prompt: string }>;
export const unreviewedReleaseAction = "practice-series.activate-unreviewed";
const releaseSchema = z.object({
  seriesKey: z.literal(practiceSeriesKey), position: z.number().int().min(1).max(practiceSetCount),
  reviewStatus: z.literal("UNREVIEWED"),
  questions: z.array(z.object({ id: z.string(), key: z.string(), version: z.number().int().positive(), hash: z.string().regex(/^[a-f0-9]{64}$/) })).length(practiceSetSize),
});
export type UnreviewedRelease = z.infer<typeof releaseSchema>;
export async function unreviewedSeriesRelease(tx: Tx, template: SeriesSettings & { id: string }): Promise<UnreviewedRelease | null> {
  if (!validSeriesSettings(template)) return null;
  const event = await tx.auditEvent.findFirst({ where: { targetId: template.id, action: unreviewedReleaseAction }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  const parsed = releaseSchema.safeParse(event?.metadata);
  if (!parsed.success || parsed.data.position !== template.setPosition ||
    new Set(parsed.data.questions.map(q => q.id)).size !== practiceSetSize ||
    parsed.data.questions.some((q, index) => q.key !== template.questionKeys[index])) return null;
  return parsed.data;
}
export function matchesUnreviewedRelease(question: Question, release: UnreviewedRelease | null) {
  return question.status !== "ARCHIVED" && !!release?.questions.some(q => q.id === question.id && q.key === question.key &&
    q.version === question.version && q.hash === contentHash(question));
}

// Explicit operator authorization for the five free draft practice sets only.
// No Question status or Review row is changed or manufactured.
export async function activateUnreviewedPracticeSeries(actor: Actor) {
  if (actor.role !== "ADMIN") throw new HttpError(403, "An admin role is required.");
  return getDb().$transaction(async tx => {
    const identities = await tx.$queryRaw<{ role: string }[]>`SELECT role FROM "User" WHERE id=${actor.id} FOR SHARE`;
    if (identities[0]?.role !== "ADMIN") throw new HttpError(403, "A current ADMIN is required.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73642021)`;
    await tx.$queryRaw`SELECT id FROM "ExamTemplate" WHERE "seriesKey"=${practiceSeriesKey} ORDER BY id FOR UPDATE`;
    const templates = await tx.examTemplate.findMany({ where: { seriesKey: practiceSeriesKey }, orderBy: { setPosition: "asc" } });
    if (templates.length !== practiceSetCount || templates.some((t, index) => !validSeriesSettings(t) || t.setPosition !== index + 1))
      throw new HttpError(409, "Import and prepare all five 160-question sets first.");
    const keys = templates.flatMap(t => t.questionKeys);
    await tx.$queryRaw`SELECT id FROM "Question" WHERE key IN (${Prisma.join(keys)}) ORDER BY id FOR SHARE`;
    const questions = await tx.question.findMany({ where: { key: { in: keys } }, include: { choices: true, explanation: true, reviews: true },
      orderBy: [{ key: "asc" }, { version: "desc" }], distinct: ["key"] });
    if (questions.length !== practiceSetCount * practiceSetSize) throw new HttpError(409, "All 800 questions are required before activation.");
    const byKey = new Map(questions.map(q => [q.key, q]));
    for (const q of questions) {
      const valid = questionInput.safeParse({ key: q.key, prompt: q.prompt, topic: q.topic, level: q.level, difficulty: q.difficulty,
        sourceNotes: q.sourceNotes, explanation: q.explanation?.rationale,
        choices: q.choices.map(c => ({ label: c.label, text: c.text, isCorrect: c.isCorrect })) });
      if (q.status === "ARCHIVED" || !valid.success) throw new HttpError(409, "Every set needs 160 complete questions with four choices, one proposed key and an explanation.");
    }
    let activated = 0;
    for (const template of templates) {
      const release: UnreviewedRelease = { seriesKey: practiceSeriesKey, position: template.setPosition!, reviewStatus: "UNREVIEWED",
        questions: template.questionKeys.map(key => { const q = byKey.get(key)!; return { id: q.id, key: q.key, version: q.version, hash: contentHash(q) }; }) };
      const previous = await unreviewedSeriesRelease(tx, template);
      if (JSON.stringify(previous) !== JSON.stringify(release)) await audit(tx, actor, unreviewedReleaseAction, template.id, release);
      if (!template.active) {
        await tx.examTemplate.update({ where: { id: template.id }, data: { active: true, version: { increment: 1 } } });
        await audit(tx, actor, "exam-template.activate", template.id, { seriesKey: practiceSeriesKey, reviewStatus: "UNREVIEWED" });
        activated++;
      }
    }
    return { sets: practiceSetCount, activated, questions: keys.length, reviewStatus: "UNREVIEWED" as const };
  }, { timeout: 180000 });
}
