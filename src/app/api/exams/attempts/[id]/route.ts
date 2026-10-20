import { z } from "zod";
import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { getAttempt, saveResponses, submitAttempt } from "@/lib/exams";
type Context = { params: Promise<{ id: string }> };
const idSchema = z.string().min(1).max(100);
export async function GET(_request: Request, { params }: Context) {
  return api(async () => {
    const actor = await requireUser();
    await rateLimit("exam-read", actor.id, 90);
    return json(await getAttempt(actor, idSchema.parse((await params).id)));
  });
}
export async function PATCH(request: Request, { params }: Context) {
  return api(async () => {
    assertMutation(request);
    const actor = await requireUser();
    await rateLimit("exam-save", actor.id, 120);
    return json(
      await saveResponses(
        actor,
        idSchema.parse((await params).id),
        await readJson(request),
      ),
    );
  });
}
export async function POST(request: Request, { params }: Context) {
  return api(async () => {
    assertMutation(request);
    const actor = await requireUser();
    await rateLimit("exam-submit", actor.id, 20);
    z.object({ action: z.literal("submit") })
      .strict()
      .parse(await readJson(request));
    return json(await submitAttempt(actor, idSchema.parse((await params).id)));
  });
}
