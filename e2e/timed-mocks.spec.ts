import "dotenv/config";
import { spawnSync } from "node:child_process";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../src/lib/security";
import { curriculum } from "../src/lib/curriculum";
import { mockSourceTopic, timedMockDefinitions } from "../src/lib/timed-mock-policy";
import type { AttemptView, ExamOption } from "../src/lib/exam-types";

test("released draft mocks work for both tracks with persistent timers, private keys and server expiry", async ({ playwright, page, context }) => {
  test.setTimeout(180000);
  expect(new URL(process.env.DATABASE_URL!).pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const prefix = randomUUID(), password = `${randomUUID()}-synthetic`;
  const passwordHash = await hashPassword(password);
  const users = await Promise.all((["ADMIN", "CUSTOMER", "CUSTOMER"] as const).map((role, i) => db.user.create({ data: {
    email: `timed-${prefix}-${i}@example.test`, name: "Synthetic timed fixture", role, passwordHash,
  } })));
  const headers = { Origin: "http://127.0.0.1:3100", "X-CSC-Action": "1" };
  const clients = await Promise.all(users.map(() => playwright.request.newContext({ baseURL: "http://127.0.0.1:3100", extraHTTPHeaders: headers })));
  const [admin, alice, bob] = clients;
  const records = [...new Set(timedMockDefinitions.flatMap(d => d.questionKeys))].map(key => ({
    id: randomUUID(), key, version: 1, authorId: users[0].id, status: "DRAFT" as const,
    prompt: `Synthetic timed fixture ${prefix}, ${key}: choose the designated test value.`,
    topic: mockSourceTopic(key), level: curriculum.find(t => t.slug === mockSourceTopic(key))!.track,
    difficulty: "EASY" as const, sourceNotes: "Synthetic isolated fixture. No actual source questions or human review are represented.",
  }));
  const slugs = timedMockDefinitions.map(d => d.slug);
  const templateIds: string[] = [];
  const activate = (email = users[0].email) => spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/activate-timed-mocks.ts", "--apply"],
    { env: { ...process.env, ADMIN_EMAIL: email }, encoding: "utf8", timeout: 45000 });
  const start = (templateId: string, extra = {}) => alice.post("/api/exams/attempts", { data: { templateId, startKey: randomUUID(), ...extra } });
  try {
    for (const [i, client] of clients.entries()) expect((await client.post("/api/auth/login", { data: { email: users[i].email, password } })).status()).toBe(200);
    expect(activate().status).toBe(1);
    expect(await db.examTemplate.count({ where: { slug: { in: slugs } } })).toBe(0);
    await db.question.createMany({ data: records });
    await db.choice.createMany({ data: records.flatMap(q => ["A", "B", "C", "D"].map(label => ({ questionId: q.id, label, text: `Synthetic option ${label}`, isCorrect: label === "B" }))) });
    await db.explanation.createMany({ data: records.map(q => ({ questionId: q.id, rationale: "Synthetic timed fixture: B is designated, with no independent review." })) });
    const reviewCount = await db.review.count();
    const last = records.at(-1)!;
    await db.choice.updateMany({ where: { questionId: last.id, label: "A" }, data: { isCorrect: true } });
    expect(activate().status).toBe(1);
    expect(await db.examTemplate.count({ where: { slug: { in: slugs } } })).toBe(0);
    await db.choice.updateMany({ where: { questionId: last.id, label: "A" }, data: { isCorrect: false } });
    expect(activate(users[1].email).status).toBe(1);
    const release = activate();
    expect(release.status).toBe(0); expect(release.stdout).toContain("Activated 2 of 2 timed mocks");
    expect(activate().stdout).toContain("Activated 0 of 2");
    expect(await db.review.count()).toBe(reviewCount);
    expect(await db.question.count({ where: { id: { in: records.map(q => q.id) }, status: "DRAFT" } })).toBe(records.length);
    const templates = await db.examTemplate.findMany({ where: { slug: { in: slugs } }, orderBy: { slug: "asc" } });
    templateIds.push(...templates.map(t => t.id));
    const options = (await (await alice.get("/api/exams/templates")).json() as ExamOption[]).filter(t => templateIds.includes(t.id));
    expect(options).toHaveLength(2);
    expect(options.every(t => t.mode === "MOCK" && t.access === "FREE" && t.canStart && t.unreviewed && t.questionCount === 160 && t.durationSeconds === 9000)).toBe(true);
    const professional = templates.find(t => t.level === "PROFESSIONAL")!, subprofessional = templates.find(t => t.level === "SUBPROFESSIONAL")!;
    expect((await start(professional.id, { questionCount: 1 })).status()).toBe(400);
    expect((await start(professional.id, { topic: "arithmetic" })).status()).toBe(400);
    await context.addCookies((await alice.storageState()).cookies);
    await page.goto("/practice");
    await page.getByRole("combobox", { name: "Session type", exact: true }).selectOption("MOCK");
    const choice = page.getByRole("radio", { name: /Professional timed mock/ });
    await expect(choice).toBeVisible(); await choice.check();
    await expect(page.getByText(/160 questions · 150 minutes/)).toBeVisible();
    await expect(page.getByText(/This timed session reuses questions/)).toBeVisible();
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: "Start this session", exact: true }).click();
    await page.waitForURL(/\/practice\/[^/]+$/);
    const id = new URL(page.url()).pathname.split("/").at(-1)!;
    const attempt = await (await alice.get(`/api/exams/attempts/${id}`)).json() as AttemptView;
    expect(attempt.questions).toHaveLength(160); expect(attempt.series).toBeUndefined(); expect(attempt.unreviewed).toBe(true);
    expect(attempt.result).toBeNull(); expect(attempt.score).toBeNull();
    for (const hidden of ["correctLabel", "isCorrect", "explanation", "sourceId", "sourceVersion", "questionSnapshot"]) expect(JSON.stringify(attempt)).not.toContain(`"${hidden}"`);
    expect(attempt.questions.every(q => !["filing", "spelling"].includes(q.topic))).toBe(true);
    expect(Date.parse(attempt.deadlineAt!) - Date.parse(attempt.startedAt)).toBe(9000000);
    const timer = page.getByRole("timer");
    await expect(timer).toHaveText(/Time remaining: 14[89]:\d{2}/);
    const earlier = await timer.innerText();
    await expect(timer).not.toHaveText(earlier, { timeout: 4000 });
    await expect(page.getByRole("combobox", { name: "Question number", exact: true })).toBeVisible();
    await page.getByRole("radio").nth(1).check();
    await expect(page.getByText("1 of 160 answered", { exact: true })).toBeVisible();
    await expect(page.getByText("Progress saved to your account", { exact: true })).toBeVisible();
    const saved = await (await alice.get(`/api/exams/attempts/${id}`)).json() as AttemptView;
    expect(saved.responses[0].choiceLabel).toBe("B");
    await page.reload();
    await expect(page.getByRole("radio").nth(1)).toBeChecked();
    expect((await (await alice.get(`/api/exams/attempts/${id}`)).json()).deadlineAt).toBe(attempt.deadlineAt);
    expect((await bob.get(`/api/exams/attempts/${id}`)).status()).toBe(404);
    expect((await bob.patch(`/api/exams/attempts/${id}`, { data: { revision: saved.revision, responses: [{ questionKey: attempt.questions[0].questionKey, choiceLabel: "B", flagged: false }] } })).status()).toBe(404);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    // Only this generated fixture's deadline is shortened; actual mocks always use 150 minutes.
    await db.attempt.update({ where: { id }, data: { deadlineAt: new Date(Date.now() + 3000) } });
    await page.reload();
    await expect(page.getByText(/Time ended\. Only responses saved/)).toBeVisible({ timeout: 12000 });
    const expired = await (await alice.get(`/api/exams/attempts/${id}`)).json() as AttemptView;
    expect(expired.status).toBe("EXPIRED"); expect(expired.result?.correct).toBe(1); expect(expired.result?.unanswered).toBe(159);
    expect(expired.result?.answers).toHaveLength(160);
    expect((await alice.patch(`/api/exams/attempts/${id}`, { data: { revision: expired.revision, responses: [{ questionKey: expired.questions[1].questionKey, choiceLabel: "B", flagged: false }] } })).status()).toBe(409);
    expect((await alice.post(`/api/exams/attempts/${id}`, { data: { action: "submit" } })).status()).toBe(200);
    expect(await db.auditEvent.count({ where: { targetId: id, action: "exam.expire" } })).toBe(1);
    const subStart = await start(subprofessional.id);
    expect(subStart.status()).toBe(201); const sub = await subStart.json() as AttemptView;
    expect(sub.questions.every(q => !["data", "analogies", "logic"].includes(q.topic))).toBe(true);
    expect(sub.questions.some(q => q.topic === "filing")).toBe(true);
    expect((await alice.post(`/api/exams/attempts/${sub.id}`, { data: { action: "submit" } })).status()).toBe(200);
    // Edits invalidate only future starts; started attempts retain their snapshots.
    const changed = records.find(q => q.key === timedMockDefinitions[0].questionKeys[0])!;
    await db.question.update({ where: { id: changed.id }, data: { prompt: changed.prompt + " Later synthetic edit." } });
    expect((await start(professional.id)).status()).toBe(409);
    expect((await (await alice.get(`/api/exams/attempts/${id}`)).json()).questions).toEqual(attempt.questions);
    expect(activate().status).toBe(0);
    const ordinary = await db.examTemplate.create({ data: { slug: `ordinary-mock-${prefix}`, title: "Unreleased draft mock fixture", level: "PROFESSIONAL", mode: "MOCK", access: "FREE", topics: ["arithmetic"], questionCount: 1, durationSeconds: 60 } });
    templateIds.push(ordinary.id);
    expect((await admin.post("/api/admin/exam-templates", { data: { action: "activate", id: ordinary.id, version: ordinary.version } })).status()).toBe(409);
    await db.examTemplate.update({ where: { id: professional.id }, data: { access: "PREMIUM" } });
    expect(activate().status).toBe(1);
    expect((await (await alice.get("/api/exams/templates")).json() as ExamOption[]).some(t => t.id === professional.id)).toBe(false);
    expect(await db.review.count()).toBe(reviewCount);
  } finally {
    const ids = await db.examTemplate.findMany({ where: { OR: [{ id: { in: templateIds } }, { slug: { in: slugs } }] }, select: { id: true } });
    await db.attempt.deleteMany({ where: { templateId: { in: ids.map(t => t.id) } } });
    await db.examTemplate.deleteMany({ where: { id: { in: ids.map(t => t.id) } } });
    await db.question.deleteMany({ where: { id: { in: records.map(q => q.id) } } });
    await Promise.all(clients.map(client => client.dispose()));
    await db.$disconnect();
  }
});
