import "dotenv/config";
import { z } from "zod";
import { getDb } from "../src/lib/db";
import { HttpError } from "../src/lib/http";
import { activateUnreviewedTimedMocks } from "../src/lib/timed-mock-release";
async function main() {
  if (process.argv.slice(2).join(" ") !== "--apply") throw new HttpError(400, "Use --apply to activate the two free timed mocks as unreviewed practice.");
  const email = z.email().max(254).safeParse(process.env.ADMIN_EMAIL?.trim());
  if (!email.success || !process.env.DATABASE_URL) throw new HttpError(400, "Configure the intended database and administrator email privately.");
  const actor = await getDb().user.findUnique({ where: { email: email.data.toLowerCase() }, select: { id: true, role: true } });
  if (!actor) throw new HttpError(403, "A current matching ADMIN is required.");
  const result = await activateUnreviewedTimedMocks(actor);
  console.log(`Activated ${result.activated} of ${result.sessions} timed mocks as UNREVIEWED practice (${result.questionCount} questions, ${result.durationMinutes} minutes each). Editorial statuses and reviews were preserved.`);
}
void main().catch(error => { console.error(error instanceof HttpError ? error.message : "Timed mock activation failed and rolled back; no private details were logged."); process.exitCode = 1; })
  .finally(() => getDb().$disconnect());
