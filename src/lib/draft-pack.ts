import { z } from "zod";
import { questionSchema, validateBank } from "./content-validation";
const draftPackSchema = z.object({
  title: z.string().min(10),
  version: z.number().int().positive(),
  status: z.literal("DRAFT"),
  reviewStatus: z.literal("PENDING_INDEPENDENT_REVIEW"),
  questions: z.array(questionSchema).min(1).max(100),
}).strict();

export function validateDraftPack(input: unknown) {
  const pack = draftPackSchema.parse(input);
  if (pack.questions.some(q => q.status !== "DRAFT")) throw new Error("Review packs must contain only unapproved drafts.");
  validateBank(pack.questions);
  return pack;
}

// The editorial API accepts input fields only, never imported lifecycle state.
export function questionImportRows(input: unknown) {
  return validateDraftPack(input).questions.map(q => ({
    key: q.key, prompt: q.prompt, topic: q.topic, level: q.level,
    difficulty: q.difficulty, sourceNotes: q.sourceNotes,
    explanation: q.explanation, choices: q.choices,
  }));
}
