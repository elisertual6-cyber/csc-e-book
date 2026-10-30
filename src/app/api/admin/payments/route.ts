import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { reconcileGcash } from "@/lib/gcash";
import { schedulePurchaseMail } from "@/lib/purchase-mail-delivery";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  return api("admin", async () => {
    assertMutation(request);
    const actor = await requireUser(["ADMIN"]);
    await rateLimit("gcash-admin", actor.id, 20);
    const result = await reconcileGcash(actor, await readJson(request));
    if ("orderId" in result) schedulePurchaseMail(result);
    return json(result);
  });
}
