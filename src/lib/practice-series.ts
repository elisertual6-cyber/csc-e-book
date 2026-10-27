import "server-only";
import type { Prisma } from "@prisma/client";
import { getDb } from "./db";
import { HttpError } from "./http";
import { examMetadataSchema, snapshotSchema } from "./grading";
import { practiceSeriesKey, practiceSetCount, practiceSetSize, validSeriesSettings, type SeriesProgress, type SeriesSettings } from "./practice-series-policy";
type Tx = Prisma.TransactionClient;

export async function hasCompletedSet(tx: Tx, userId: string, template: SeriesSettings & { id: string }) {
  if (!validSeriesSettings(template)) return false;
  const attempt = await tx.attempt.findFirst({
    where: { userId, templateId: template.id, status: "SUBMITTED", totalQuestions: practiceSetSize },
    orderBy: { submittedAt: "asc" }, include: { responses: true },
  });
  if (!attempt) return false;
  const metadata = examMetadataSchema.safeParse(attempt.templateSnapshot);
  const snapshot = snapshotSchema.safeParse(attempt.questionSnapshot);
  return metadata.success && snapshot.success && snapshot.data.questions.length === practiceSetSize &&
    metadata.data.series?.key === template.seriesKey && metadata.data.series?.position === template.setPosition &&
    snapshot.data.questions.every(q => attempt.responses.some(r => r.questionKey === q.questionKey && q.choices.some(c => c.label === r.choiceLabel)));
}

export async function requirePreviousSets(tx: Tx, userId: string, template: SeriesSettings) {
  if (!validSeriesSettings(template)) throw new HttpError(409, "This practice set needs operator review.");
  for (let position = 1; position < template.setPosition!; position++) {
    const previous = await tx.examTemplate.findUnique({ where: { seriesKey_setPosition: { seriesKey: practiceSeriesKey, setPosition: position } } });
    if (!previous || !await hasCompletedSet(tx, userId, previous))
      throw new HttpError(403, "Finish and submit all 160 answers in each earlier set before starting this set.");
  }
}

export async function practiceSeriesProgress(userId: string): Promise<SeriesProgress> {
  return getDb().$transaction(async tx => {
    const templates = await tx.examTemplate.findMany({ where: { seriesKey: practiceSeriesKey }, orderBy: { setPosition: "asc" }, take: practiceSetCount });
    const sets: SeriesProgress["sets"] = [];
    let predecessorsComplete = true, completedSets = 0;
    for (let position = 1; position <= practiceSetCount; position++) {
      const template = templates.find(t => t.setPosition === position);
      const valid = !!template && validSeriesSettings(template);
      const complete = valid && await hasCompletedSet(tx, userId, template);
      const active = valid ? await tx.attempt.findFirst({ where: { userId, templateId: template.id, status: "IN_PROGRESS" }, orderBy: { startedAt: "desc" }, select: { id: true, responses: { select: { choiceLabel: true } } } }) : null;
      const state = !valid ? "not_prepared" : !predecessorsComplete ? "locked" : complete ? "completed" : active ? "in_progress" : !template.active ? "awaiting_review" : "available";
      sets.push({ position, title: template?.title ?? `Practice Set ${position}`, questionCount: practiceSetSize, state,
        templateId: valid ? template.id : null, attemptId: predecessorsComplete ? active?.id ?? null : null,
        answered: complete ? practiceSetSize : active?.responses.filter(r => r.choiceLabel !== null).length ?? 0 });
      if (predecessorsComplete && complete) completedSets++;
      predecessorsComplete = predecessorsComplete && complete;
    }
    return { title: "Five sets, one step at a time", totalSets: practiceSetCount, completedSets, sets };
  }, { timeout: 20000 });
}
