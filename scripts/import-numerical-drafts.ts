import "dotenv/config";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { getDb } from "../src/lib/db";
import { createContent, chapterInput, lessonInput, questionInput } from "../src/lib/editorial";
import { curriculum } from "../src/lib/curriculum";
import { draftLessons } from "../src/lib/lesson-catalog";
import { checkLesson } from "../src/lib/content-validation";
import { questionImportRows } from "../src/lib/draft-pack";

class ImportError extends Error {}
const db = getDb();
async function main() {
  if (process.argv.slice(2).join(" ") !== "--apply")
    throw new ImportError("Use --apply for an intentional draft import.");
  if (!process.env.DATABASE_URL)
    throw new ImportError("Supply the intended DATABASE_URL privately before importing drafts.");
  const email = z.email().max(254).safeParse(process.env.ADMIN_EMAIL?.trim());
  if (!email.success) throw new ImportError("Save a valid ADMIN_BOOTSTRAP_EMAIL repository secret first.");
  const chapters = curriculum.map((c, i) => chapterInput.parse({ slug: c.slug, title: c.title, position: i + 1, level: c.track }));
  const lessons = draftLessons.map(lesson => {
    const markdown = readFileSync(`content/lessons/${lesson.slug}.md`, "utf8");
    checkLesson(markdown);
    const section = markdown.split("## Learning objectives\n")[1]?.split(/\n## /)[0] ?? "";
    const objectives = section.split("\n").filter(line => line.startsWith("- ")).map(line => line.slice(2).trim());
    return lessonInput.parse({ slug: `${lesson.slug}-intro`, title: lesson.title, chapterSlug: lesson.slug, objectives, markdown });
  });
  const questions = questionImportRows(JSON.parse(readFileSync("content/editorial/numerical-foundations.json", "utf8"))).map(q => questionInput.parse(q));
  const counts = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73642021)`;
    // Lock the operator identity while checking its current role and importing.
    const identities = await tx.$queryRaw<{ id: string; role: string }[]>`SELECT id, role FROM "User" WHERE email=${email.data.toLowerCase()} FOR SHARE`;
    if (identities[0]?.role !== "ADMIN") throw new ImportError("An existing ADMIN account matching ADMIN_BOOTSTRAP_EMAIL is required. No records were imported.");
    const actor = { id: identities[0].id, role: "ADMIN" as const };
    const created = { chapters: 0, lessons: 0, questions: 0 };
    for (const c of chapters) {
      if (await tx.chapter.findUnique({ where: { slug: c.slug } })) continue;
      const chapter = await tx.chapter.create({ data: c });
      await tx.auditEvent.create({ data: { actorId: actor.id, action: "chapter.create", targetId: chapter.id, metadata: { source: "operator.numerical-drafts" } } });
      created.chapters++;
    }
    for (const lesson of lessons) {
      if (await tx.lesson.findFirst({ where: { slug: lesson.slug }, select: { id: true } })) continue;
      await createContent(tx, actor, "lessons", lesson);
      created.lessons++;
    }
    for (const question of questions) {
      if (await tx.question.findFirst({ where: { key: question.key }, select: { id: true } })) continue;
      await createContent(tx, actor, "questions", question);
      created.questions++;
    }
    await tx.auditEvent.create({ data: { actorId: actor.id, action: "operator.numerical-drafts.import", targetId: actor.id, metadata: { source: "public-numerical-foundations-v1", created, existingKeys: "preserved", status: "DRAFT" } } });
    return created;
  // Hosted Mumbai DB round trips from a GitHub runner can exceed one minute.
  }, { isolationLevel: "Serializable", timeout: 180000 });
  console.log(`Draft import complete: ${counts.chapters} chapters, ${counts.lessons} lessons and ${counts.questions} questions created. Existing keys were preserved. No reviews, publications, products or exams were activated.`);
}
main().catch((error: unknown) => {
  console.error(error instanceof ImportError ? error.message : "Draft import failed; the transaction was rolled back. Check source validation, database permissions and conflicts. No private errors or answer keys were logged.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
