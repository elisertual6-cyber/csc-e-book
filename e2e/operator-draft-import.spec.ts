import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { questionImportRows } from "../src/lib/draft-pack";

test("operator draft import requires ADMIN, rolls back conflicts, preserves existing records and remains unapproved", async () => {
  test.setTimeout(60000);
  const url = new URL(process.env.DATABASE_URL ?? "");
  expect(url.pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  const identity = `${randomUUID()}@example.test`;
  const customerEmail = `${randomUUID()}@example.test`;
  const run = (email: string, apply = true, pack = "numerical") => spawnSync(process.execPath, [
    "--conditions=react-server", "--import", "tsx", "scripts/import-numerical-drafts.ts", "--pack", pack, ...(apply ? ["--apply"] : []),
  ], { env: { ...process.env, ADMIN_EMAIL: email }, encoding: "utf8", timeout: 25000 });
  try {
    const admin = await db.user.create({ data: { email: identity, role: "ADMIN" } });
    await db.user.create({ data: { email: customerEmail, role: "CUSTOMER" } });
    await db.chapter.delete({ where: { slug: "vocabulary" } });
    const original = await db.lesson.findFirstOrThrow({ where: { slug: "arithmetic-intro" } });
    await db.lesson.update({ where: { id: original.id }, data: { markdown: original.markdown + "\nOperator edits must survive re-import.\n" } });
    const before = await db.lesson.findUniqueOrThrow({ where: { id: original.id } });
    const missing = run(identity, false);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("Use --apply");
    for (const email of [customerEmail, `unknown-${randomUUID()}@example.test`]) {
      const denied = run(email);
      expect(denied.status).toBe(1);
      expect(denied.stderr).toContain("existing ADMIN");
      expect(denied.stdout + denied.stderr).not.toContain(email);
    }
    expect(await db.chapter.count()).toBe(24);
    expect(await db.lesson.count()).toBe(1);
    const q = questionImportRows(JSON.parse(readFileSync("content/editorial/numerical-foundations.json", "utf8")))[0];
    const conflict = await db.question.create({ data: { key: `conflict-${randomUUID()}`, prompt: q.prompt, topic: q.topic, level: q.level, difficulty: q.difficulty, sourceNotes: q.sourceNotes } });
    const failed = run(identity);
    expect(failed.status).toBe(1);
    expect(failed.stderr).toContain("transaction was rolled back");
    expect(failed.stdout + failed.stderr).not.toContain(q.prompt);
    expect(await db.chapter.count()).toBe(24);
    expect(await db.lesson.count()).toBe(1);
    await db.question.delete({ where: { id: conflict.id } });
    const success = run(identity);
    expect(success.status).toBe(0);
    expect(success.stdout).toContain("1 chapters, 4 lessons and 20 questions created");
    expect(success.stdout + success.stderr).not.toContain(identity);
    expect(await db.chapter.count()).toBe(25);
    expect(await db.lesson.count()).toBe(5);
    expect(await db.question.count()).toBe(21);
    expect(await db.lesson.count({ where: { authorId: admin.id, status: "DRAFT" } })).toBe(4);
    expect(await db.question.count({ where: { authorId: admin.id, status: "DRAFT" } })).toBe(20);
    const imported = await db.question.findFirstOrThrow({ where: { authorId: admin.id } });
    await db.question.update({ where: { id: imported.id }, data: { prompt: imported.prompt + " Preserve this operator edit." } });
    const repeat = run(identity);
    expect(repeat.status).toBe(0);
    expect(repeat.stdout).toContain("0 chapters, 0 lessons and 0 questions created");
    expect(await db.lesson.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
    expect((await db.question.findUniqueOrThrow({ where: { id: imported.id } })).prompt).toContain("Preserve this operator edit.");
    expect(await db.lesson.count({ where: { status: { not: "DRAFT" } } })).toBe(0);
    expect(await db.question.count({ where: { status: { not: "DRAFT" } } })).toBe(0);
    expect(await db.review.count()).toBe(0);
    expect(await db.product.count({ where: { active: true } })).toBe(0);
    expect(await db.examTemplate.count()).toBe(0);
    expect(await db.auditEvent.count({ where: { actorId: admin.id, action: "operator.numerical-drafts.import" } })).toBe(2);
    const unknownPack = run(identity, true, "../../questions");
    expect(unknownPack.status).toBe(1);
    expect(unknownPack.stderr).toContain("supported editorial pack");
    expect(run(customerEmail, true, "language").status).toBe(1);
    const language = run(identity, true, "language");
    expect(language.status).toBe(0);
    expect(language.stdout).toContain("0 chapters, 3 lessons and 15 questions created");
    expect(await db.lesson.count()).toBe(8);
    expect(await db.question.count()).toBe(36);
    expect(await db.question.count({ where: { authorId: admin.id, status: "DRAFT" } })).toBe(35);
    const languageRepeat = run(identity, true, "language");
    expect(languageRepeat.status).toBe(0);
    expect(languageRepeat.stdout).toContain("0 chapters, 0 lessons and 0 questions created");
    expect(await db.review.count()).toBe(0);
    expect(await db.question.count({ where: { status: { not: "DRAFT" } } })).toBe(0);
    expect(await db.lesson.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
    expect(await db.auditEvent.count({ where: { actorId: admin.id, action: "operator.language-drafts.import" } })).toBe(2);
  } finally { await db.$disconnect(); }
});
