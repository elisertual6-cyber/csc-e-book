import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { findReviewerSupplement } from "../src/lib/reviewer-supplements";
import { reviewerGuides, reviewerLessonTitle } from "../src/lib/reviewer-catalog";

test("learners can find a reviewer, filter tracks, read its chapters and print all teaching content", async ({ page }, info) => {
  test.setTimeout(90000);
  await page.goto("/reviewers");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A reviewer for every step forward.");
  const library = page.locator("#subject-reviewers");
  await page.screenshot({ path: `.local/reviewers-hub-${info.project.name}.png`, fullPage: true });
  await library.screenshot({ path: `.local/reviewers-shelf-${info.project.name}.png` });
  await expect(library.getByRole("article")).toHaveCount(6);
  await page.getByLabel("Search reviewers", { exact: true }).fill("Filipino");
  await expect(library.getByRole("article")).toHaveCount(1);
  await expect(library.getByRole("heading", { name: "Verbal Ability", exact: true })).toBeVisible();
  await page.getByLabel("Search reviewers", { exact: true }).fill("");
  await expect(page.getByRole("combobox", { name: "Study track", exact: true })).toBeVisible();
  await page.getByLabel("Study track", { exact: true }).selectOption("PROFESSIONAL");
  await expect(library.getByRole("article")).toHaveCount(5);
  await expect(library.getByRole("heading", { name: "Clerical Ability", exact: true })).toHaveCount(0);
  await page.getByLabel("Search reviewers", { exact: true }).fill("clerical");
  await expect(page.getByRole("heading", { name: "No matching reviewers." })).toBeVisible();
  await page.getByRole("button", { name: "Reset reviewer filters", exact: true }).click();
  await expect(page.getByLabel("Study track", { exact: true })).toHaveValue("all");
  await expect(page.getByLabel("Search reviewers", { exact: true })).toBeFocused();
  await expect(library.getByRole("article")).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Open Numerical Ability reviewer →", exact: true }).click();
  await expect(page).toHaveURL(/\/reviewers\/numerical-ability$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Numerical Ability");
  const contents = page.getByRole("navigation", { name: "Reviewer contents", exact: true });
  await expect(contents.getByRole("link")).toHaveCount(6);
  await contents.getByRole("link", { name: "Fractions, decimals, and percentages", exact: true }).click();
  await expect(page).toHaveURL(/#fractions$/);
  await expect(page.locator(".reviewer-chapter")).toHaveCount(6);
  await expect(page.getByRole("heading", { name: "Rationale", exact: true })).toHaveCount(6);
  await contents.getByRole("link", { name: /Extra lesson:/ }).click();
  await expect(page).toHaveURL(/#extra-practice$/);
  await expect(page.locator(".reviewer-supplement")).toContainText("81 km/h");
  await expect(page.locator(".reviewer-supplement")).toContainText("1,386 units");
  await page.screenshot({ path: `.local/reviewers-reader-${info.project.name}.png` });
  await page.evaluate(() => { window.print = () => { document.documentElement.dataset.printRequested = "yes"; }; });
  await page.getByRole("button", { name: "Print / Save as PDF", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-print-requested", "yes");
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print / Save as PDF", exact: true })).toBeHidden();
  await expect(page.locator(".site-header")).toBeHidden();
  await expect(page.locator(".reviewer-chapter")).toHaveCount(6);
  await expect(page.locator(".reviewer-checkpoints")).toBeVisible();
  const pdf = await PDFDocument.load(await page.pdf({ format: "A4", printBackground: true }));
  expect(pdf.getPageCount()).toBeGreaterThanOrEqual(6);
  await page.emulateMedia({ media: "screen" });
  await page.getByRole("link", { name: "Next reviewer: Verbal Ability →", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Verbal Ability");
  await expect(page.locator("#filipino")).toHaveAttribute("lang", "fil");
});

test("all six public reviewer guides contain their full lesson chapters and reject unknown slugs", async ({ page, request }) => {
  const covered = new Set<string>();
  for (const guide of reviewerGuides) {
    await page.goto(`/reviewers/${guide.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(guide.title);
    await expect(page.locator(".reviewer-reader-header .notice")).toContainText("UNREVIEWED TEACHING DRAFT");
    for (const slug of guide.lessons) {
      expect(covered.has(slug)).toBe(false); covered.add(slug);
      const chapter = page.locator(`#${slug}`);
      await expect(chapter.getByRole("heading", { level: 2, name: reviewerLessonTitle(slug), exact: true })).toBeVisible();
      await expect(chapter.locator(".prose")).toContainText("Practice");
      await expect(chapter.locator(".prose")).toContainText("Rationale");
    }
    const supplement = page.locator(".reviewer-supplement");
    await expect(supplement.getByRole("heading", { level: 2 })).toHaveText(findReviewerSupplement(guide.slug)!.title);
    await expect(supplement).toContainText("Draft editorial supplement");
    await expect(supplement.getByRole("heading", { level: 4, name: /^Example [12]:/ })).toHaveCount(2);
    await expect(supplement).toContainText("Practice");
    await expect(supplement).toContainText("Rationale");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(covered.size).toBe(23);
  expect((await request.get("/reviewers/not-a-real-guide")).status()).toBe(404);
  expect((await request.get("/reviewers/series-2-core.json")).status()).toBe(404);
  await page.goto("/shop");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A reviewer for every step forward.");
  await expect(page.locator("#pdf-editions")).toBeVisible();
});
