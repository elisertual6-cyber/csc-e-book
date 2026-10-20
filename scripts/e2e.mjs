import "dotenv/config";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
const base = process.env.E2E_DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!base)
  throw new Error(
    "DATABASE_URL is required to provision an isolated browser-test database.",
  );
const name = `csc_e2e_${randomBytes(8).toString("hex")}`;
const url = new URL(base);
url.pathname = `/${name}`;
const privateDir = path.resolve(".local/e2e", name);
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  APP_URL: "http://127.0.0.1:3100",
  PDF_PRIVATE_DIR: privateDir,
  MAIL_PRIVATE_DIR: path.join(privateDir, "mail"),
  MAIL_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  MAIL_TRANSPORT: "disabled",
};
const admin = new Client({ connectionString: base });
let created = false;
function run(args) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error("A test setup or runner command failed.");
    error.exitCode = result.status ?? 1;
    throw error;
  }
}
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
  run(["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"]);
  run([
    "node_modules/@playwright/test/cli.js",
    "test",
    ...process.argv.slice(2),
  ]);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Browser tests failed.",
  );
  process.exitCode = error.exitCode ?? 1;
} finally {
  if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
  await admin.end();
  await rm(privateDir, { recursive: true, force: true });
}
