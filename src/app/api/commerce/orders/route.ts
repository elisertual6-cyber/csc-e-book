import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { checkout, orders } from "@/lib/commerce";
export async function GET() {
  return api(async () => json(await orders(await requireUser())));
}
export async function POST(request: Request) {
  return api(async () => {
    assertMutation(request);
    const actor = await requireUser();
    await rateLimit("checkout", actor.id, 10);
    return json(await checkout(actor, await readJson(request)), 201);
  });
}
