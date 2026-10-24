import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { AccountTokenPurpose, Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { digest, hashPassword } from "@/lib/security";
import { enqueueMail, mailSetup } from "@/lib/mail";
type Tx = Prisma.TransactionClient;
export const emailInput = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
  })
  .strict();
const opaque = z.string().regex(/^[a-f0-9]{64}$/);
export const tokenInput = z.object({ token: opaque }).strict();
export const resetInput = tokenInput
  .extend({ password: z.string().min(12).max(128) })
  .strict();
async function now(tx: Tx) {
  return (
    await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  )[0].now;
}
async function lockUser(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id} FOR UPDATE`;
  return tx.user.findUniqueOrThrow({ where: { id } });
}
async function cancelTokens(
  tx: Tx,
  userId: string,
  time: Date,
  purpose?: AccountTokenPurpose,
) {
  await tx.accountToken.updateMany({
    where: { userId, consumedAt: null, ...(purpose ? { purpose } : {}) },
    data: { consumedAt: time },
  });
  await tx.mailMessage.updateMany({
    where: {
      userId,
      status: { in: ["PENDING", "PROCESSING"] },
      tokenId: { not: null },
      ...(purpose ? { purpose } : {}),
    },
    data: {
      status: "CANCELLED",
      encryptedPayload: null,
      leaseKey: null,
      leaseUntil: null,
    },
  });
}
export async function requestAccountToken(
  purpose: AccountTokenPurpose,
  identity: { userId: string } | { email: string },
) {
  const setup = await mailSetup();
  const db = getDb();
  const initial = await db.user.findUnique({
    where:
      "userId" in identity
        ? { id: identity.userId }
        : { email: identity.email },
    select: { id: true },
  });
  if (!initial) return;
  return db.$transaction(async (tx) => {
    const user = await lockUser(tx, initial.id);
    if (
      (purpose === "VERIFY_EMAIL" && user.emailVerifiedAt) ||
      (purpose === "RESET_PASSWORD" && !user.passwordHash)
    )
      return;
    const time = await now(tx);
    // Per-account cooldown also covers simultaneous requests across minute boundaries.
    const recent = await tx.accountToken.findFirst({
      where: {
        userId: user.id,
        purpose,
        createdAt: { gt: new Date(time.getTime() - 60000) },
      },
    });
    if (recent) return;
    await cancelTokens(tx, user.id, time, purpose);
    const token = randomBytes(32).toString("hex"),
      expiresAt = new Date(
        time.getTime() + (purpose === "VERIFY_EMAIL" ? 86400000 : 1800000),
      );
    const record = await tx.accountToken.create({
      data: {
        userId: user.id,
        email: user.email,
        authVersion: user.authVersion,
        purpose,
        tokenHash: digest(token),
        createdAt: time,
        expiresAt,
      },
    });
    const route =
      purpose === "VERIFY_EMAIL" ? "verify-email" : "reset-password";
    const message = await enqueueMail(
      tx,
      {
        userId: user.id,
        tokenId: record.id,
        purpose,
        expiresAt,
        payload: {
          to: user.email,
          subject:
            purpose === "VERIFY_EMAIL"
              ? "Verify your CSC Study email"
              : "Reset your CSC Study password",
          text: `${purpose === "VERIFY_EMAIL" ? "Confirm your email address" : "Choose a new password"} by opening this link and submitting the form:\n${setup.origin}/${route}#token=${token}\n\nThis link expires in ${purpose === "VERIFY_EMAIL" ? "24 hours" : "30 minutes"} and can be used once. If you did not request this, ignore it. No change happens until you submit the form.\n\nCSC Study is independent and unofficial.`,
        },
      },
      setup,
    );
    await tx.auditEvent.create({
      data: {
        actorId: null,
        action: `account.${purpose.toLowerCase()}.request`,
        targetId: user.id,
        metadata: {},
      },
    });
    return message.id;
  });
}
async function tokenOwner(token: string) {
  const record = await getDb().accountToken.findUnique({
    where: { tokenHash: digest(token) },
    select: { userId: true },
  });
  if (!record)
    throw new HttpError(
      400,
      "This link is invalid or expired. Request a new one.",
    );
  return record.userId;
}
async function validToken(
  tx: Tx,
  token: string,
  user: Awaited<ReturnType<typeof lockUser>>,
  purpose: AccountTokenPurpose,
  time: Date,
) {
  const record = await tx.accountToken.findUnique({
    where: { tokenHash: digest(token) },
  });
  if (
    !record ||
    record.userId !== user.id ||
    record.purpose !== purpose ||
    record.consumedAt ||
    record.expiresAt <= time ||
    record.authVersion !== user.authVersion ||
    record.email !== user.email
  )
    throw new HttpError(
      400,
      "This link is invalid or expired. Request a new one.",
    );
  return record;
}
export async function verifyEmail(raw: unknown) {
  const { token } = tokenInput.parse(raw),
    userId = await tokenOwner(token);
  await getDb().$transaction(async (tx) => {
    const user = await lockUser(tx, userId),
      time = await now(tx);
    const record = await validToken(tx, token, user, "VERIFY_EMAIL", time);
    await tx.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: time },
    });
    await tx.accountToken.update({
      where: { id: record.id },
      data: { consumedAt: time },
    });
    await tx.mailMessage.updateMany({
      where: { tokenId: record.id, status: { in: ["PENDING", "PROCESSING"] } },
      data: {
        status: "CANCELLED",
        encryptedPayload: null,
        leaseKey: null,
        leaseUntil: null,
      },
    });
    await tx.auditEvent.create({
      data: {
        actorId: null,
        action: "account.email.verify",
        targetId: user.id,
        metadata: {},
      },
    });
  });
}
export async function resetPassword(raw: unknown) {
  const { token, password } = resetInput.parse(raw),
    userId = await tokenOwner(token);
  // Validate before expensive KDF, then revalidate under the user lock after derivation.
  const initial = await getDb().accountToken.findUniqueOrThrow({
    where: { tokenHash: digest(token) },
  });
  const initialUser = await getDb().user.findUniqueOrThrow({
    where: { id: userId },
  });
  if (
    initial.purpose !== "RESET_PASSWORD" ||
    initial.consumedAt ||
    initial.expiresAt <= new Date() ||
    initial.authVersion !== initialUser.authVersion
  )
    throw new HttpError(
      400,
      "This link is invalid or expired. Request a new one.",
    );
  const passwordHash = await hashPassword(password);
  const setup = await mailSetup();
  return getDb().$transaction(async (tx) => {
    const user = await lockUser(tx, userId),
      time = await now(tx);
    await validToken(tx, token, user, "RESET_PASSWORD", time);
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, authVersion: { increment: 1 } },
    });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await cancelTokens(tx, user.id, time);
    const message = await enqueueMail(
      tx,
      {
        userId: user.id,
        purpose: "PASSWORD_CHANGED",
        expiresAt: new Date(time.getTime() + 86400000),
        payload: {
          to: user.email,
          subject: "Your CSC Study password was changed",
          text: `Your password was changed and all sessions were signed out. If this was not you, use password recovery from ${setup.origin}/forgot-password and contact the operator.\n\nCSC Study is independent and unofficial.`,
        },
      },
      setup,
    );
    await tx.auditEvent.create({
      data: {
        actorId: null,
        action: "account.password.reset",
        targetId: user.id,
        metadata: { sessionsRevoked: true },
      },
    });
    return message.id;
  });
}
