import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("public learning and account pages meet automated WCAG AA checks", async ({ page }) => {
  test.setTimeout(120_000);
  const violations = [];
  for (const route of ["/", "/curriculum", "/preview", "/practice", "/shop", "/login", "/register", "/forgot-password", "/reset-password", "/verify-email", "/policies/privacy", "/policies/terms", "/policies/refunds", "/policies/support"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    violations.push(...results.violations.map(({ id, nodes }) => ({ route, id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })));
  }
  expect(violations).toEqual([]);
});

test("keyboard users can skip navigation to the learning content", async ({ page }) => {
  await page.goto("/practice");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /Sign in for reviewed sessions/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Your answer in minutes")).toBeFocused();
});
