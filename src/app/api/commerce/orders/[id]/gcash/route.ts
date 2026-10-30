import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { beginGcash, refreshGcash } from "@/lib/gcash";
import { z } from "zod";
import { schedulePurchaseMail } from "@/lib/purchase-mail-delivery";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return api("commerce", async () => {
    assertMutation(request);
    const actor = await requireUser();
    await rateLimit("gcash-customer", actor.id, 20);
    const input = z
      .object({ action: z.enum(["checkout", "refresh"]) })
      .strict()
      .parse(await readJson(request));
    const id = (await params).id;
    const result = await (input.action === "checkout"
        ? beginGcash(actor, id)
        : refreshGcash(actor, id));
    if ("orderId" in result) schedulePurchaseMail(result);
    return json(result);
  });
}
