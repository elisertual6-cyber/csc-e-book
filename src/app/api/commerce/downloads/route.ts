import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { issueDownload } from "@/lib/commerce";
import { getDb } from "@/lib/db";
export async function GET() {
  return api(async () => {
    const actor = await requireUser();
    return json(
      await getDb().download.findMany({
        where: { userId: actor.id },
        orderBy: { issuedAt: "desc" },
        take: 100,
        select: {
          id: true,
          artifactId: true,
          issuedAt: true,
          expiresAt: true,
          consumedAt: true,
        },
      }),
    );
  });
}
export async function POST(request: Request) {
  return api(async () => {
    assertMutation(request);
    const actor = await requireUser();
    await rateLimit("download-issue", actor.id, 15);
    return json(await issueDownload(actor, await readJson(request)), 201);
  });
}
