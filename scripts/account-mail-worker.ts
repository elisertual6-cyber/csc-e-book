import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { checkMailReadiness } from "../src/lib/mail-readiness";
import { processMailBatch } from "../src/lib/mail";
import { recoverySourceConfiguration } from "../src/lib/recovery-source";

async function main() {
  let db: PrismaClient | undefined;
  let stage = "authorization";
  try {
    if (process.argv.slice(2).join(" ") !== "--send" || process.env.ACCOUNT_MAIL_AUTOMATION !== "true") throw new Error();
    stage = "configuration";
    await checkMailReadiness();
    if (!process.env.DATABASE_URL) throw new Error();
    const ca = process.env.DATABASE_CA_PEM?.trim() || await readFile(new URL("../.github/certs/supabase-root-2021.crt", import.meta.url), "utf8");
    db = new PrismaClient({ adapter: new PrismaPg(recoverySourceConfiguration(process.env.DATABASE_URL, ca).connection), log: [] });
    stage = "account-queue";
    const result = await processMailBatch(db, 10, { accountOnly: true });
    console.log(JSON.stringify({ accountMail: "processed", ...result }));
    if (result.retried || result.failed) process.exitCode = 1;
  } catch {
    console.error(JSON.stringify({ accountMail: "failed", stage }));
    process.exitCode = 1;
  } finally {
    try { await db?.$disconnect(); }
    catch {
      console.error(JSON.stringify({ accountMail: "failed", stage: "disconnect" }));
      process.exitCode = 1;
    }
  }
}
void main();
