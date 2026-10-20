import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { manageAccess } from "@/lib/commerce";
import { getDb } from "@/lib/db";
export async function GET() {
  return api(async () => {
    await requireUser(["ADMIN"]);
    return json(
      await getDb().order.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          userId: true,
          status: true,
          paymentMethod: true,
          paymentSession: { select: { state: true, providerSessionId: true } },
          totalMinor: true,
          currency: true,
          createdAt: true,
          items: { select: { productName: true, productVersion: true } },
          payments: {
            select: {
              provider: true,
              status: true,
              amountMinor: true,
              currency: true,
              verifiedAt: true,
            },
          },
          entitlements: {
            select: { id: true, revokedAt: true, expiresAt: true },
          },
        },
      }),
    );
  });
}
export async function POST(request: Request) {
  return api(async () => {
    assertMutation(request);
    const actor = await requireUser(["ADMIN"]);
    await rateLimit("access-admin", actor.id, 30);
    return json(await manageAccess(actor, await readJson(request)));
  });
}
