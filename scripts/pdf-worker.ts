import "dotenv/config";
import { readFile, stat } from "node:fs/promises";
import { getDb } from "../src/lib/db";
import { editionInput } from "../src/lib/pdf-input";
import { generateEdition } from "../src/lib/pdf";

// One explicit job per process; no HTTP listener or arbitrary HTML/URL inputs.
async function main() {
  const db = getDb();
  try {
    const [file, ...extra] = process.argv.slice(2);
    if (!file || extra.length || !process.env.PDF_OPERATOR_EMAIL || !process.env.DATABASE_URL || process.env.VERCEL)
      throw new Error("Worker configuration required.");
    if ((await stat(file)).size > 128_000) throw new Error("Job too large.");
    const input = editionInput.parse(JSON.parse(await readFile(file, "utf8")));
    const result = await db.$transaction(async (tx) => {
      // Cross-process worker lock. A failed/terminated process releases it.
      const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('pdf-render-worker')) AS locked`;
      if (!lock.locked) throw new Error("Worker busy.");
      const actor = await tx.user.findUnique({ where: { email: process.env.PDF_OPERATOR_EMAIL!.trim().toLowerCase() } });
      if (!actor || !["ADMIN", "EDITOR", "REVIEWER"].includes(actor.role)) throw new Error("Current staff account required.");
      // Lock the role while generating; the service rechecks release eligibility.
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${actor.id} FOR SHARE`;
      const current = await tx.user.findUniqueOrThrow({ where: { id: actor.id } });
      return generateEdition(current, input);
    }, { timeout: 120_000, maxWait: 5_000 });
    console.log(JSON.stringify({ editionId: result.id, kind: result.kind, version: result.version }));
  } catch {
    console.error("PDF job failed. Check private worker configuration, current staff role, content eligibility, job validation and storage. No edition was released by this command.");
    process.exitCode = 1;
  } finally { await db.$disconnect(); }
}
void main();
