import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { reviewerBookmarkStorageKey as key } from "../src/lib/reviewer-bookmarks";

test("chapter bookmarks persist, replace per guide, resume, synchronize tabs and clear without touching other storage", async ({ page, context }, info) => {
  test.setTimeout(90000);
  await page.goto("/reviewers/numerical-ability");
  const saved = page.getByRole("region", { name: "Saved reviewer chapters", exact: true });
  await expect(saved).toContainText("No saved chapter in this guide yet");
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  const arithmetic = page.locator("#arithmetic").getByRole("button", { name: /^Bookmark chapter:/ });
  const fractions = page.locator("#fractions").getByRole("button", { name: /^Bookmark chapter:/ });
  await arithmetic.focus(); await page.keyboard.press("Space");
  await expect(arithmetic).toHaveAttribute("aria-pressed", "true");
  await expect(arithmetic).toBeFocused();
  await expect(saved.getByRole("link")).toHaveCount(1);
  await fractions.click();
  await expect(arithmetic).toHaveAttribute("aria-pressed", "false");
  await expect(fractions).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(fractions).toHaveAttribute("aria-pressed", "true");
  const raw = await page.evaluate(key => localStorage.getItem(key), key);
  expect(JSON.parse(raw!)).toEqual({ version: 1, bookmarks: [{ guide: "numerical-ability", chapter: "fractions" }] });
  const other = await context.newPage();
  await other.goto("/reviewers/numerical-ability");
  const extra = other.locator("#extra-practice").getByRole("button", { name: /^Bookmark chapter:/ });
  await extra.click();
  await expect(fractions).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#extra-practice").getByRole("button", { name: /^Bookmark chapter:/ })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/reviewers/verbal-ability");
  await page.locator("#grammar").getByRole("button", { name: /^Bookmark chapter:/ }).click();
  await page.goto("/reviewers");
  await expect(saved.getByRole("link")).toHaveCount(2);
  await saved.screenshot({ path: `.local/bookmarks-shelf-${info.project.name}.png` });
  await expect(saved.getByRole("link").first()).toContainText("Verbal Ability:");
  await saved.getByRole("link", { name: /^Numerical Ability:/ }).click();
  await expect(page).toHaveURL(/\/reviewers\/numerical-ability#extra-practice$/);
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector("#extra-practice")!.getBoundingClientRect().top) < 100)).toBe(true);
  await expect(page.locator("#extra-practice").getByRole("button", { name: /^Bookmark chapter:/ })).toHaveAttribute("aria-pressed", "true");
  await page.locator("#extra-practice").getByRole("button", { name: /^Bookmark chapter:/ }).click();
  await expect(saved).toContainText("No saved chapter in this guide yet");
  await page.goto("/shop");
  await expect(saved.getByRole("link")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.evaluate(() => localStorage.setItem("unrelated-setting", "keep"));
  await saved.getByRole("button", { name: "Clear all reviewer bookmarks", exact: true }).click();
  await expect(saved.getByRole("heading", { name: "Continue reading", exact: true })).toBeFocused();
  await expect(saved).toContainText("No saved chapters yet");
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("unrelated-setting"))).toBe("keep");
  await other.goto("/reviewers");
  await expect(other.getByRole("region", { name: "Saved reviewer chapters" })).toContainText("No saved chapters yet");
  await other.close();
});

test("invalid stored references cannot create arbitrary links and can be replaced or cleared", async ({ page }) => {
  await page.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({ version: 1, bookmarks: [{ guide: "javascript:alert(1)", chapter: "extra-practice" }] }));
  }, key);
  await page.goto("/reviewers/numerical-ability");
  const saved = page.getByRole("region", { name: "Saved reviewer chapters" });
  await expect(saved).toContainText("Saved bookmarks could not be read");
  await expect(saved.getByRole("link")).toHaveCount(0);
  await page.locator("#arithmetic").getByRole("button", { name: /^Bookmark chapter:/ }).click();
  await expect(saved.getByRole("link")).toHaveAttribute("href", "/reviewers/numerical-ability#arithmetic");
  await page.evaluate(key => { localStorage.setItem(key, "broken"); window.dispatchEvent(new StorageEvent("storage", { key })); }, key);
  await expect(saved).toContainText("Saved bookmarks could not be read");
  await saved.getByRole("button", { name: "Clear all reviewer bookmarks", exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
});

test("unavailable or full browser storage never reports a saved bookmark and reading and printing remain usable", async ({ page, context }) => {
  await page.addInitScript(key => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) { if (name === key) throw new DOMException("blocked", "SecurityError"); return get.call(this, name); };
  }, key);
  await page.goto("/reviewers/numerical-ability");
  await expect(page.getByRole("region", { name: "Saved reviewer chapters" })).toContainText("Browser saving is unavailable");
  await expect(page.locator("#arithmetic").getByRole("button", { name: /^Bookmark chapter:/ })).toBeDisabled();
  await expect(page.locator("#arithmetic .prose")).toContainText("Practice");
  const fresh = await context.browser()!.newContext();
  const full = await fresh.newPage();
  await full.addInitScript(key => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) { if (name === key) throw new DOMException("full", "QuotaExceededError"); return set.call(this, name, value); };
  }, key);
  await full.goto("/reviewers/numerical-ability");
  const chapter = full.locator("#arithmetic");
  await chapter.getByRole("button", { name: /^Bookmark chapter:/ }).click();
  await expect(chapter).toContainText("Browser saving is unavailable");
  await expect(chapter.getByRole("button", { name: /^Bookmark chapter:/ })).toHaveAttribute("aria-pressed", "false");
  expect(await full.evaluate(key => localStorage.getItem(key), key)).toBeNull();
  await full.emulateMedia({ media: "print" });
  await expect(chapter.getByRole("button", { name: /^Bookmark chapter:/ })).toBeHidden();
  await expect(full.getByRole("region", { name: "Saved reviewer chapters" })).toBeHidden();
  await expect(chapter.locator(".prose")).toBeVisible();
  await fresh.close();
});
