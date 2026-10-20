import { api, assertMutation, json, readJson } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { manageTemplate } from "@/lib/exams";
import { getDb } from "@/lib/db";
export async function GET() {
  return api(async () => {
    await requireUser(["ADMIN"]);
    return json(
      await getDb().examTemplate.findMany({
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
    );
  });
}
export async function POST(request: Request) {
  return api(async () => {
    assertMutation(request);
    const actor = await requireUser(["ADMIN"]);
    await rateLimit("exam-admin", actor.id, 30);
    return json(await manageTemplate(actor, await readJson(request)));
  });
}
