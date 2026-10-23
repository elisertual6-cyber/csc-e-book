import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { startAttempt } from "@/lib/exams";
export async function POST(request: Request) {
  return api("exam", async () => {
    assertMutation(request);
    const actor = await requireUser();
    await rateLimit("exam-start", actor.id, 10);
    return json(await startAttempt(actor, await readJson(request)), 201);
  });
}
