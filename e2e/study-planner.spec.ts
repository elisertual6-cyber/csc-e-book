import { test, expect } from "@playwright/test";
import { plannerStorageKey } from "../src/lib/study-plan";

test("planner separates tracks, saves only by choice and prints a complete schedule", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Study planner", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your 30-day study plan." })).toBeVisible();
  const track = page.getByRole("combobox", { name: "Learning track", exact: true });
  await expect(track).toBeEnabled();
  expect(await page.evaluate(key => localStorage.getItem(key), plannerStorageKey)).toBeNull();
  await page.getByRole("button", { name: "Mark day complete", exact: true }).click();
  await expect(page.getByText("1 of 30 days marked complete", { exact: true })).toBeVisible();
  await page.reload();
  await expect(track).toBeEnabled();
  await expect(page.getByText("0 of 30 days marked complete", { exact: true })).toBeVisible();
  await page.getByLabel("Save progress on this browser", { exact: true }).check();
  await page.getByRole("combobox", { name: "Daily study time", exact: true }).selectOption("15");
  await page.getByLabel("Start date (optional)", { exact: true }).fill("2028-02-28");
  await page.getByRole("button", { name: "Day 3", exact: true }).click();
  await expect(page.getByText("DAY 3 · Mar 1, 2028", { exact: true })).toBeVisible();
  await expect(page.getByText(/Suggested session: 3 minutes.*7 minutes.*5 minutes/)).toBeVisible();
  await page.getByRole("button", { name: "Mark day complete", exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}").completed?.PROFESSIONAL?.includes(3), plannerStorageKey)).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Day 3, complete", exact: true })).toHaveAttribute("aria-pressed", "true");
  await track.selectOption("SUBPROFESSIONAL");
  await expect(page.getByText("0 of 30 days marked complete", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Day 17", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Apply the stated filing rule consistently", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open draft: Apply the stated filing rule/ })).toHaveAttribute("href", "/lessons/filing");
  await track.selectOption("PROFESSIONAL");
  await expect(page.getByRole("heading", { name: "Name the relationship before matching the words", exact: true })).toBeVisible();
  await expect(page.getByText("1 of 30 days marked complete", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Day 7", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catch up or rest", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("region", { name: "Printable 30-day schedule" })).toBeVisible();
  await expect(page.locator(".planner-print tbody tr")).toHaveCount(30);
  await expect(page.getByRole("combobox", { name: "Learning track", exact: true })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.getByLabel("Save progress on this browser", { exact: true }).uncheck();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), plannerStorageKey)).toBeNull();
  await page.screenshot({ path: `.local/planner-${testInfo.project.name}.png`, fullPage: true });
});

test("unreadable saved data does not prevent a fresh plan", async ({ page }) => {
  await page.goto("/study-plan");
  await expect(page.getByRole("combobox", { name: "Learning track", exact: true })).toBeEnabled();
  await page.evaluate(key => localStorage.setItem(key, "not-json"), plannerStorageKey);
  await page.reload();
  await expect(page.getByRole("status")).toContainText("saved plan could not be read");
  await expect(page.getByRole("combobox", { name: "Learning track", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Save progress on this browser", { exact: true })).not.toBeChecked();
  await page.getByRole("button", { name: "Day 30", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reflect and plan your next steps", exact: true })).toBeVisible();
});

test("blocked browser storage leaves the planner usable without saving", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get: () => { throw new DOMException("Storage blocked", "SecurityError"); } });
  });
  await page.goto("/study-plan");
  await expect(page.getByRole("status")).toContainText("Browser saving is unavailable");
  await expect(page.getByRole("combobox", { name: "Learning track", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Save progress on this browser", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Mark day complete", exact: true }).click();
  await expect(page.getByText("1 of 30 days marked complete", { exact: true })).toBeVisible();
});
