import { z } from "zod";
export const editionInput = z
  .object({
    kind: z.enum(["DRAFT", "PREVIEW", "FULL"]),
    version: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z0-9.-]+$/),
    title: z.string().trim().min(5).max(150),
    lessonIds: z.array(z.string().min(1)).min(1).max(100),
    questionIds: z.array(z.string().min(1)).max(1000),
  })
  .strict();
