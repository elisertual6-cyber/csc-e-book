import { z } from "zod";
import { api, assertMutation, readJson, json } from "@/lib/http";
import { requireUser, rateLimit } from "@/lib/auth";
import { staffRoles } from "@/lib/security";
import { getDb } from "@/lib/db";
import { generateEdition, publishPreview } from "@/lib/pdf";
export const runtime = "nodejs";
export const maxDuration = 60;
const generate = z
  .object({
    kind: z.enum(["DRAFT", "PREVIEW", "FULL"]),
    version: z
      .string()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z0-9.-]+$/),
    title: z.string().trim().min(5).max(150),
    lessonIds: z.array(z.string().min(1)).min(1).max(100),
    questionIds: z.array(z.string().min(1)).max(1000),
  })
  .strict();
export async function GET() {
  return api(async () => {
    await requireUser(staffRoles);
    return json(
      await getDb().pdfEdition.findMany({
        select: {
          id: true,
          title: true,
          version: true,
          kind: true,
          createdAt: true,
          publishedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  });
}
export async function POST(request: Request) {
  return api(async () => {
    assertMutation(request);
    const actor = await requireUser(staffRoles);
    const body = await readJson(request);
    const publication = z
      .object({
        action: z.literal("publish"),
        id: z.string(),
        humanReviewed: z.boolean(),
      })
      .strict()
      .safeParse(body);
    if (publication.success)
      return json(
        await publishPreview(
          actor,
          publication.data.id,
          publication.data.humanReviewed,
        ),
      );
    await rateLimit("pdf-worker", "global", 4);
    await rateLimit("pdf-user", actor.id, 2);
    const result = await generateEdition(actor, generate.parse(body));
    return json(
      { id: result.id, kind: result.kind, version: result.version },
      201,
    );
  });
}
