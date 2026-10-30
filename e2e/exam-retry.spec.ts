import { test, expect, type APIResponse } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { examFixture } from "./exam-fixtures";
import type { AttemptView } from "../src/lib/exam-types";
import type { Prisma } from "@prisma/client";
async function body(response: APIResponse, status = 200): Promise<AttemptView> {
  expect(response.status(), await response.text()).toBe(status); return response.json();
}
function guard() { expect(new URL(process.env.DATABASE_URL!).pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/); }

test("focused retries use missed saved questions, hide keys and keep the original result", async ({ page, context, playwright }) => {
  test.setTimeout(150000); guard();
  const f = await examFixture(playwright);
  try {
    const template = await f.template("retry-browser", { topics: [f.numbers, f.logic], questionCount: 3 });
    const source = await body(await f.alice.post("/api/exams/attempts", { data: { templateId: template.id, startKey: randomUUID() } }), 201);
    expect((await f.alice.post(`/api/exams/attempts/${source.id}/retry`, { data: { startKey: randomUUID(), selection: "missed" } })).status()).toBe(409);
    await body(await f.alice.patch(`/api/exams/attempts/${source.id}`, { data: { revision: source.revision, responses: [
      { questionKey: source.questions[0].questionKey, choiceLabel: "B", flagged: false },
      { questionKey: source.questions[1].questionKey, choiceLabel: "A", flagged: true },
    ] } }));
    const graded = await body(await f.alice.post(`/api/exams/attempts/${source.id}`, { data: { action: "submit" } }));
    const frozen = await f.db.attempt.findUniqueOrThrow({ where: { id: source.id }, include: { responses: true } });
    await context.addCookies((await f.alice.storageState()).cookies);
    await page.goto(`/practice/${source.id}`);
    await expect(page.getByRole("heading", { name: "Practise what you missed", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Questions to retry", exact: true })).toHaveValue("missed");
    await page.getByRole("button", { name: "Question 3", exact: true }).click();
    const keys: string[] = [];
    let hideFirstResponse = true;
    await page.route(`**/api/exams/attempts/${source.id}/retry`, async route => {
      keys.push(route.request().postDataJSON().startKey);
      const response = await route.fetch();
      if (hideFirstResponse) { hideFirstResponse = false; await route.abort("failed"); }
      else await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "Start focused practice", exact: true }).click();
    await expect(page.getByRole("status", { name: "Focused practice start", exact: true })).toContainText("could not be confirmed");
    await page.getByRole("button", { name: "Start focused practice", exact: true }).click();
    await expect(page).not.toHaveURL(new RegExp(`/practice/${source.id}$`));
    await expect(page.getByRole("heading", { name: `Focused practice: ${template.title}`, exact: true })).toBeVisible();
    expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
    const id = new URL(page.url()).pathname.split("/").at(-1)!;
    const retry = await body(await f.alice.get(`/api/exams/attempts/${id}`));
    await expect(page.locator(".exam-question .eyebrow")).toContainText("QUESTION 1 OF 2");
    expect(retry.retry?.sourceAttemptId).toBe(source.id); expect(retry.series).toBeUndefined();
    expect(retry.mode).toBe("PRACTICE"); expect(retry.deadlineAt).toBeNull(); expect(retry.score).toBeNull(); expect(retry.result).toBeNull(); expect(retry.responses).toEqual([]);
    expect(retry.questions.map(question => question.prompt)).toEqual(source.questions.slice(1).map(question => question.prompt));
    expect(retry.questions.every(question => !source.questions.some(original => original.questionKey === question.questionKey))).toBe(true);
    for (const field of ["correctLabel", "isCorrect", "sourceId", "sourceVersion", "explanation", "questionSnapshot"]) expect(JSON.stringify(retry)).not.toContain(`"${field}"`);
    expect((await f.bob.get(`/api/exams/attempts/${id}`)).status()).toBe(404);
    expect(await f.db.auditEvent.count({ where: { action: "exam.start", targetId: id } })).toBe(1);
    await expect(page.getByRole("heading", { name: "Answers and detailed explanations", exact: true })).toHaveCount(0);
    await expect(page.getByRole("timer")).toHaveText("Untimed practice");
    await expect(page.getByRole("link", { name: "Back to the earlier result →", exact: true })).toHaveAttribute("href", `/practice/${source.id}`);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
    await page.locator('input[name="answer"][value="B"]').check();
    await expect(page.getByText("1 of 2 answered", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('input[name="answer"][value="B"]')).toBeChecked();
    await page.getByRole("button", { name: "Submit and view explanations", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your practice result", exact: true })).toBeVisible();
    const finished = await body(await f.alice.get(`/api/exams/attempts/${id}`));
    expect(finished.result?.correct).toBe(1); expect(finished.result?.unanswered).toBe(1);
    expect((await body(await f.alice.get(`/api/exams/attempts/${source.id}`))).result).toEqual(graded.result);
    const unchanged = await f.db.attempt.findUniqueOrThrow({ where: { id: source.id }, include: { responses: true } });
    expect(unchanged).toEqual(frozen);
    // New practice uses the stored version even if the current bank/template is edited.
    const stored = frozen.questionSnapshot as { questions: { sourceId: string }[] };
    await f.db.question.update({ where: { id: stored.questions[1].sourceId }, data: { prompt: "A later synthetic bank edit must not replace the saved question." } });
    await f.db.examTemplate.update({ where: { id: template.id }, data: { active: false } });
    const wrongOnly = await body(await f.alice.post(`/api/exams/attempts/${source.id}/retry`, { data: { startKey: randomUUID(), selection: "incorrect" } }), 201);
    expect(wrongOnly.questions.map(question => question.prompt)).toEqual([source.questions[1].prompt]);
    await body(await f.alice.post(`/api/exams/attempts/${wrongOnly.id}`, { data: { action: "submit" } }));
    const blankOnly = await body(await f.alice.post(`/api/exams/attempts/${source.id}/retry`, { data: { startKey: randomUUID(), selection: "unanswered" } }), 201);
    expect(blankOnly.questions.map(question => question.prompt)).toEqual([source.questions[2].prompt]);
    await body(await f.alice.patch(`/api/exams/attempts/${blankOnly.id}`, { data: { revision: blankOnly.revision, responses: [{ questionKey: blankOnly.questions[0].questionKey, choiceLabel: "B", flagged: false }] } }));
    await body(await f.alice.post(`/api/exams/attempts/${blankOnly.id}`, { data: { action: "submit" } }));
    expect((await f.alice.post(`/api/exams/attempts/${blankOnly.id}/retry`, { data: { startKey: randomUUID(), selection: "missed" } })).status()).toBe(409);
    await page.goto(`/practice/${blankOnly.id}`);
    await expect(page.getByRole("button", { name: "Start focused practice", exact: true })).toHaveCount(0);
    await expect(page.getByText("Every question was correct. There are no missed questions to retry.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
  } finally { await f.dispose(); }
});

test("retry API enforces ownership, mutation checks, strict input, idempotency and the shared active-session cap", async ({ playwright }) => {
  test.setTimeout(120000); guard(); const f = await examFixture(playwright);
  try {
    const template = await f.template("retry-security", { mode: "MOCK", durationSeconds: 60 });
    const source = await body(await f.alice.post("/api/exams/attempts", { data: { templateId: template.id, startKey: randomUUID() } }), 201);
    await f.db.attempt.update({ where: { id: source.id }, data: { deadlineAt: new Date(Date.now() - 1000) } });
    const url = `/api/exams/attempts/${source.id}/retry`;
    const data = { startKey: randomUUID(), selection: "missed" };
    expect((await f.anon.post(url, { data })).status()).toBe(401);
    expect((await f.bob.post(url, { data })).status()).toBe(404);
    expect((await f.alice.post(url, { headers: { Origin: "https://invalid.example" }, data })).status()).toBe(403);
    expect((await f.alice.post(url, { data: { ...data, score: 100, questionKeys: [source.questions[0].questionKey] } })).status()).toBe(400);
    expect((await f.alice.post(url, { data: { ...data, selection: "all" } })).status()).toBe(400);
    const pair = await Promise.all([f.alice.post(url, { data }), f.alice.post(url, { data })]);
    const a = await body(pair[0], 201), b = await body(pair[1], 201);
    expect(a.id).toBe(b.id); expect(a.mode).toBe("PRACTICE"); expect(a.deadlineAt).toBeNull();
    expect((await f.db.attempt.findUniqueOrThrow({ where: { id: source.id } })).status).toBe("EXPIRED");
    expect((await f.alice.post(url, { data: { ...data, selection: "unanswered" } })).status()).toBe(409);
    expect((await f.alice.post("/api/exams/attempts", { data: { templateId: template.id, startKey: data.startKey } })).status()).toBe(409);
    expect((await f.alice.post(`/api/exams/attempts/${a.id}/retry`, { data: { startKey: randomUUID(), selection: "missed" } })).status()).toBe(409);
    const stored = await f.db.attempt.findUniqueOrThrow({ where: { id: source.id } });
    const bobSource = await f.db.attempt.create({ data: { userId: f.users[3].id, templateId: template.id, status: "SUBMITTED", submittedAt: new Date(), totalQuestions: stored.totalQuestions,
      score: 0, questionSnapshot: stored.questionSnapshot as Prisma.InputJsonValue, templateSnapshot: stored.templateSnapshot as Prisma.InputJsonValue } });
    const quota = await Promise.all([0, 1, 2, 3].map(() => f.bob.post(`/api/exams/attempts/${bobSource.id}/retry`, { data: { startKey: randomUUID(), selection: "missed" } })));
    expect(quota.map(response => response.status()).sort()).toEqual([201, 201, 201, 409]);
    expect(await f.db.attempt.count({ where: { userId: f.users[3].id, status: "IN_PROGRESS" } })).toBe(3);
    expect((await f.alice.patch(`/api/exams/attempts/${a.id}`, { data: { revision: 0, responses: [{ questionKey: source.questions[0].questionKey, choiceLabel: "B", flagged: false }] } })).status()).toBe(400);
  } finally { await f.dispose(); }
});

test("premium retry creation, replay, reads and writes require current paid access", async ({ playwright }) => {
  test.setTimeout(120000); guard(); const f = await examFixture(playwright);
  try {
    const template = await f.template("retry-premium", { access: "PREMIUM" });
    const staffSource = await body(await f.admin.post("/api/exams/attempts", { data: { templateId: template.id, startKey: randomUUID() } }), 201);
    const stored = await f.db.attempt.findUniqueOrThrow({ where: { id: staffSource.id } });
    const source = await f.db.attempt.create({ data: { userId: f.users[2].id, templateId: template.id, status: "SUBMITTED", submittedAt: new Date(), totalQuestions: stored.totalQuestions, score: 0,
      questionSnapshot: stored.questionSnapshot as Prisma.InputJsonValue, templateSnapshot: stored.templateSnapshot as Prisma.InputJsonValue } });
    const url = `/api/exams/attempts/${source.id}/retry`, data = { startKey: randomUUID(), selection: "missed" };
    expect((await f.alice.post(url, { data })).status()).toBe(403);
    const product = await f.db.product.create({ data: { slug: `${f.prefix}-retry-product`, name: "Synthetic retry access", description: "Isolated test product", version: "test", grantsExams: true } });
    const price = await f.db.price.create({ data: { productId: product.id, amountMinor: 100, currency: "PHP" } });
    const order = await f.db.order.create({ data: { userId: f.users[2].id, status: "PAID", totalMinor: 100, currency: "PHP", items: { create: { productId: product.id, priceId: price.id, unitPriceMinor: 100 } } } });
    await f.db.payment.create({ data: { orderId: order.id, provider: "isolated-sandbox", providerEventId: randomUUID(), status: "VERIFIED", verifiedAt: new Date(), amountMinor: 100, currency: "PHP" } });
    const entitlement = await f.db.entitlement.create({ data: { userId: f.users[2].id, orderId: order.id, productId: product.id } });
    const retry = await body(await f.alice.post(url, { data }), 201);
    expect(retry.access).toBe("PREMIUM");
    await f.db.entitlement.update({ where: { id: entitlement.id }, data: { revokedAt: new Date() } });
    expect((await f.alice.post(url, { data })).status()).toBe(403);
    expect((await f.alice.post(url, { data: { ...data, startKey: randomUUID() } })).status()).toBe(403);
    expect((await f.alice.get(`/api/exams/attempts/${retry.id}`)).status()).toBe(403);
    expect((await f.alice.patch(`/api/exams/attempts/${retry.id}`, { data: { revision: 0, responses: [{ questionKey: retry.questions[0].questionKey, choiceLabel: "B", flagged: false }] } })).status()).toBe(403);
    expect((await f.alice.post(`/api/exams/attempts/${retry.id}`, { data: { action: "submit" } })).status()).toBe(403);
  } finally { await f.dispose(); }
});
