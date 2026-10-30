import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { examFixture } from "./exam-fixtures";

type Finding = { state: string; rule: string; targets: (string | string[])[][] };
async function scan(page: Page, state: string, findings: Finding[]) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${state}: no horizontal overflow`).toBe(true);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  findings.push(...results.violations.map(v => ({ state, rule: v.id, targets: v.nodes.map(n => n.target) })));
}
function guard() {
  expect(new URL(process.env.DATABASE_URL ?? "").pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/);
}

test("signed-in learner screens and keyboard attempt flow meet automated accessibility checks", async ({ page, context, playwright }) => {
  test.setTimeout(180000);
  guard();
  const f = await examFixture(playwright);
  const findings: Finding[] = [];
  try {
    await context.addCookies((await f.alice.storageState()).cookies);
    const template = await f.template("accessibility", { questionCount: 1 });
    for (const route of ["/account", "/account/purchases", "/practice", "/practice/history"]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      if (route === "/account") {
        await expect(page.getByRole("link", { name: "Start practising →", exact: true })).toBeVisible();
        await page.getByText("Account settings and tools", { exact: true }).click();
        await expect(page.getByRole("heading", { name: "Account security", exact: true })).toBeVisible();
      }
      if (route === "/practice") await expect(page.getByRole("radio", { name: new RegExp(template.title) })).toBeVisible();
      if (route === "/practice/history") await expect(page.getByRole("heading", { name: "Subject performance" })).toBeVisible();
      if (route === "/account/purchases") await expect(page.getByRole("link", { name: "Browse editions", exact: true })).toBeVisible();
      await scan(page, `learner:${route}`, findings);
    }
    const product = await f.db.product.findUniqueOrThrow({ where: { slug: "basic" }, include: { prices: true } });
    await f.db.order.create({ data: { userId: f.users[2].id, paymentMethod: "gcash", totalMinor: product.prices[0].amountMinor, items: { create: { productId: product.id, priceId: product.prices[0].id, unitPriceMinor: product.prices[0].amountMinor, productName: "Synthetic accessibility order", productVersion: product.version } } } });
    await page.goto("/account/purchases");
    await expect(page.getByRole("heading", { name: "Synthetic accessibility order", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Pay with GCash (sandbox)", exact: true })).toBeDisabled();
    await scan(page, "learner:pending-order-checkout-disabled", findings);
    const started = await f.alice.post("/api/exams/attempts", { data: { templateId: template.id, startKey: randomUUID() } });
    expect(started.status()).toBe(201);
    const attempt = await started.json();
    await page.goto(`/practice/${attempt.id}`);
    await expect(page.getByRole("heading", { name: template.title, exact: true })).toBeVisible();
    await scan(page, "learner:active-attempt", findings);
    // The skip link, question navigation and native radio group must all be
    // reachable without a mouse. Use the browser's real Tab/Space behavior.
    await page.getByRole("link", { name: "Skip to content", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Question 1", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator('input[name="answer"][value="A"]')).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status")).toHaveText("Saved to your account.");
    await expect(page.locator('input[name="answer"][value="A"]')).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Flag this question for review", { exact: true })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByRole("status")).toHaveText("Saved to your account.");
    await expect(page.getByRole("button", { name: "Question 1, flagged, answered", exact: true })).toBeVisible();
    await expect(page.getByLabel("Flag this question for review", { exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Clear answer", exact: true })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Submit and view explanations", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Your practice result", exact: true })).toBeVisible();
    await scan(page, "learner:graded-result", findings);
    await page.goto("/practice/history");
    await expect(page.getByRole("link", { name: "Review explanations", exact: true })).toBeVisible();
    await scan(page, "learner:populated-history", findings);
    // Holding an acknowledgement must not pull focus back if the learner
    // moves to a different question using the still-available navigation.
    const navigationTemplate = await f.template("accessibility-focus-navigation", { questionCount: 2 });
    const second = await f.alice.post("/api/exams/attempts", { data: { templateId: navigationTemplate.id, startKey: randomUUID() } });
    expect(second.status()).toBe(201);
    const nextAttempt = await second.json();
    let release: (() => void) | undefined;
    let observed: (() => void) | undefined;
    const held = new Promise<void>(resolve => { release = resolve; });
    const saving = new Promise<void>(resolve => { observed = resolve; });
    await page.route(`**/api/exams/attempts/${nextAttempt.id}`, async route => {
      if (route.request().method() === "PATCH") { observed?.(); await held; }
      await route.continue();
    });
    try {
      await page.goto(`/practice/${nextAttempt.id}`);
      await expect(page.getByRole("heading", { name: navigationTemplate.title, exact: true })).toBeVisible();
      await page.locator('input[name="answer"][value="A"]').focus();
      await page.keyboard.press("Space");
      await saving;
      const secondQuestion = page.getByRole("button", { name: "Question 2", exact: true });
      await secondQuestion.focus();
      await page.keyboard.press("Enter");
      release?.();
      await expect(page.getByRole("status")).toHaveText("Saved to your account.");
      await expect(secondQuestion).toBeFocused();
    } finally { release?.(); await page.unrouteAll({ behavior: "wait" }); }
    expect(findings).toEqual([]);
  } finally { await f.dispose(); }
});

test("administrator, editor and independent reviewer workspaces meet automated accessibility checks", async ({ page, context, playwright }) => {
  test.setTimeout(240000);
  page.setDefaultTimeout(15000);
  guard();
  const f = await examFixture(playwright);
  const findings: Finding[] = [];
  try {
    await f.db.user.update({ where: { id: f.users[4].id }, data: { role: "EDITOR" } });
    const editor = await f.context(4);
    const response = await f.admin.post("/api/admin/questions", { data: { action: "create", data: f.questionData(`${f.prefix}-accessibility-review`, f.numbers, "COMMON", "Which test value belongs in the review draft?") } });
    expect(response.status()).toBe(201);
    const draft = await response.json();
    const submitted = await f.admin.post("/api/admin/questions", { data: { action: "submit", id: draft.id, revision: draft.revision } });
    expect(submitted.status()).toBe(200);
    for (const [role, session] of [["ADMIN", f.admin], ["EDITOR", editor], ["REVIEWER", f.reviewer]] as [string, APIRequestContext][]) {
      await context.clearCookies();
      await context.addCookies((await session.storageState()).cookies);
      await page.goto("/admin");
      await expect(page.getByRole("heading", { name: "Make every explanation count.", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "PDF workspace", exact: true })).toBeVisible();
      const pdfPanel = page.locator("section").filter({ has: page.getByRole("heading", { name: "PDF workspace", exact: true }) }).last();
      const copyJob = pdfPanel.getByRole("button", { name: "Copy worker job", exact: true });
      await expect(copyJob).toBeDisabled();
      const lessonResponse = await session.get("/api/admin/lessons");
      const lessonOptions = await lessonResponse.json();
      const editionCount = await f.db.pdfEdition.count();
      await pdfPanel.getByRole("group", { name: "Include lessons", exact: true }).locator('input[type="checkbox"]').first().check();
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } });
      });
      await copyJob.focus();
      await page.keyboard.press("Enter");
      const jobText = pdfPanel.getByRole("textbox", { name: "Worker job JSON", exact: true });
      await expect(jobText).toBeVisible();
      const job = JSON.parse(await jobText.inputValue());
      expect(job).toEqual({ title: "Philippine Civil Service Exam Reviewer 2027", version: "0.2.0-draft.1", kind: "DRAFT", lessonIds: [lessonOptions[0].id], questionIds: [] });
      await expect(pdfPanel.getByRole("status")).toContainText("Worker job copied");
      await expect(copyJob).toBeFocused();
      await pdfPanel.getByRole("textbox", { name: "Publication version", exact: true }).fill("invalid version");
      await expect(jobText).toHaveCount(0);
      await copyJob.click();
      await expect(pdfPanel.getByRole("status")).toContainText("version using only");
      await expect(jobText).toHaveCount(0);
      await pdfPanel.getByRole("textbox", { name: "Publication version", exact: true }).fill("proof-001");
      if (role === "ADMIN") {
        await pdfPanel.getByRole("combobox").selectOption("PREVIEW");
        await expect(copyJob).toBeDisabled();
        await pdfPanel.getByRole("combobox").selectOption("DRAFT");
      }
      await page.evaluate(() => {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Clipboard blocked"); } } });
      });
      await copyJob.click();
      await expect(pdfPanel.getByRole("status")).toContainText("Automatic copying is unavailable");
      await expect(jobText).toHaveValue(JSON.stringify({ kind: "DRAFT", version: "proof-001", title: "Philippine Civil Service Exam Reviewer 2027", lessonIds: [lessonOptions[0].id], questionIds: [] }));
      expect(await f.db.pdfEdition.count()).toBe(editionCount);
      await scan(page, `${role}:lesson-workspace`, findings);
      const questions = page.getByRole("group", { name: "Content type" }).getByRole("button", { name: "Questions", exact: true });
      await questions.focus();
      await page.keyboard.press("Enter");
      await expect(questions).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("textbox", { name: "Question key", exact: true })).toBeVisible();
      await scan(page, `${role}:question-workspace`, findings);
      if (role !== "REVIEWER") {
        await page.getByRole("radio", { name: "Correct answer: B", exact: true }).focus();
        await page.keyboard.press("Space");
        await expect(page.getByRole("radio", { name: "Correct answer: B", exact: true })).toBeChecked();
      }
      await page.locator(".record-list .record").filter({ hasText: draft.prompt }).click();
      await expect(page.getByRole("textbox", { name: "Review notes", exact: true })).toBeVisible();
      await scan(page, `${role}:submitted-question`, findings);
      if (role === "REVIEWER") await expect(page.getByRole("button", { name: "Approve reviewed version", exact: true })).toBeVisible();
      const chapters = page.getByRole("group", { name: "Content type" }).getByRole("button", { name: "Chapters", exact: true });
      await chapters.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: "New chapter", exact: true })).toBeVisible();
      await scan(page, `${role}:chapter-workspace`, findings);
      if (role === "ADMIN") {
        await page.goto("/admin/exams");
        await expect(page.getByRole("button", { name: "Create inactive template", exact: true })).toBeVisible();
        await scan(page, "ADMIN:exam-templates", findings);
        await page.goto("/admin/products");
        await expect(page.getByRole("button", { name: "Create inactive product", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Basic Reviewer", exact: true })).toBeVisible();
        await scan(page, "ADMIN:products", findings);
      } else {
        await page.goto("/admin/exams");
        await expect(page).toHaveURL(/\/account$/);
        await page.goto("/admin/products");
        await expect(page).toHaveURL(/\/account$/);
      }
    }
    expect(findings).toEqual([]);
  } finally { await f.dispose(); }
});
