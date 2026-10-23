import { api, json } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { attemptHistory } from "@/lib/exams";
export async function GET() {
  return api("exam", async () => {
    const actor = await requireUser();
    await rateLimit("exam-history", actor.id, 30);
    return json(await attemptHistory(actor));
  });
}
