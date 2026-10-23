import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applicationTables } from "../src/lib/schema-policy";
describe("Supabase public schema boundaries", () => {
  it("requires privacy coverage for every Prisma application model", () => {
    const models = [...readFileSync("prisma/schema.prisma", "utf8").matchAll(/^model (\w+) \{/gm)].map(m => m[1]);
    expect([...applicationTables].sort()).toEqual(models.sort());
    const migration = readFileSync("prisma/migrations/202610230008_private_app_tables/migration.sql", "utf8");
    for (const name of [...models, "_prisma_migrations"]) expect(migration).toContain(`'${name}'`);
  });
});
