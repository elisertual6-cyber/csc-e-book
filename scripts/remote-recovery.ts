import "dotenv/config";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile, lstat } from "node:fs/promises";
import path from "node:path";
import { readPrivatePdf } from "../src/lib/pdf-storage";
import { canonical, recoveryHash, recoveryPayload, recoveryTables, sealRecoveryBundle, openRecoveryBundle, type RecoveryBundle } from "../src/lib/recovery-bundle";

// Explicit hosted SOURCE reads; all database restores use a disposable Docker container.
process.umask(0o077);
const id = randomUUID();
const started = Date.now();
const target = `csc_restore_${id.replaceAll("-", "")}`;
const bucket = `csc-restore-${id}`;
const passfile = `/tmp/csc-recovery-${id}.pgpass`;
let archiveCreated = false;
let stage = "configuration", container = "", createdDb = false, createdBucket = false, createdPassfile = false;
let source: Client | undefined;
let storage: { url: string; key: string };
const restoredNames: string[] = [];
function docker(args: string[], input?: Buffer | string, sourceEnvironment: string[] = []) {
  const result = spawnSync("docker", ["exec", "-i", "--env", `PGPORT=${process.env.RECOVERY_TARGET_PORT ?? "5432"}`, ...sourceEnvironment.flatMap(e => ["--env", e]), container, ...args], {
    input, encoding: undefined, maxBuffer: 64 * 1024 * 1024, timeout: 180_000, stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) throw new Error("Private database operation failed.");
  return result.stdout;
}
function sql(query: string) {
  if (!createdDb || !/^csc_restore_[a-f0-9]{32}$/.test(target)) throw new Error("Isolated target required.");
  return docker(["psql", "-X", "-U", "postgres", "-d", target, "-At", "-v", "ON_ERROR_STOP=1", "-c", query]).toString().trim();
}
async function request(suffix: string, init: RequestInit = {}, anonymous = false) {
  const response = await fetch(`${storage.url}/storage/v1/${suffix}`, {
    ...init, headers: anonymous ? undefined : { ...init.headers, apikey: storage.key, Authorization: `Bearer ${storage.key}` },
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  return response;
}
async function successful(response: Response) {
  if (!response.ok) { await response.body?.cancel().catch(() => {}); throw new Error("Private restore storage operation failed."); }
  return response;
}
async function privateTarget() {
  const response = await successful(await request(`bucket/${bucket}`));
  const data = await response.json();
  if (data.id !== bucket || data.public !== false) throw new Error("Restore bucket must remain private.");
}
async function boundedBytes(response: Response) {
  if (!response.body) throw new Error("Missing restored bytes.");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > 32 * 1024 * 1024) throw new Error("Restored object too large.");
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally { await reader.cancel().catch(() => {}); }
}
const payload = (bytes: Buffer) => ({ sha256: recoveryHash(bytes), base64: bytes.toString("base64") });
async function capture(): Promise<RecoveryBundle> {
  const url = new URL(process.env.RECOVERY_SOURCE_URL!);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password) throw new Error("Source configuration required.");
  const password = decodeURIComponent(url.password);
  if (/[\r\n\0]/.test(password)) throw new Error("Unsupported source password format.");
  docker(["sh", "-c", 'umask 077; set -C; cat > "$1"', "recovery", passfile], `*:*:*:*:${password.replaceAll("\\", "\\\\").replaceAll(":", "\\:")}\n`);
  createdPassfile = true;
  // Prisma URL options are not libpq parameters. Only libpq/TLS configuration is passed to pg_dump.
  const clean = new URL(url); clean.search = "";
  const configuredSsl = url.searchParams.get("sslmode");
  const sslmode = configuredSsl === "disable" && ["127.0.0.1", "localhost"].includes(url.hostname) ? "disable" : ["require", "verify-ca", "verify-full"].includes(configuredSsl ?? "") ? configuredSsl! : "require";
  clean.searchParams.set("sslmode", sslmode);
  source = new Client({ connectionString: clean.toString(), connectionTimeoutMillis: 15_000, query_timeout: 120_000 });
  source.on("error", () => { /* Later queries fail safely; never log source errors. */ });
  stage = "source-snapshot";
  await source.connect();
  await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await source.query("SET LOCAL TIME ZONE 'UTC'");
  const exported = (await source.query("SELECT pg_export_snapshot() AS id, transaction_timestamp() AS captured")).rows[0];
  const snapshot = exported.id as string;
  const capturedAt = (exported.captured as Date).toISOString();
  if (!/^[a-f0-9-]+$/i.test(snapshot)) throw new Error("Invalid exported snapshot.");
  const counts = {} as RecoveryBundle["counts"];
  for (const table of recoveryTables) counts[table] = Number((await source.query(`SELECT count(*) AS count FROM public."${table}"`)).rows[0].count);
  if (!counts.PdfEdition || counts.PdfEdition > 100) throw new Error("A nonempty bounded PDF set is required.");
  const editions = (await source.query('SELECT row_to_json(p) AS value FROM public."PdfEdition" p ORDER BY id')).rows.map(row => row.value);
  stage = "source-dump";
  const dump = docker(["pg_dump", "--format=custom", "--schema=public", "--no-owner", "--no-acl", `--snapshot=${snapshot}`, "--lock-wait-timeout=10000"], undefined, [
    `PGHOST=${url.hostname}`, `PGPORT=${url.port || "5432"}`, `PGUSER=${decodeURIComponent(url.username)}`,
    `PGDATABASE=${decodeURIComponent(url.pathname.slice(1))}`, `PGPASSFILE=${passfile}`, `PGSSLMODE=${clean.searchParams.get("sslmode")}`,
    "PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=120000", "PGTZ=UTC",
  ]);
  await source.query("COMMIT"); await source.end(); source = undefined;
  stage = "pdf-download";
  const files: RecoveryBundle["files"] = [];
  let size = 0;
  for (const row of editions) {
    if (!/^supabase:[a-f0-9-]{36}\.pdf$/.test(row.filename)) throw new Error("Legacy disk editions require a separate recovery procedure.");
    const bytes = await readPrivatePdf(row.filename);
    size += bytes.length; if (size > 64 * 1024 * 1024 || recoveryHash(bytes) !== row.sha256) throw new Error("PDF capture integrity/size failure.");
    files.push({ name: row.filename.slice(9), ...payload(bytes) });
  }
  return { version: 1, createdAt: capturedAt, revision: process.env.RECOVERY_REVISION!, counts, editions, dump: payload(dump), files };
}
async function restore(bundle: RecoveryBundle) {
  stage = "restore-database";
  docker(["createdb", "-U", "postgres", "-T", "template0", target]); createdDb = true;
  sql("DROP SCHEMA public");
  docker(["pg_restore", "-U", "postgres", "-d", target, "--exit-on-error", "--no-owner", "--no-acl"], recoveryPayload(bundle.dump));
  for (const table of recoveryTables) {
    if (Number(sql(`SELECT count(*) FROM public."${table}"`)) !== bundle.counts[table]) throw new Error("Restored table count mismatch.");
  }
  const rows = JSON.parse(sql('SELECT coalesce(json_agg(row_to_json(p) ORDER BY id), \'[]\'::json) FROM public."PdfEdition" p'));
  if (canonical(rows) !== canonical(bundle.editions)) throw new Error("Restored edition manifests differ.");
  const allowed = recoveryTables.map(name => `'${name}'`).join(",");
  const policyCount = Number(sql(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relname IN (${allowed})`));
  if (policyCount < recoveryTables.length) throw new Error("Restored RLS policy incomplete.");
  const migrations = JSON.parse(sql('SELECT coalesce(json_agg(json_build_object(\'name\',migration_name,\'checksum\',checksum) ORDER BY migration_name),\'[]\'::json) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'));
  const expected = [];
  for (const entry of await readdir("prisma/migrations", { withFileTypes: true })) if (entry.isDirectory()) expected.push({ name: entry.name, checksum: recoveryHash(await readFile(`prisma/migrations/${entry.name}/migration.sql`)) });
  if (canonical(migrations) !== canonical(expected.sort((a, b) => a.name.localeCompare(b.name)))) throw new Error("Restored migration checksums differ.");
  stage = "restore-storage";
  await successful(await request("bucket", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: bucket, name: bucket, public: false, file_size_limit: 33554432, allowed_mime_types: ["application/pdf"] }) }));
  createdBucket = true;
  await privateTarget();
  for (const file of bundle.files) {
    // Record the exact owned destination before upload to cover an ambiguous POST result.
    restoredNames.push(file.name);
    await successful(await request(`object/${bucket}/${file.name}`, { method: "POST", headers: { "Content-Type": "application/pdf", "x-upsert": "false" }, body: new Uint8Array(recoveryPayload(file)) }));
    const bytes = await boundedBytes(await successful(await request(`object/authenticated/${bucket}/${file.name}?cacheNonce=${randomUUID()}`)));
    if (recoveryHash(bytes) !== file.sha256) throw new Error("Restored PDF integrity failure.");
    for (const endpoint of ["public", "authenticated"]) {
      const response = await request(`object/${endpoint}/${bucket}/${file.name}`, {}, true);
      await response.body?.cancel().catch(() => {});
      if (![400, 401, 403, 404].includes(response.status)) throw new Error("Anonymous restore access was not denied.");
    }
  }
  await privateTarget();
  return { migrations: migrations.length, tables: recoveryTables.length, pdfs: bundle.files.length };
}
async function cleanup() {
  let failed = false;
  if (source) { try { await source.end(); } catch { failed = true; } }
  if (createdPassfile) { try { docker(["rm", "--", passfile]); } catch { failed = true; } }
  if (createdDb) { try { docker(["dropdb", "-U", "postgres", "--force", target]); } catch { failed = true; } }
  if (createdBucket) {
    try {
      if (restoredNames.length) await successful(await request(`object/${bucket}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: restoredNames }) }));
      await successful(await request(`bucket/${bucket}`, { method: "DELETE" }));
      const check = await request(`bucket/${bucket}`);
      if (check.status !== 404) {
        if (check.status !== 400 || String((await check.json()).statusCode) !== "404") throw new Error();
      } else await check.body?.cancel();
    } catch { failed = true; }
  }
  if (failed) throw new Error("Generated recovery resources require private operator cleanup.");
}
async function main() {
  let failure: string | undefined, result: Awaited<ReturnType<typeof restore>> | undefined;
  try {
    const args = process.argv.slice(2);
    const restorePath = args.length === 3 && args[0] === "--restore-archive" && args[2] === "--apply" ? args[1] : undefined;
    const captureRequested = args.join(" ") === "--apply --objects-stable";
    if ((!captureRequested && !restorePath) || process.env.PDF_STORAGE !== "supabase" || !/^[a-fA-F0-9]{64}$/.test((process.env.BACKUP_ENCRYPTION_KEY ?? "").trim()) || (captureRequested && !process.env.RECOVERY_SOURCE_URL) || !/^[a-f0-9]{40}$/.test(process.env.RECOVERY_REVISION ?? "")) throw new Error("Explicit recovery configuration is required.");
    if (!/^\d{1,5}$/.test(process.env.RECOVERY_TARGET_PORT ?? "5432") || Number(process.env.RECOVERY_TARGET_PORT ?? 5432) > 65535) throw new Error("Invalid target port.");
    container = process.env.RECOVERY_CONTAINER_ID ?? "";
    if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error("Disposable container ID required.");
    const inspection = spawnSync("docker", ["inspect", "--format", '{{ index .Config.Labels "csc.recovery" }}', container], { encoding: "utf8", timeout: 15_000 });
    if (inspection.status !== 0 || inspection.stdout.trim() !== "temporary") throw new Error("Marked disposable recovery container required.");
    const url = process.env.PDF_SUPABASE_URL ?? "", key = process.env.PDF_SUPABASE_SERVICE_KEY ?? "";
    if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url) || !key || /\s/.test(key)) throw new Error("Private storage configuration required.");
    storage = { url, key };
    let archive: Buffer;
    if (restorePath) {
      stage = "archive-authentication";
      const info = await lstat(restorePath);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 256 * 1024 * 1024) throw new Error("A bounded regular archive file is required.");
      archive = await readFile(restorePath);
    } else {
      const bundle = await capture();
      stage = "encrypt";
      archive = sealRecoveryBundle(bundle, process.env.BACKUP_ENCRYPTION_KEY!);
      const output = path.resolve(".local/recovery-output");
      await mkdir(output, { recursive: true, mode: 0o700 });
      const archiveDirectory = path.join(output, id);
      await mkdir(archiveDirectory, { mode: 0o700 });
      const archivePath = path.join(archiveDirectory, "private-recovery.cscbak");
      await writeFile(archivePath, archive, { mode: 0o600, flag: "wx" });
      archiveCreated = true;
      // Read the actual saved archive; no restore uses the in-memory source copy.
      archive = await readFile(archivePath);
    }
    stage = "archive-authentication";
    const recovered = openRecoveryBundle(archive, process.env.BACKUP_ENCRYPTION_KEY!);
    if (recovered.revision !== process.env.RECOVERY_REVISION) throw new Error("Restore requires the backup's trusted source revision.");
    result = await restore(recovered);
  } catch { failure = stage; }
  finally { try { await cleanup(); } catch { failure = "cleanup"; } }
  if (failure) {
    console.error(JSON.stringify({ recovery: "failed", stage: failure, recoveryId: id }));
    process.exitCode = 1;
  } else console.log(JSON.stringify({ recovery: "verified", recoveryId: id, ...result, encryptedArchive: archiveCreated ? "created" : "authenticated", isolatedResources: "removed", durationMs: Date.now() - started }));
}
void main();
