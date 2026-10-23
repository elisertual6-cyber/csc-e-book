import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";
import { applicationTables } from "../src/lib/schema-policy";

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Database connection unavailable.");
  const db = new Client({ connectionString: url, connectionTimeoutMillis: 10000, query_timeout: 15000 });
  await db.connect();
  try {
    const applied = (await db.query('SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations"')).rows;
    const names = readdirSync("prisma/migrations", { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    for (const name of names) {
      const checksum = createHash("sha256").update(readFileSync(`prisma/migrations/${name}/migration.sql`)).digest("hex");
      const row = applied.find(r => r.migration_name === name && r.finished_at && !r.rolled_back_at);
      if (!row || row.checksum !== checksum) throw new Error("Missing migration or checksum mismatch.");
    }
    if (applied.some(r => !r.finished_at && !r.rolled_back_at)) throw new Error("An unresolved migration is present.");
    const protectedTables = [...applicationTables, "_prisma_migrations"];
    const rows = (await db.query("SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND c.relkind='r'", [protectedTables])).rows;
    if (rows.length !== protectedTables.length || rows.some(r => !r.relrowsecurity)) throw new Error("Private application table policy is incomplete.");
    console.log(`Schema checks passed: ${names.length} migration checksums and ${rows.length} protected application/history tables. Content, payment and mail readiness are separate.`);
  } finally { await db.end(); }
}
main().catch(() => { console.error("Schema checks failed. Inspect migration state, connection permissions and table policies; no credentials or database errors logged."); process.exitCode = 1; });
