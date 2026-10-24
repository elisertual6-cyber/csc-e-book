import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { processMailBatch } from "./mail";
import { HttpError } from "./http";

// This controlled rollout dispatches only a current administrator's account mail.
// It never materializes purchase notices or processes another user's queue.
export async function processOperatorAccountMail(db: PrismaClient, email: string) {
  const parsed = z.email().max(254).safeParse(email.trim().toLowerCase());
  if (!parsed.success) throw new HttpError(400, "A configured operator account is required.");
  const user = await db.user.findUnique({ where: { email: parsed.data }, select: { id: true, role: true } });
  if (!user || user.role !== "ADMIN") throw new HttpError(403, "A current administrator account is required.");
  return processMailBatch(db, 5, user.id);
}
