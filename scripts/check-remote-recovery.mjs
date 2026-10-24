import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawnSync, spawn } from "node:child_process";
import { createServer } from "node:net";
import { readFile, rm, mkdtemp, writeFile } from "node:fs/promises";
import { Client } from "pg";
import { once } from "node:events";
import path from "node:path";
import { tmpdir } from "node:os";
process.umask(0o077);

// A new Postgres container and new key/credentials for every test. Never reads .env.
const name = `csc-recovery-test-${randomUUID()}`;
const password = randomBytes(32).toString("hex");
let container, client, tlsDirectory;
const archives = new Set();
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, env: { ...process.env, POSTGRES_PASSWORD: password } });
  if (result.error || result.status !== 0) throw new Error("Disposable recovery database operation failed.");
  return result.stdout.trim();
}
async function run(args, env, expectedStatus = 0) {
  const child = spawn(process.execPath, args, { env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", bytes => { output += bytes.toString(); });
  child.stderr.on("data", bytes => { output += bytes.toString(); });
  const [status] = await once(child, "exit");
  const summary = output.split("\n").find(line => line.startsWith('{"recovery":'));
  if (summary) {
    try { const parsed = JSON.parse(summary); if (/^[a-f0-9-]{36}$/.test(parsed.recoveryId)) archives.add(parsed.recoveryId); } catch { /* Invalid reports are rejected below. */ }
  }
  if (status !== expectedStatus) {
    // Child tools may include connection metadata in errors; do not echo their raw output.
    const report = output.split("\n").find(line => line.startsWith('{"recovery":'));
    throw new Error(`Disposable recovery test failed${report ? `: ${report}` : "."}`);
  }
  return output;
}
try {
  const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  container = docker(["run", "-d", "--name", name, "--label", "csc.recovery=temporary", "--network", "host", "-e", "POSTGRES_PASSWORD", "postgres:17-alpine", "postgres", "-p", String(port), "-c", "listen_addresses=127.0.0.1"]);
  // pg tools inside this container must use its selected port too.
  const url = `postgresql://postgres:${password}@127.0.0.1:${port}/postgres?sslmode=disable`;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { client = new Client({ connectionString: url }); await client.connect(); break; }
    catch { await client?.end().catch(() => {}); client = undefined; await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  if (!client) throw new Error("Disposable recovery database did not start.");
  const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, RECOVERY_SOURCE_URL: url,
    RECOVERY_CONTAINER_ID: container, RECOVERY_REVISION: "a".repeat(40), BACKUP_ENCRYPTION_KEY: randomBytes(32).toString("hex"), RECOVERY_SOURCE_CA_PEM: "",
    PDF_STORAGE: "supabase", PDF_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co", PDF_SUPABASE_BUCKET: "private-editions",
    PDF_SUPABASE_SERVICE_KEY: "fixture-recovery-key", RECOVERY_TEST_MODE: "disposable", RECOVERY_TEST_CORRUPT_RESTORE: "false", VERCEL: "", RECOVERY_TARGET_PORT: String(port),
  };
  await run(["node_modules/prisma/build/index.js", "migrate", "deploy"], env);
  const file = "12345678-1234-1234-1234-123456789abc.pdf";
  const hash = createHash("sha256").update("%PDF-synthetic-recovery-proof").digest("hex");
  await client.query('INSERT INTO "User" (id,email,"passwordHash",name,role,"updatedAt") VALUES ($1,$2,$3,$4,$5,now())', ["recovery-author", "synthetic-recovery@example.test", "not-a-login-credential", "Synthetic recovery author", "ADMIN"]);
  await client.query('INSERT INTO "PdfEdition" (id,kind,version,title,"creatorId",filename,sha256,manifest) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', ["recovery-edition", "DRAFT", "synthetic-1", "Synthetic recovery proof", "recovery-author", `supabase:${file}`, hash, { lessons: [], questions: [] }]);
  const before = await client.query('SELECT row_to_json(p) AS value FROM "PdfEdition" p');
  const output = await run(["--conditions=react-server", "--import", "./scripts/recovery-test-storage.mjs", "--import", "tsx", "scripts/remote-recovery.ts", "--apply", "--objects-stable"], env);
  const report = JSON.parse(output.split("\n").find(line => line.startsWith('{"recovery":')));
  const archiveId = report.recoveryId;
  archives.add(archiveId);
  if (report.recovery !== "verified" || report.pdfs !== 1 || report.tables !== 29 || report.migrations !== 8) throw new Error("Unexpected recovery report.");
  // Existing encrypted archives can be rehearsed without reconnecting to the source DB.
  const restoreArgs = ["--conditions=react-server", "--import", "./scripts/recovery-test-storage.mjs", "--import", "tsx", "scripts/remote-recovery.ts", "--restore-archive", `.local/recovery-output/${archiveId}/private-recovery.cscbak`, "--apply"];
  const restoredOutput = await run(restoreArgs, { ...env, RECOVERY_SOURCE_URL: "", RECOVERY_TEST_CORRUPT_RESTORE: "false" });
  if (!restoredOutput.includes('"encryptedArchive":"authenticated"')) throw new Error("Saved archive recovery failed.");
  const failedOutput = await run(restoreArgs, { ...env, RECOVERY_SOURCE_URL: "", RECOVERY_TEST_CORRUPT_RESTORE: "true" }, 1);
  if (!failedOutput.includes('"stage":"restore-storage"') || failedOutput.includes("fixture isolation/cleanup check failed")) throw new Error("Corrupted restore was not safely refused/cleaned.");
  const badSource = new URL(url); badSource.username = "missing_recovery_role"; badSource.password = randomBytes(32).toString("hex");
  const deniedOutput = await run(["--conditions=react-server", "--import", "./scripts/recovery-test-storage.mjs", "--import", "tsx", "scripts/remote-recovery.ts", "--apply", "--objects-stable"], { ...env, RECOVERY_SOURCE_URL: badSource.toString() }, 1);
  if (!deniedOutput.includes('"stage":"source-connect"') || !deniedOutput.includes('"reason":"database_authentication"') || deniedOutput.includes(badSource.password) || deniedOutput.includes(badSource.username)) throw new Error("Failed source connection was not safely diagnosed.");
  // Exercise the real Node + libpq TLS paths against a private fixture CA.
  tlsDirectory = await mkdtemp(path.join(tmpdir(), "csc-recovery-tls-"));
  const caKey = path.join(tlsDirectory, "ca.key"), caCert = path.join(tlsDirectory, "ca.pem");
  const serverKey = path.join(tlsDirectory, "server.key"), csr = path.join(tlsDirectory, "server.csr"), serverCert = path.join(tlsDirectory, "server.pem"), extensions = path.join(tlsDirectory, "server.ext");
  function openssl(args) {
    const result = spawnSync("openssl", args, { stdio: "ignore", timeout: 30_000 });
    if (result.error || result.status !== 0) throw new Error("Disposable TLS certificate generation failed.");
  }
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-keyout", caKey, "-out", caCert, "-subj", "/CN=CSC Recovery Test CA", "-addext", "basicConstraints=critical,CA:TRUE"]);
  openssl(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", serverKey, "-out", csr, "-subj", "/CN=localhost"]);
  await writeFile(extensions, "subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n", { mode: 0o600 });
  openssl(["x509", "-req", "-in", csr, "-CA", caCert, "-CAkey", caKey, "-CAcreateserial", "-out", serverCert, "-days", "2", "-extfile", extensions]);
  for (const [local, remote] of [[serverKey, "/tmp/csc-recovery-fixture.key"], [serverCert, "/tmp/csc-recovery-fixture.pem"]]) {
    docker(["exec", "-i", container, "sh", "-c", 'umask 077; cat > "$1"; chown postgres:postgres "$1"', "fixture", remote], await readFile(local));
  }
  await client.query("ALTER SYSTEM SET ssl_cert_file = '/tmp/csc-recovery-fixture.pem'");
  await client.query("ALTER SYSTEM SET ssl_key_file = '/tmp/csc-recovery-fixture.key'");
  await client.query("ALTER SYSTEM SET ssl = 'on'");
  await client.query("SELECT pg_reload_conf()");
  const ca = await readFile(caCert, "utf8");
  let tlsReady = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const check = new Client({ host: "127.0.0.1", port, user: "postgres", password, database: "postgres", ssl: { ca, rejectUnauthorized: true } });
    try { await check.connect(); tlsReady = true; break; }
    catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    finally { await check.end().catch(() => {}); }
  }
  if (!tlsReady) throw new Error("Disposable TLS server did not start.");
  const tlsUrl = new URL(url); tlsUrl.searchParams.set("sslmode", "verify-full");
  const captureArgs = ["--conditions=react-server", "--import", "./scripts/recovery-test-storage.mjs", "--import", "tsx", "scripts/remote-recovery.ts", "--apply", "--objects-stable"];
  const untrustedOutput = await run(captureArgs, { ...env, RECOVERY_SOURCE_URL: tlsUrl.toString() }, 1);
  if (!untrustedOutput.includes('"reason":"tls_certificate"')) throw new Error("Unknown CA was not rejected.");
  const trustedOutput = await run(captureArgs, { ...env, RECOVERY_SOURCE_URL: tlsUrl.toString(), RECOVERY_SOURCE_CA_PEM: ca });
  if (!trustedOutput.includes('"recovery":"verified"') || trustedOutput.includes("SECURITY WARNING")) throw new Error("Verified Node/libpq TLS recovery failed.");
  const after = await client.query('SELECT row_to_json(p) AS value FROM "PdfEdition" p');
  if (JSON.stringify(before.rows) !== JSON.stringify(after.rows)) throw new Error("Source edition records changed.");
  const leftovers = (await client.query("SELECT datname FROM pg_database WHERE datname LIKE 'csc_restore_%'")).rows;
  if (leftovers.length) throw new Error("Temporary restore database was not removed.");
  const archive = await readFile(`.local/recovery-output/${archiveId}/private-recovery.cscbak`);
  if (archive.includes(Buffer.from("Synthetic recovery proof")) || archive.includes(Buffer.from(password))) throw new Error("Backup was not encrypted.");
  console.log("Disposable recovery passed: shared snapshot dump, 29 restored table counts/RLS, 8 migration checksums, exact edition metadata and PDF bytes, anonymous denial, encrypted archive, rejected unknown CA and verified Node/libpq TLS with source/cleanup isolation.");
} finally {
  await client?.end().catch(() => {});
  if (container) docker(["rm", "-f", "-v", container]);
  if (tlsDirectory) await rm(tlsDirectory, { recursive: true, force: true });
  for (const archiveId of archives) if (/^[a-f0-9-]{36}$/.test(archiveId)) await rm(`.local/recovery-output/${archiveId}`, { recursive: true, force: true });
}
