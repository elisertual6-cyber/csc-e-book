import "dotenv/config";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createHash, randomUUID } from "node:crypto";
import { hashPassword } from "../src/lib/security";
import { practiceSeriesKey, questionKeysForSet } from "../src/lib/practice-series-policy";
import type { AttemptView } from "../src/lib/exam-types";

test("five 160-item sets enforce review, complete submissions, account isolation and ordered unlocks", async ({ playwright, page, context }) => {
  test.setTimeout(180000);
  expect(new URL(process.env.DATABASE_URL!).pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const prefix = randomUUID(), password = `${randomUUID()}-synthetic`;
  const passwordHash = await hashPassword(password);
  const users = await Promise.all((["ADMIN", "REVIEWER", "CUSTOMER", "CUSTOMER"] as const).map((role, i) => db.user.create({ data: { email: `${prefix}-${i}@example.test`, name: "Synthetic sequence fixture", role, passwordHash } })));
  const headers = { Origin: "http://127.0.0.1:3100", "X-CSC-Action": "1" };
  const clients = await Promise.all(users.map(() => playwright.request.newContext({ baseURL: "http://127.0.0.1:3100", extraHTTPHeaders: headers })));
  const anonymous = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3100", extraHTTPHeaders: headers });
  const [admin, , alice, bob] = clients;
  const templates: { id: string; version: number }[] = [];
  const records: { id: string; key: string; version: number; authorId: string; prompt: string; topic: string; level: "COMMON"; difficulty: "EASY"; sourceNotes: string; status: "DRAFT" }[] = [];
  try {
    for (const [i, client] of clients.entries()) expect((await client.post("/api/auth/login", { data: { email: users[i].email, password } })).status()).toBe(200);
    expect((await anonymous.get("/api/exams/series")).status()).toBe(401);
    const blank = await (await alice.get("/api/exams/series")).json();
    expect(blank.sets).toHaveLength(5); expect(blank.sets.every((s: { state: string }) => s.state === "not_prepared")).toBe(true);
    for (let position = 1; position <= 5; position++) for (const [index, key] of questionKeysForSet(position).entries()) records.push({
      id: randomUUID(), key, version: 1, authorId: users[0].id,
      prompt: `Synthetic sequence fixture ${prefix}, set ${position}, question ${index + 1}: choose the designated test value.`,
      topic: "arithmetic", level: "COMMON", difficulty: "EASY", sourceNotes: "Synthetic isolated fixture; this is not a human review of actual content.", status: "DRAFT",
    });
    await db.question.createMany({ data: records });
    await db.choice.createMany({ data: records.flatMap(q => ["A", "B", "C", "D"].map((label, i) => ({ questionId: q.id, label, text: String(i + 10), isCorrect: label === "B" }))) });
    await db.explanation.createMany({ data: records.map(q => ({ questionId: q.id, rationale: "Synthetic fixture: B is the designated value. No source publication or substantive human review is represented." })) });
    for (let position = 1; position <= 5; position++) templates.push(await db.examTemplate.create({ data: {
      slug: `sequence-fixture-${prefix}-${position}`, title: `Synthetic Practice Set ${position}`, seriesKey: practiceSeriesKey, setPosition: position,
      level: "COMMON", mode: "PRACTICE", access: "FREE", durationSeconds: 0, questionCount: 160,
      questionKeys: questionKeysForSet(position), topics: [],
    } }));
    expect((await alice.post("/api/admin/exam-templates", { data: { action: "activate", id: templates[0].id, version: 1 } })).status()).toBe(403);
    expect((await admin.post("/api/admin/exam-templates", { data: { action: "activate", id: templates[0].id, version: 1 } })).status()).toBe(409);
    expect((await alice.post("/api/exams/attempts", { data: { templateId: templates[0].id, startKey: randomUUID() } })).status()).toBe(404);
    const awaiting = await (await alice.get("/api/exams/series")).json();
    expect(awaiting.sets[0].state).toBe("awaiting_review"); expect(awaiting.sets[1].state).toBe("locked");
    // Simulated review only on synthetic questions in this generated database.
    // No repository question text is used or approved.
    await db.question.updateMany({ where: { id: { in: records.map(q => q.id) } }, data: { status: "PUBLISHED" } });
    expect((await admin.post("/api/admin/exam-templates", { data: { action: "activate", id: templates[0].id, version: 1 } })).status()).toBe(409);
    const loaded = await db.question.findMany({ where: { id: { in: records.map(q => q.id) } }, include: { choices: true, explanation: true } });
    await db.review.createMany({ data: loaded.map(q => ({ reviewerId: users[1].id, questionId: q.id, decision: "APPROVED", notes: "Simulated fixture approval only; never human evidence.", contentHash: createHash("sha256").update(JSON.stringify({
      key: q.key, version: q.version, prompt: q.prompt, topic: q.topic, level: q.level, difficulty: q.difficulty, sourceNotes: q.sourceNotes,
      choices: [...q.choices].sort((a, b) => a.label.localeCompare(b.label)).map(c => ({ label: c.label, text: c.text, isCorrect: c.isCorrect })), explanation: q.explanation!.rationale,
    })).digest("hex") })) });
    for (const template of templates) {
      const active = await admin.post("/api/admin/exam-templates", { data: { action: "activate", id: template.id, version: template.version } });
      expect(active.status()).toBe(200); template.version = (await active.json()).version;
    }
    expect((await (await alice.get("/api/exams/templates")).json()).some((t: { id: string }) => t.id === templates[0].id)).toBe(false);
    const before = await (await alice.get("/api/exams/series")).json();
    expect(before.sets.map((s: { state: string }) => s.state)).toEqual(["available", "locked", "locked", "locked", "locked"]);
    expect(JSON.stringify(before)).not.toContain(records[0].prompt);
    expect((await alice.get("/api/admin/questions?set=1")).status()).toBe(403);
    await db.question.create({ data: { ...records[0], id: randomUUID(), version: 2,
      prompt: `Synthetic later draft version ${prefix}; preserve latest-version browsing.`,
      choices: { create: ["A", "B", "C", "D"].map(label => ({ label, text: `Fixture option ${label}`, isCorrect: label === "A" })) },
      explanation: { create: { rationale: "Synthetic draft version only, not released or independently approved." } } } });
    for (let position = 1; position <= 5; position++) {
      const filtered = await (await admin.get(`/api/admin/questions?set=${position}`)).json();
      expect(filtered).toHaveLength(160);
      expect(new Set(filtered.map((q: { key: string }) => q.key))).toEqual(new Set(questionKeysForSet(position)));
      if (position === 1) expect(filtered.find((q: { key: string }) => q.key === records[0].key).version).toBe(2);
    }
    expect((await admin.get("/api/admin/questions?set=6")).status()).toBe(400);
    expect((await alice.post("/api/exams/attempts", { data: { templateId: templates[1].id, startKey: randomUUID() } })).status()).toBe(403);
    expect((await alice.post("/api/exams/attempts", { data: { templateId: templates[4].id, startKey: randomUUID() } })).status()).toBe(403);
    expect((await alice.post("/api/exams/attempts", { data: { templateId: templates[0].id, startKey: randomUUID(), questionCount: 1 } })).status()).toBe(400);
    await context.addCookies((await alice.storageState()).cookies);
    await page.goto("/practice/sets");
    await expect(page.getByRole("button", { name: "Start Set 1", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Set 2 locked", exact: true })).toBeDisabled();
    await page.evaluate(() => localStorage.setItem("practice-series-progress", JSON.stringify({ completedSets: 5 })));
    await page.reload();
    await expect(page.getByRole("button", { name: "Set 2 locked", exact: true })).toBeDisabled();
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const simultaneous = await Promise.all([0, 1].map(() => alice.post("/api/exams/attempts", { data: { templateId: templates[0].id, startKey: randomUUID() } })));
    expect(simultaneous.every(r => r.status() === 201)).toBe(true);
    const first = await simultaneous[0].json() as AttemptView;
    expect((await simultaneous[1].json()).id).toBe(first.id);
    expect(first.result).toBeNull(); expect(first.questions).toHaveLength(160);
    expect(first.questions.every(q => q.choices.every(c => Object.keys(c).sort().join() === "label,text"))).toBe(true);
    expect(JSON.stringify(first)).not.toContain("correctLabel"); expect(JSON.stringify(first)).not.toContain("sourceId");
    expect((await bob.get(`/api/exams/attempts/${first.id}`)).status()).toBe(404);
    expect((await alice.post(`/api/exams/attempts/${first.id}`, { data: { action: "submit" } })).status()).toBe(400);
    const partial = await alice.patch(`/api/exams/attempts/${first.id}`, { data: { revision: first.revision, responses: first.questions.slice(0, 159).map(q => ({ questionKey: q.questionKey, choiceLabel: "A", flagged: false })) } });
    expect(partial.status()).toBe(200);
    expect((await alice.post(`/api/exams/attempts/${first.id}`, { data: { action: "submit" } })).status()).toBe(400);
    await page.goto("/practice/sets");
    await expect(page.getByRole("link", { name: "Resume Set 1", exact: true })).toHaveAttribute("href", `/practice/${first.id}`);
    await page.getByRole("link", { name: "Resume Set 1", exact: true }).click();
    await expect(page.getByText("159 of 160 answered", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit and view explanations", exact: true })).toBeDisabled();
    await expect(page.getByRole("combobox", { name: "Question number", exact: true })).toHaveValue("0");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    const partialView = await partial.json() as AttemptView;
    const last = first.questions.at(-1)!;
    expect((await alice.patch(`/api/exams/attempts/${first.id}`, { data: { revision: partialView.revision, responses: [{ questionKey: last.questionKey, choiceLabel: "A", flagged: false }] } })).status()).toBe(200);
    const submitted = await Promise.all([0, 1].map(() => alice.post(`/api/exams/attempts/${first.id}`, { data: { action: "submit" } })));
    expect(submitted.every(r => r.status() === 200)).toBe(true);
    const result = await submitted[0].json() as AttemptView;
    expect(result.result?.unanswered).toBe(0); expect(result.result?.correct).toBe(0);
    expect(result.result?.answers).toHaveLength(160);
    expect(await db.auditEvent.count({ where: { action: "exam.submit", targetId: first.id } })).toBe(1);
    expect((await bob.post("/api/exams/attempts", { data: { templateId: templates[1].id, startKey: randomUUID() } })).status()).toBe(403);
    for (let index = 1; index < 5; index++) {
      const progress = await (await alice.get("/api/exams/series")).json();
      expect(progress.completedSets).toBe(index); expect(progress.sets[index].state).toBe("available");
      const response = index === 1 ? await (async () => {
        await page.goto("/practice/sets");
        await page.getByRole("button", { name: "Start Set 2", exact: true }).click();
        await page.waitForURL(url => url.pathname.startsWith("/practice/") && url.pathname !== "/practice/sets");
        return alice.get(`/api/exams/attempts/${page.url().split("/").at(-1)}`);
      })() : await alice.post("/api/exams/attempts", { data: { templateId: templates[index].id, startKey: randomUUID() } });
      expect(response.status()).toBe(index === 1 ? 200 : 201); const attempt = await response.json() as AttemptView;
      expect((await alice.patch(`/api/exams/attempts/${attempt.id}`, { data: { revision: attempt.revision, responses: attempt.questions.map(q => ({ questionKey: q.questionKey, choiceLabel: "A", flagged: false })) } })).status()).toBe(200);
      expect((await alice.post(`/api/exams/attempts/${attempt.id}`, { data: { action: "submit" } })).status()).toBe(200);
    }
    const completed = await (await alice.get("/api/exams/series")).json();
    expect(completed.completedSets).toBe(5); expect(completed.sets.every((s: { state: string }) => s.state === "completed")).toBe(true);
    await page.goto("/practice/sets");
    await expect(page.getByRole("status")).toHaveText("5 of 5 sets completed");
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    // Fixed membership cannot be edited through ordinary template saving.
    expect((await admin.post("/api/admin/exam-templates", { data: { action: "save", id: templates[0].id, version: templates[0].version, data: {} } })).status()).toBe(409);
  } finally {
    await db.attempt.deleteMany({ where: { templateId: { in: templates.map(t => t.id) } } });
    await db.examTemplate.deleteMany({ where: { id: { in: templates.map(t => t.id) } } });
    await db.review.deleteMany({ where: { reviewerId: users[1].id, question: { key: { in: records.map(q => q.key) } } } });
    await db.question.deleteMany({ where: { key: { in: records.map(q => q.key) } } });
    await Promise.all([...clients, anonymous].map(client => client.dispose()));
    await db.$disconnect();
  }
});
