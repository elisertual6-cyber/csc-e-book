import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "./http";

const MAX_BYTES = 32 * 1024 * 1024;
const filenamePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.pdf$/;
const unavailable = () => new HttpError(503, "Private PDF storage is unavailable.");

export function pdfStorageMode() {
  const mode = process.env.PDF_STORAGE ?? "disk";
  if (mode !== "disk" && mode !== "supabase") throw unavailable();
  if (process.env.VERCEL && mode === "disk") throw unavailable();
  return mode;
}
function directory() {
  const result = path.resolve(process.env.PDF_PRIVATE_DIR ?? ".local/editions");
  for (const exposed of [path.resolve("public"), path.resolve(".next/static")])
    if (result === exposed || result.startsWith(exposed + path.sep)) throw unavailable();
  return result;
}
function remoteConfig() {
  const url = process.env.PDF_SUPABASE_URL ?? "";
  const bucket = process.env.PDF_SUPABASE_BUCKET ?? "";
  const key = process.env.PDF_SUPABASE_SERVICE_KEY ?? "";
  // Fixed hosted origin only: credentials cannot be sent to arbitrary URLs/proxies.
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url) ||
      !/^[a-z0-9][a-z0-9-]{0,62}$/.test(bucket) || !key || /\s/.test(key)) throw unavailable();
  return { url, bucket, key };
}
async function remoteRequest(suffix: string, init: RequestInit = {}) {
  const { url, key } = remoteConfig();
  try {
    return await fetch(`${url}/storage/v1/${suffix}`, {
      ...init,
      headers: { ...init.headers, apikey: key, Authorization: `Bearer ${key}` },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
  } catch { throw unavailable(); }
}
async function privateBucket() {
  const { bucket } = remoteConfig();
  const response = await remoteRequest(`bucket/${bucket}`);
  if (!response.ok) throw unavailable();
  let data;
  try { data = await response.json(); } catch { throw unavailable(); }
  if (data?.id !== bucket || data.public !== false) throw unavailable();
  return bucket;
}
function reference(value: string) {
  const remote = value.startsWith("supabase:");
  const name = remote ? value.slice(9) : value;
  if (!filenamePattern.test(name)) throw new HttpError(404, "PDF file unavailable.");
  return { remote, name };
}
export async function writePrivatePdf(name: string, bytes: Buffer) {
  reference(name);
  if (!filenamePattern.test(name) || !bytes.length || bytes.length > MAX_BYTES) throw unavailable();
  if (pdfStorageMode() === "disk") {
    await mkdir(directory(), { recursive: true, mode: 0o700 });
    await writeFile(path.join(directory(), name), bytes, { mode: 0o600, flag: "wx" });
    return name;
  }
  const bucket = await privateBucket();
  const response = await remoteRequest(`object/${bucket}/${name}`, {
    method: "POST", headers: { "Content-Type": "application/pdf", "x-upsert": "false" },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) throw unavailable();
  return `supabase:${name}`;
}
export async function readPrivatePdf(value: string) {
  const { remote, name } = reference(value);
  if (!remote) {
    if (process.env.VERCEL) throw unavailable();
    try { return await readFile(path.join(directory(), name)); }
    catch { throw new HttpError(404, "Private PDF file unavailable."); }
  }
  const bucket = await privateBucket();
  const response = await remoteRequest(`object/authenticated/${bucket}/${name}`);
  if (response.status === 404) throw new HttpError(404, "Private PDF file unavailable.");
  if (!response.ok || !response.body) throw unavailable();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.length;
      if (size > MAX_BYTES) throw unavailable();
      chunks.push(chunk);
    }
    if (!size) throw unavailable();
    return Buffer.concat(chunks);
  } catch { throw unavailable(); }
  finally { await reader.cancel().catch(() => {}); }
}
// Only for rolling back a new upload whose database transaction failed.
export async function removePrivatePdf(value: string) {
  const { remote, name } = reference(value);
  if (!remote) { await unlink(path.join(directory(), name)); return; }
  const bucket = await privateBucket();
  const response = await remoteRequest(`object/${bucket}`, {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [name] }),
  });
  if (!response.ok) throw unavailable();
}
