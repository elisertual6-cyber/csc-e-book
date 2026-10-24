import "dotenv/config";
import { checkMailReadiness, MailReadinessError } from "../src/lib/mail-readiness";
async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--connect")) {
    console.error("Use mail:check for offline configuration checks, or mail:check -- --connect for SMTP verification without sending email.");
    process.exitCode = 1; return;
  }
  try { console.log(JSON.stringify(await checkMailReadiness(args[0] === "--connect"))); }
  catch (error) {
    console.error(JSON.stringify({ mailReadiness: "failed", stage: error instanceof MailReadinessError ? error.stage : "configuration", reason: error instanceof MailReadinessError ? error.reason : "unknown", ...(error instanceof MailReadinessError && error.issues.length ? { issues: error.issues } : {}) }));
    process.exitCode = 1;
  }
}
void main();
