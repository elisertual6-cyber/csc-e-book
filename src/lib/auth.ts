import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import type { Role } from "@prisma/client";
import { getDb } from "@/lib/db";
import { digest, sessionCookie } from "@/lib/security";
import { HttpError } from "@/lib/http";
const safeUser = {
  id: true,
  email: true,
  name: true,
  role: true,
  emailVerifiedAt: true,
} as const;
export function registrationEnabled() {
  return process.env.REGISTRATION_ENABLED === undefined
    ? process.env.NODE_ENV !== "production"
    : process.env.REGISTRATION_ENABLED === "true";
}
export async function currentUser() {
  const token = (await cookies()).get(sessionCookie())?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await getDb().session.findUnique({
    where: { tokenHash: digest(token) },
    include: { user: { select: { ...safeUser, authVersion: true } } },
  });
  if (
    !session ||
    session.expiresAt <= new Date() ||
    session.authVersion !== session.user.authVersion
  )
    return null;
  const { authVersion, ...user } = session.user;
  void authVersion;
  return user;
}
export async function requireUser(roles?: Role[]) {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  if (roles && !roles.includes(user.role))
    throw new HttpError(403, "You do not have access to this action.");
  return user;
}
export async function createSession(userId: string, expectedVersion: number) {
  await destroySession();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { authVersion: true },
    });
    if (user.authVersion !== expectedVersion)
      throw new HttpError(401, "Credentials changed. Sign in again.");
    await tx.session.create({
      data: {
        userId,
        tokenHash: digest(token),
        expiresAt,
        authVersion: user.authVersion,
      },
    });
  });
  (await cookies()).set(sessionCookie(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(sessionCookie())?.value;
  if (token)
    await getDb().session.deleteMany({ where: { tokenHash: digest(token) } });
  jar.set(sessionCookie(), "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
export async function rateLimit(
  scope: string,
  identity: string,
  limit: number,
) {
  const minute = Math.floor(Date.now() / 60_000);
  const key = `${scope}:${digest(identity)}:${minute}`;
  const bucket = await getDb().rateLimitBucket.upsert({
    where: { key },
    create: { key, expiresAt: new Date((minute + 2) * 60_000) },
    update: { hits: { increment: 1 } },
  });
  if (bucket.hits > limit)
    throw new HttpError(429, "Too many requests. Wait a minute and try again.");
}
