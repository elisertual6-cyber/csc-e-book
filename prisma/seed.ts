import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "node:fs";
import { curriculum } from "../src/lib/curriculum";
import { getCatalog } from "../src/lib/catalog";
import { validateBank } from "../src/lib/content-validation";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  const questions = validateBank(
    JSON.parse(readFileSync("content/questions.json", "utf8")),
  );
  const markdown = readFileSync("content/lessons/arithmetic.md", "utf8");
  await prisma.$transaction(
    async (tx) => {
      for (const [i, chapter] of curriculum.entries()) {
        await tx.chapter.upsert({
          where: { slug: chapter.slug },
          update: {},
          create: {
            slug: chapter.slug,
            title: chapter.title,
            position: i + 1,
            level: chapter.track,
          },
        });
      }
      const chapter = await tx.chapter.findUniqueOrThrow({
        where: { slug: "arithmetic" },
      });
      await tx.lesson.upsert({
        where: { slug_version: { slug: "arithmetic-intro", version: 1 } },
        update: {},
        create: {
          slug: "arithmetic-intro",
          title: "A little order goes a long way",
          chapterId: chapter.id,
          markdown,
          objectives: [
            "Apply operation priority",
            "Translate a word problem",
            "Check units",
          ],
          status: "DRAFT",
        },
      });
      for (const q of questions) {
        await tx.question.upsert({
          where: { key_version: { key: q.key, version: q.version } },
          update: {},
          create: {
            key: q.key,
            version: q.version,
            prompt: q.prompt,
            topic: q.topic,
            level: q.level,
            difficulty: q.difficulty,
            sourceNotes: q.sourceNotes,
            status: "DRAFT",
            choices: { create: q.choices },
            explanation: { create: { rationale: q.explanation } },
          },
        });
      }
      for (const product of getCatalog()) {
        // Never overwrite existing editorial content or prices on a repeat seed.
        await tx.product.upsert({
          where: { slug: product.slug },
          update: {},
          create: {
            slug: product.slug,
            name: product.label,
            description: product.description,
            version: "0.1-draft",
            active: false,
            grantsExams: product.slug === "premium",
            prices: {
              create: { amountMinor: product.priceMinor, active: false },
            },
          },
        });
      }
    },
    { timeout: 20000 },
  );
  console.log(
    "Draft seed complete. Products remain inactive; no exam questions are published.",
  );
}
main()
  .catch(() => {
    console.error(
      "Seed failed. Check local database configuration and migrations.",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
