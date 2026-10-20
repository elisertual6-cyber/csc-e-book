import { z } from "zod";
export const questionSchema = z
  .object({
    key: z.string().min(1),
    prompt: z.string().min(10),
    topic: z.string().min(1),
    level: z.enum(["COMMON", "PROFESSIONAL", "SUBPROFESSIONAL"]),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    version: z.number().int().positive(),
    status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"]),
    sourceNotes: z.string().min(10),
    explanation: z.string().min(20),
    choices: z
      .array(
        z.object({
          label: z.string().min(1),
          text: z.string().min(1),
          isCorrect: z.boolean(),
        }),
      )
      .length(4),
  })
  .superRefine((q, ctx) => {
    if (q.choices.filter((c) => c.isCorrect).length !== 1)
      ctx.addIssue({
        code: "custom",
        message: "Exactly one correct answer required",
      });
    if (
      new Set(q.choices.map((c) => c.label)).size !== 4 ||
      new Set(q.choices.map((c) => normalize(c.text))).size !== 4
    )
      ctx.addIssue({ code: "custom", message: "Options must be distinct" });
  });
export function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-PH")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
export function validateBank(input: unknown[]) {
  const bank = z.array(questionSchema).parse(input);
  if (new Set(bank.map((q) => normalize(q.prompt))).size !== bank.length)
    throw new Error("Duplicate question prompts");
  if (new Set(bank.map((q) => `${q.key}:${q.version}`)).size !== bank.length)
    throw new Error("Duplicate question versions");
  return bank;
}
export function checkLesson(markdown: string) {
  for (const heading of [
    "Learning objectives",
    "Explanation",
    "Worked example",
    "Practice",
    "Rationale",
  ]) {
    const section = markdown
      .split(`## ${heading}\n`)[1]
      ?.split(/\n## /)[0]
      ?.trim();
    if (!section || section.length < 20)
      throw new Error(`Missing lesson section: ${heading}`);
  }
}
