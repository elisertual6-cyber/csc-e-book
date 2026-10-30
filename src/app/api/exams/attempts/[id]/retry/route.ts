import { z } from "zod";
import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { retryAttempt } from "@/lib/exams";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  return api("exam", async () => {
    assertMutation(request);
    const actor = await requireUser();
    await rateLimit("exam-start", actor.id, 10);
    return json(await retryAttempt(actor, z.string().min(1).max(100).parse((await params).id), await readJson(request)), 201);
  });
}
