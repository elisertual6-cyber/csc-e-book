import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { checkMailReadiness, MailReadinessError } from "../src/lib/mail-readiness";
import { processOperatorAccountMail } from "../src/lib/operator-mail";
import { recoverySourceConfiguration } from "../src/lib/recovery-source";
import { recoveryFailureReason } from "../src/lib/recovery-errors";

async function main() {
  let db: PrismaClient | undefined;
  let stage = "authorization";
  try {
    if (process.argv.slice(2).join(" ") !== "--send") throw new Error();
    stage = "configuration";
    await checkMailReadiness();
    const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const database = process.env.DATABASE_URL;
    if (!email || !database) throw new Error();
    const ca = process.env.DATABASE_CA_PEM?.trim() || await readFile(new URL("../.github/certs/supabase-root-2021.crt", import.meta.url), "utf8");
    const configuration = recoverySourceConfiguration(database, ca);
    db = new PrismaClient({ adapter: new PrismaPg(configuration.connection), log: [] });
    stage = "operator-account-dispatch";
    const result = await processOperatorAccountMail(db, email);
    console.log(JSON.stringify({ operatorMail: "processed", ...result }));
    // SMTP rejection or an unreadable payload must not be presented as a green delivery test.
    if (result.retried || result.failed) process.exitCode = 1;
  } catch (error) {
    console.error(JSON.stringify({ operatorMail: "failed", stage: error instanceof MailReadinessError ? error.stage : stage, reason: error instanceof MailReadinessError ? error.reason : recoveryFailureReason(error) }));
    process.exitCode = 1;
  } finally { await db?.$disconnect(); }
}
void main();
