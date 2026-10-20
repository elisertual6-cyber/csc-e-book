import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile, copyFile, chmod, lstat, rm } from "node:fs/promises";
import path from "node:path";

// Local Compose only: never interpolates a connection URL or credentials into argv.
process.umask(0o077);
const root = path.resolve(".local/backups");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function pg(script, args = [], options = {}) {
  const result = spawnSync("docker", ["compose", "exec", "-T", "db", "sh", "-c", script, "backup", ...args], { ...options, maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error("Local PostgreSQL backup/restore command failed; no credentials or database output logged.");
  return result.stdout?.toString() ?? "";
}
async function privateFile(filename) {
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Backup contains a non-regular file.");
  return readFile(filename);
}
async function checkDirectory(directory) {
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("Backup directory must be a real directory.");
}
async function backup() {
  if (!process.argv.includes("--writes-paused")) throw new Error("Pause app and worker writes first, then pass --writes-paused. The database and PDF directory must stay consistent.");
  await mkdir(root, { recursive: true, mode: 0o700 });
  await checkDirectory(root);
  const id = randomUUID();
  const target = path.join(root, id);
  await mkdir(target, { mode: 0o700 });
  try {
    const dump = path.join(target, "database.dump");
    const fd = openSync(dump, "wx", 0o600);
    try {
      pg('exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl', [], { stdio: ["ignore", fd, "pipe"] });
    } finally { closeSync(fd); }
    const files = { "database.dump": hash(await privateFile(dump)) };
    const source = path.resolve(process.env.PDF_PRIVATE_DIR ?? ".local/editions");
    await mkdir(path.join(target, "editions"), { mode: 0o700 });
    let entries = [];
    try { await checkDirectory(source); entries = await readdir(source); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    for (const filename of entries) {
      if (!/^[a-zA-Z0-9-]+\.pdf$/.test(filename)) throw new Error("Unexpected entry in private PDF storage; backup aborted.");
      const bytes = await privateFile(path.join(source, filename));
      const relative = `editions/${filename}`;
      await copyFile(path.join(source, filename), path.join(target, relative));
      await chmod(path.join(target, relative), 0o600);
      if (hash(await privateFile(path.join(target, relative))) !== hash(bytes)) throw new Error("PDF changed during backup; pause writers and retry.");
      files[relative] = hash(bytes);
    }
    await writeFile(path.join(target, "manifest.json"), JSON.stringify({ version: 1, createdAt: new Date().toISOString(), files }, null, 2), { mode: 0o600, flag: "wx" });
    console.log(`Local backup created: .local/backups/${id}`);
    console.log("Contains sensitive, unencrypted data. Keep private; back up encryption keys separately. Run backup:verify before relying on it.");
  } catch (error) { await rm(target, { recursive: true, force: true }); throw error; }
}
async function verify(id) {
  if (!uuid.test(id ?? "")) throw new Error("Pass the generated backup UUID, not a filesystem path.");
  await checkDirectory(root);
  const target = path.join(root, id);
  await checkDirectory(target);
  await checkDirectory(path.join(target, "editions"));
  const manifest = JSON.parse(await privateFile(path.join(target, "manifest.json")));
  if (manifest.version !== 1 || !manifest.files || !Object.hasOwn(manifest.files, "database.dump")) throw new Error("Unsupported backup manifest.");
  for (const [filename, digest] of Object.entries(manifest.files)) {
    if (filename !== "database.dump" && !/^editions\/[a-zA-Z0-9-]+\.pdf$/.test(filename)) throw new Error("Unsafe manifest filename.");
    if (!/^[a-f0-9]{64}$/.test(digest) || hash(await privateFile(path.join(target, filename))) !== digest) throw new Error("Backup checksum mismatch; restore refused.");
  }
  const database = `csc_restore_${randomUUID().replaceAll("-", "")}`;
  let created = false;
  try {
    pg('exec createdb -U "$POSTGRES_USER" -T template0 "$1"', [database]);
    created = true;
    const fd = openSync(path.join(target, "database.dump"), "r");
    try {
      pg('exec pg_restore -U "$POSTGRES_USER" -d "$1" --exit-on-error --no-owner --no-acl', [database], { stdio: [fd, "pipe", "pipe"] });
    } finally { closeSync(fd); }
    const query = `SELECT json_build_object('migrations', (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL), 'chapters', (SELECT count(*) FROM "Chapter"), 'editions', (SELECT coalesce(json_agg(json_build_object('filename', filename, 'sha256', sha256)), '[]'::json) FROM "PdfEdition"))`;
    const report = pg('exec psql -X -U "$POSTGRES_USER" -d "$1" -A -t -v ON_ERROR_STOP=1 -c "$2"', [database, query]);
    const result = JSON.parse(report);
    const migrationCount = (await readdir("prisma/migrations", { withFileTypes: true })).filter((entry) => entry.isDirectory()).length;
    if (Number(result.migrations) !== migrationCount || Number(result.chapters) < 1) throw new Error("Restored schema/content checks failed.");
    for (const edition of result.editions) {
      if (manifest.files[`editions/${edition.filename}`] !== edition.sha256) throw new Error("Restored PDF record has missing or mismatched bytes.");
    }
    console.log(`Restore drill passed: ${result.migrations} migrations, ${result.chapters} chapters, ${result.editions.length} PDF records verified. Isolated database removed.`);
  } finally {
    if (created && /^csc_restore_[a-f0-9]{32}$/.test(database)) pg('exec dropdb -U "$POSTGRES_USER" --force "$1"', [database]);
  }
}
try {
  if (process.argv[2] === "create") await backup();
  else if (process.argv[2] === "verify") await verify(process.argv[3]);
  else throw new Error("Use backup:local or backup:verify -- <backup-uuid>.");
} catch (error) {
  console.error(error instanceof SyntaxError ? "Invalid backup manifest." : error.message);
  process.exitCode = 1;
}
