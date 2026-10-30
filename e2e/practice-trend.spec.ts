import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import type { AttemptHistory, AttemptSummary } from "../src/lib/exam-types";

test("recent trends filter matching sessions, explain incomplete comparisons and keep locked results private", async ({ page }, info) => {
  test.setTimeout(60000);
  // Real synthetic authentication; summary fixtures exercise presentation without creating or changing grades.
  const registered = await page.request.post("/api/auth/register", { headers: { Origin: "http://127.0.0.1:3100", "X-CSC-Action": "1" }, data: { name: "Trend Learner", email: `trend-${randomUUID()}@example.test`, password: randomUUID() + "-practice" } });
  expect(registered.status()).toBe(201);
  await page.goto("/practice/history");
  const trend = page.getByRole("region", { name: "Recent result trend", exact: true });
  await expect(trend).toContainText("Complete a practice session to see your result trend.");
  await expect(trend.getByRole("img")).toHaveCount(0);
  const row = (id: string, changes: Partial<AttemptSummary> = {}): AttemptSummary => ({ id, title: "Same practice", level: "COMMON", mode: "PRACTICE", status: "SUBMITTED", startedAt: "2026-10-01T00:00:00Z", deadlineAt: null, score: 4, totalQuestions: 4, accessLocked: false, byTopic: [], ...changes });
  const attempts = [row("active", { status: "IN_PROGRESS", score: null }), row("focused", { title: "Focused practice", score: 1, totalQuestions: 1 }), row("locked", { title: "Mock session", mode: "MOCK", level: "PROFESSIONAL", score: 3, accessLocked: true }), ...Array.from({ length: 10 }, (_, i) => row(`practice-${i}`, { score: 4 - i % 5, status: i === 1 ? "EXPIRED" : "SUBMITTED" }))];
  const summary: AttemptHistory = { attempts, completedCount: 12, averagePercent: 56.25, byTopic: [], limit: 50 };
  await page.route("**/api/exams/history", route => route.fulfill({ json: summary }));
  await page.reload();
  await expect(trend.getByRole("status", { name: "Trend selection" })).toHaveText("Showing 10 completed sessions.");
  await expect(trend.locator(".trend-metrics > div").last()).toContainText("+50");
  const details = trend.locator("details");
  await expect(details).not.toHaveAttribute("open");
  await details.locator("summary").focus(); await page.keyboard.press("Enter");
  await expect(details.getByRole("row")).toHaveCount(11);
  await expect(details.getByRole("link").first()).toHaveAttribute("href", "/practice/practice-7");
  await expect(details.getByRole("link", { name: "Review session 9 →", exact: true })).toHaveCount(0);
  await expect(details).toContainText("Current exam access required for explanations.");
  const select = trend.getByLabel("Compare sessions", { exact: true });
  const group = await select.getByRole("option", { name: /^Same practice/ }).getAttribute("value");
  await select.focus(); await select.selectOption(group!);
  await expect(select).toBeFocused();
  await expect(trend.getByRole("img")).toHaveAttribute("aria-label", "Practice results, oldest to newest: 0%, 25%, 50%, 75%, 100%, 0%, 25%, 50%, 75%, 100%. Full details are below.");
  await expect(trend.locator(".trend-metrics > div").last()).toContainText("+100");
  await expect(details.getByRole("link").first()).toHaveAttribute("href", "/practice/practice-9");
  await expect(details).toContainText("Expired");
  expect(await trend.locator("svg text").evaluateAll(nodes => nodes.every(node => {
    const box = (node as SVGGraphicsElement).getBBox();
    return box.x >= 0 && box.y >= 0 && box.x + box.width <= 640 && box.y + box.height <= 215;
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
  await trend.screenshot({ path: `.local/practice-trend-${info.project.name}.png` });
  const single = await select.getByRole("option", { name: /^Focused practice/ }).getAttribute("value");
  await select.selectOption(single!);
  await expect(trend.getByRole("status", { name: "Trend selection" })).toHaveText("Showing 1 completed session.");
  await expect(trend).toContainText("Complete another matching session to compare two results.");
  await expect(trend.locator(".trend-metrics > div").last()).toContainText("—");
  // The filter is presentation-only: it does not alter the original loaded history or persist scores.
  await expect(page.locator(".history-row")).toHaveCount(13);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await page.unroute("**/api/exams/history");
  await page.route("**/api/exams/history", route => route.fulfill({ status: 503, json: { error: "History temporarily unavailable." } }));
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("History temporarily unavailable.");
  await expect(trend).toHaveCount(0);
});
