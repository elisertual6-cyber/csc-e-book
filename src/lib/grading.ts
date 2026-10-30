import { z } from "zod";
export const snapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    questions: z
      .array(
        z.object({
          questionKey: z.string(),
          sourceId: z.string(),
          sourceVersion: z.number().int(),
          prompt: z.string(),
          topic: z.string(),
          choices: z
            .array(
              z.object({
                label: z.string(),
                text: z.string(),
                isCorrect: z.boolean(),
              }),
            )
            .length(4)
            .refine(
              (c) =>
                c.filter((v) => v.isCorrect).length === 1 &&
                new Set(c.map((v) => v.label)).size === 4,
            ),
          explanation: z.string().min(1),
          sourceNotes: z.string(),
        }),
      )
      .min(1)
      .max(200),
  })
  .refine(
    (s) =>
      new Set(s.questions.map((q) => q.questionKey)).size ===
      s.questions.length,
  );
export const examMetadataSchema = z.object({
  title: z.string(),
  level: z.enum(["COMMON", "PROFESSIONAL", "SUBPROFESSIONAL"]),
  mode: z.enum(["PRACTICE", "MOCK"]),
  access: z.enum(["FREE", "PREMIUM"]),
  templateVersion: z.number().int(),
  unreviewed: z.boolean().optional(),
  durationSeconds: z.number().int().nonnegative(),
  series: z.object({ key: z.string().min(1), position: z.number().int().min(1).max(5), unreviewed: z.boolean().optional() }).optional(),
});
export type ExamSnapshot = z.infer<typeof snapshotSchema>;
export function grade(
  snapshot: ExamSnapshot,
  responses: { questionKey: string; choiceLabel: string | null }[],
) {
  const saved = new Map(responses.map((r) => [r.questionKey, r.choiceLabel]));
  const topics = new Map<
    string,
    { topic: string; correct: number; total: number; unanswered: number }
  >();
  const answers = snapshot.questions.map((q) => {
    const selectedLabel = saved.get(q.questionKey) ?? null;
    const correctLabel = q.choices.find((c) => c.isCorrect)!.label;
    const isCorrect = selectedLabel === correctLabel;
    const topic = topics.get(q.topic) ?? {
      topic: q.topic,
      correct: 0,
      total: 0,
      unanswered: 0,
    };
    topic.total++;
    topic.correct += Number(isCorrect);
    topic.unanswered += Number(selectedLabel === null);
    topics.set(q.topic, topic);
    return {
      questionKey: q.questionKey,
      correctLabel,
      selectedLabel,
      isCorrect,
      explanation: q.explanation,
      sourceNotes: q.sourceNotes,
    };
  });
  const correct = answers.filter((a) => a.isCorrect).length;
  const total = answers.length;
  return {
    correct,
    total,
    unanswered: answers.filter((a) => a.selectedLabel === null).length,
    percent: Math.round((correct / total) * 10000) / 100,
    byTopic: [...topics.values()].sort((a, b) =>
      a.topic.localeCompare(b.topic),
    ),
    answers,
  };
}
