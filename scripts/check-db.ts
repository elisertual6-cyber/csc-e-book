import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
async function main() {
  await db.$queryRaw`SELECT 1`;
  assert.equal(
    await db.chapter.count(),
    25,
    "Expected 25 curriculum chapters after seed",
  );
  const lesson = await db.lesson.findUniqueOrThrow({
    where: { slug_version: { slug: "arithmetic-intro", version: 1 } },
  });
  assert.equal(lesson.status, "DRAFT");
  const question = await db.question.findUniqueOrThrow({
    where: { key_version: { key: "arithmetic-001", version: 1 } },
    include: { choices: true, explanation: true },
  });
  assert.equal(question.status, "DRAFT");
  assert.equal(question.choices.length, 4);
  assert.equal(question.choices.filter((c) => c.isCorrect).length, 1);
  assert.ok(question.explanation?.rationale);
  for (const slug of ["basic", "complete", "premium"]) {
    const product = await db.product.findUniqueOrThrow({
      where: { slug },
      include: { prices: true },
    });
    assert.equal(product.active, false);
    assert.equal(
      product.prices.length,
      1,
      "Repeat seed must not duplicate prices",
    );
  }
  console.log(
    "Database integration passed: connectivity, curriculum, draft lesson/question relations, inactive products, unique seeded prices.",
  );
}
main()
  .catch(() => {
    console.error(
      "Database integration failed. Check migrations and draft seed data.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
