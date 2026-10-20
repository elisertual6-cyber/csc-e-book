import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { reconcileGcash } from "@/lib/gcash";
export async function POST(request: Request) {
  return api(async () => {
    assertMutation(request);
    const actor = await requireUser(["ADMIN"]);
    await rateLimit("gcash-admin", actor.id, 20);
    return json(await reconcileGcash(actor, await readJson(request)));
  });
}
