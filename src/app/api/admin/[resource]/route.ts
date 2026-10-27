import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireUser, rateLimit } from "@/lib/auth";
import { staffRoles, writerRoles } from "@/lib/security";
import { api, assertMutation, readJson, json, HttpError } from "@/lib/http";
import { questionKeysForSet } from "@/lib/practice-series-policy";
import {
  audit,
  chapterInput,
  createDrafts,
  changeContent,
} from "@/lib/editorial";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  return api("admin", async () => {
    await requireUser(staffRoles);
    const { resource } = await params;
    const db = getDb();
    if (resource === "chapters")
      return json(await db.chapter.findMany({ orderBy: { position: "asc" } }));
    if (resource === "lessons")
      return json(
        await db.lesson.findMany({
          include: { chapter: true, reviews: true },
          orderBy: { updatedAt: "desc" },
          take: 200,
        }),
      );
    if (resource === "questions") {
      const selection = new URL(request.url).searchParams.get("set");
      if (selection !== null) {
        const position = z.coerce.number().int().min(1).max(5).parse(selection);
        const rows = await db.question.findMany({ where: { key: { in: questionKeysForSet(position) } },
          include: { choices: true, explanation: true, reviews: true }, distinct: ["key"],
          orderBy: [{ key: "asc" }, { version: "desc" }], take: 160 });
        return json(rows);
      }
      return json(
        await db.question.findMany({
          include: { choices: true, explanation: true, reviews: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
      );
    }
    throw new HttpError(404, "Unknown resource.");
  });
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  return api("admin", async () => {
    assertMutation(request);
    const actor = await requireUser(staffRoles);
    await rateLimit("editorial", actor.id, 60);
    const { resource } = await params;
    const body = await readJson(request);
    if (resource === "chapters") {
      if (!writerRoles.includes(actor.role))
        throw new HttpError(403, "An editor role is required.");
      const command = z
        .object({
          action: z.enum(["create", "save", "delete"]),
          id: z.string().optional(),
          data: z.unknown().optional(),
        })
        .strict()
        .parse(body);
      return json(
        await getDb().$transaction(async (tx) => {
          const data =
            command.action !== "delete"
              ? chapterInput.parse(command.data)
              : undefined;
          if (command.action !== "create" && !command.id)
            throw new HttpError(400, "Record ID required.");
          const record =
            command.action === "create"
              ? await tx.chapter.create({ data: data! })
              : command.action === "save"
                ? await tx.chapter.update({
                    where: { id: command.id },
                    data: data!,
                  })
                : await tx.chapter.delete({ where: { id: command.id } });
          await audit(tx, actor, `chapter.${command.action}`, record.id);
          return record;
        }),
      );
    }
    if (resource !== "questions" && resource !== "lessons")
      throw new HttpError(404, "Unknown resource.");
    const create = z
      .object({ action: z.literal("create"), data: z.unknown() })
      .strict()
      .safeParse(body);
    return create.success
      ? json((await createDrafts(actor, resource, [create.data.data]))[0], 201)
      : json(await changeContent(actor, resource, body));
  });
}
