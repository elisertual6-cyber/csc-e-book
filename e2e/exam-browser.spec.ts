import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { examFixture } from "./exam-fixtures";
test("learner can resume, flag, submit and review a session on this screen", async ({
  playwright,
  browser,
}, testInfo) => {
  test.setTimeout(120000);
  const f = await examFixture(playwright);
  try {
    const practice = await f.template("browser-practice");
    const sub = await f.template("browser-clerical", {
      level: "SUBPROFESSIONAL",
      topics: [f.clerical],
      questionCount: 1,
    });
    const context = await browser.newContext({
      storageState: await f.alice.storageState(),
      viewport:
        testInfo.project.name === "mobile"
          ? { width: 390, height: 844 }
          : { width: 1280, height: 900 },
    });
    context.setDefaultTimeout(15000);
    const page = await context.newPage();
    await page.goto(`${f.origin}/practice`);
    await page
      .getByRole("combobox", { name: "Learning track", exact: true })
      .selectOption("SUBPROFESSIONAL");
    await expect(page.getByText(sub.title, { exact: true })).toBeVisible();
    await page
      .getByRole("combobox", { name: "Learning track", exact: true })
      .selectOption("PROFESSIONAL");
    await page.getByRole("radio", { name: new RegExp(practice.title) }).check();
    await page
      .getByRole("button", { name: "Start this session", exact: true })
      .click();
    await expect(page).toHaveURL(/\/practice\/[^/]+$/);
    await expect(
      page.getByRole("heading", { name: practice.title, exact: true }),
    ).toBeVisible();
    await page.locator('input[name="answer"][value="B"]').check();
    await expect(page.locator('input[name="answer"][value="B"]')).toBeChecked();
    await page
      .getByLabel("Flag this question for review", { exact: true })
      .check();
    await expect(
      page.getByLabel("Flag this question for review", { exact: true }),
    ).toBeChecked();
    await expect(page.getByRole("status")).toHaveText("Saved to your account.");
    await page.reload();
    await expect(
      page.getByLabel("Flag this question for review", { exact: true }),
    ).toBeChecked();
    await expect(page.locator('input[name="answer"][value="B"]')).toBeChecked();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.locator('input[name="answer"][value="B"]').check();
    await expect(page.locator('input[name="answer"][value="B"]')).toBeChecked();
    await page
      .getByRole("button", {
        name: "Submit and view explanations",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your practice result", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("(100%)", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Answers and detailed explanations",
        exact: true,
      }),
    ).toBeVisible();
    const reviews = page.locator(".answer-review");
    await expect(reviews).toHaveCount(2);
    const graded = await (await f.alice.get(`/api/exams/attempts/${new URL(page.url()).pathname.split("/").at(-1)}`)).json();
    for (const [index, question] of graded.questions.entries()) {
      const correctText = question.choices.find((c: { label: string; text: string }) => c.label === "B").text;
      await expect(reviews.nth(index).getByText(`Your answer: B — ${correctText}`, { exact: true })).toBeVisible();
      await expect(reviews.nth(index).getByText(`Correct answer: B — ${correctText}`, { exact: true })).toBeVisible();
    }
    await mkdir(".local", { recursive: true });
    await page.screenshot({
      path: `.local/phase3-result-${testInfo.project.name}.png`,
      fullPage: true,
    });
    await page
      .getByRole("link", { name: "History & subject reports →", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Subject performance", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".exam-metrics").getByText("100%", { exact: true })).toBeVisible();
    // A browser clock set to the past cannot keep an expired mock open.
    const timed = await f.template("browser-timed", {
      mode: "MOCK",
      durationSeconds: 60,
    });
    const response = await f.alice.post("/api/exams/attempts", {
      data: { templateId: timed.id, startKey: crypto.randomUUID() },
    });
    expect(response.status()).toBe(201);
    const attempt = await response.json();
    const saved = await f.alice.patch(`/api/exams/attempts/${attempt.id}`, {
      data: { revision: attempt.revision, responses: [{ questionKey: attempt.questions[0].questionKey, choiceLabel: "A", flagged: false }] },
    });
    expect(saved.status()).toBe(200);
    await f.db.attempt.update({
      where: { id: attempt.id },
      data: { deadlineAt: new Date(Date.now() - 1000) },
    });
    await page.addInitScript(() => {
      Date.now = () => 0;
    });
    await page.goto(`${f.origin}/practice/${attempt.id}`);
    await expect(
      page.getByText(
        "Time ended. Only responses saved before the server deadline were graded.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Your practice result", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".answer-review").first().getByText("Your answer: A — 4", { exact: true })).toBeVisible();
    await expect(page.locator(".answer-review").nth(1).getByText("Your answer: Unanswered", { exact: true })).toBeVisible();
    await expect(page.locator(".answer-review").first().getByText(/^Correct answer: B — (5|11)$/)).toBeVisible();
    await context.close();
  } finally {
    await f.dispose();
  }
});
