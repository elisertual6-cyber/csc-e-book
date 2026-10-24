import { test, expect } from "@playwright/test";
import { draftLessons } from "../src/lib/lesson-catalog";
test("learners can browse all draft lessons and continue in reading order", async ({ page, request }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Browse draft lessons" }).click();
  await expect(page.getByRole("heading", { name: "Free draft lessons." })).toBeVisible();
  await expect(page.getByText(/All 8 lessons are original editorial drafts/)).toBeVisible();
  for (const lesson of draftLessons) {
    await page.getByRole("link", { name: `Read lesson: ${lesson.title} →` }).click();
    await expect(page.getByRole("heading", { name: lesson.title, exact: true })).toBeVisible();
    await expect(page).toHaveTitle(/draft lesson/);
    await expect(page.getByText("DRAFT · NOT EDITORIALLY APPROVED", { exact: true })).toBeVisible();
    for (const heading of ["Learning objectives", "Explanation", "Worked example", "Practice", "Rationale"]) await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "← All draft lessons", exact: true }).click();
  }
  await page.goto("/lessons/arithmetic");
  await page.getByRole("link", { name: /Next: Different forms/ }).click();
  await expect(page).toHaveURL(/\/lessons\/fractions$/);
  await page.getByRole("link", { name: /Previous: A little order/ }).click();
  await expect(page).toHaveURL(/\/lessons\/arithmetic$/);
  for (const path of ["/lessons/not-a-lesson", "/lessons/questions.json", "/content/editorial/numerical-foundations.json"]) expect((await request.get(path)).status()).toBe(404);
  await page.goto("/curriculum?track=SUBPROFESSIONAL");
  await expect(page.getByRole("link", { name: /Read draft:/ })).toHaveCount(8);
  await page.getByRole("link", { name: "Read draft: Mathematical word problems", exact: true }).click();
  await expect(page).toHaveURL(/\/lessons\/word-problems$/);
  expect((await request.get("/content/editorial/english-foundations.json")).status()).toBe(404);
});
