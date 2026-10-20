import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Role } from "@prisma/client";
const kdfOptions = { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 };
function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, 64, kdfOptions, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);
  return `scrypt-v1:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  const parts = stored?.split(":");
  const valid =
    parts?.length === 3 &&
    parts[0] === "scrypt-v1" &&
    /^[a-f0-9]{32}$/.test(parts[1]) &&
    /^[a-f0-9]{128}$/.test(parts[2]);
  // Run the same KDF for unknown accounts to reduce timing-based enumeration.
  const salt = valid ? parts[1] : "00000000000000000000000000000000";
  const actual = await derive(password, salt);
  return !!valid && timingSafeEqual(actual, Buffer.from(parts[2], "hex"));
}
export function digest(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
export const staffRoles: Role[] = ["EDITOR", "REVIEWER", "ADMIN"];
export const writerRoles: Role[] = ["EDITOR", "ADMIN"];
export function canWrite(role: Role) {
  return writerRoles.includes(role);
}
export function canReview(role: Role) {
  return role === "REVIEWER" || role === "ADMIN";
}
export const sessionCookie = () =>
  process.env.NODE_ENV === "production" ? "__Host-csc_session" : "csc_session";
