import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { z } from "zod";
import { applicationTables } from "./schema-policy";

export const recoveryTables = [...applicationTables, "_prisma_migrations"] as const;
export const recoveryHash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
};
const uuidPdf = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.pdf$/;
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const payload = z.object({ sha256: hex, base64: z.string().max(96 * 1024 * 1024) }).strict();
const edition = z.object({
  id: z.string().min(1), kind: z.enum(["DRAFT", "PREVIEW", "FULL"]), version: z.string(), title: z.string(),
  creatorId: z.string().min(1), filename: z.string().regex(/^supabase:[a-f0-9-]+\.pdf$/), sha256: hex,
  manifest: z.unknown(), createdAt: z.string(), publishedAt: z.string().nullable(),
}).strict();
const bundleSchema = z.object({
  version: z.literal(1), createdAt: z.iso.datetime(), revision: z.string().regex(/^[a-f0-9]{40}$/),
  counts: z.record(z.enum(recoveryTables), z.number().int().nonnegative()),
  editions: z.array(edition).min(1).max(100),
  dump: payload,
  files: z.array(payload.extend({ name: z.string().regex(uuidPdf) })).min(1).max(100),
}).strict();
export type RecoveryBundle = z.infer<typeof bundleSchema>;
const MAGIC = Buffer.from("CSC_PRIVATE_RECOVERY_V1\n");
const MAX = 256 * 1024 * 1024;
function keyBytes(key: string) {
  key = key.trim();
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error("A separately stored 32-byte backup encryption key is required.");
  return Buffer.from(key, "hex");
}
export function recoveryPayload(value: { base64: string; sha256: string }) {
  const bytes = Buffer.from(value.base64, "base64");
  if (!bytes.length || bytes.toString("base64") !== value.base64 || recoveryHash(bytes) !== value.sha256) throw new Error("Invalid backup payload.");
  return bytes;
}
export function validateRecoveryBundle(value: unknown): RecoveryBundle {
  const bundle = bundleSchema.parse(value);
  if (recoveryPayload(bundle.dump).length > 64 * 1024 * 1024) throw new Error("Backup dump exceeds rehearsal limit.");
  const files = new Map<string, string>();
  let size = 0;
  for (const file of bundle.files) {
    const bytes = recoveryPayload(file);
    size += bytes.length;
    if (files.has(file.name) || bytes.length > 32 * 1024 * 1024 || size > 64 * 1024 * 1024) throw new Error("Invalid backup file set.");
    files.set(file.name, file.sha256);
  }
  const ids = new Set<string>(), names = new Set<string>();
  for (const row of bundle.editions) {
    const name = row.filename.slice(9);
    if (!uuidPdf.test(name) || ids.has(row.id) || names.has(name) || files.get(name) !== row.sha256) throw new Error("Backup edition/file mismatch.");
    ids.add(row.id); names.add(name);
  }
  if (files.size !== names.size || bundle.counts.PdfEdition !== ids.size) throw new Error("Backup edition count mismatch.");
  return bundle;
}
export function sealRecoveryBundle(value: unknown, key: string) {
  const secret = keyBytes(key);
  const bundle = validateRecoveryBundle(value);
  const json = Buffer.from(JSON.stringify(bundle));
  if (json.length > MAX) throw new Error("Backup exceeds rehearsal limit.");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret, nonce);
  cipher.setAAD(MAGIC);
  return Buffer.concat([MAGIC, nonce, cipher.update(gzipSync(json)), cipher.final(), cipher.getAuthTag()]);
}
export function openRecoveryBundle(bytes: Buffer, key: string) {
  const secret = keyBytes(key);
  if (bytes.length < MAGIC.length + 29 || bytes.length > MAX || !bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error("Invalid encrypted backup.");
  const decipher = createDecipheriv("aes-256-gcm", secret, bytes.subarray(MAGIC.length, MAGIC.length + 12));
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(bytes.subarray(-16));
  const plain = Buffer.concat([decipher.update(bytes.subarray(MAGIC.length + 12, -16)), decipher.final()]);
  // Authentication completes before decompression, parsing or any restore action.
  return validateRecoveryBundle(JSON.parse(gunzipSync(plain, { maxOutputLength: MAX }).toString("utf8")));
}
