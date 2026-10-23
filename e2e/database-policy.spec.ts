import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { applicationTables } from "../src/lib/schema-policy";
test("browser API roles cannot read server-owned tables even when granted SELECT", async () => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  expect(url.pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/);
  const db = new Client({ connectionString: url.toString() });
  const role = `csc_api_probe_${randomBytes(10).toString("hex")}`;
  let created = false;
  await db.connect();
  try {
    expect(Number((await db.query('SELECT count(*) FROM public."Chapter"')).rows[0].count)).toBeGreaterThanOrEqual(25);
    await db.query(`CREATE ROLE "${role}" NOLOGIN NOSUPERUSER NOBYPASSRLS`);
    created = true;
    for (const table of [...applicationTables, "_prisma_migrations"]) await db.query(`GRANT SELECT ON public."${table}" TO "${role}"`);
    await db.query(`SET ROLE "${role}"`);
    for (const table of [...applicationTables, "_prisma_migrations"]) expect((await db.query(`SELECT * FROM public."${table}" LIMIT 1`)).rows).toEqual([]);
    await db.query("RESET ROLE");
    expect(Number((await db.query('SELECT count(*) FROM public."Chapter"')).rows[0].count)).toBeGreaterThanOrEqual(25);
  } finally {
    await db.query("RESET ROLE");
    if (created) {
      await db.query(`DROP OWNED BY "${role}"`);
      await db.query(`DROP ROLE "${role}"`);
    }
    await db.end();
  }
});
