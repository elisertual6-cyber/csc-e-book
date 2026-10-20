import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { orderAction } from "@/lib/commerce";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    assertMutation(request);
    const actor = await requireUser();
    await rateLimit("order-action", actor.id, 20);
    return json(
      await orderAction(actor, (await params).id, await readJson(request)),
    );
  });
}
