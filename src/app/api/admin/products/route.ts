import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { manageProduct } from "@/lib/commerce";
import { getDb } from "@/lib/db";
export async function GET() {
  return api("admin", async () => {
    await requireUser(["ADMIN"]);
    return json(
      await getDb().product.findMany({
        orderBy: { slug: "asc" },
        take: 100,
        include: {
          prices: { orderBy: { createdAt: "desc" } },
          artifacts: {
            select: {
              id: true,
              version: true,
              developmentOnly: true,
              editionId: true,
              publishedAt: true,
            },
          },
        },
      }),
    );
  });
}
export async function POST(request: Request) {
  return api("admin", async () => {
    assertMutation(request);
    const actor = await requireUser(["ADMIN"]);
    await rateLimit("product-admin", actor.id, 30);
    return json(await manageProduct(actor, await readJson(request)));
  });
}
