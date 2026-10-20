import { test, expect } from "@playwright/test";
test("landing page is honest, navigable and fits the viewport", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /A purposeful path/ }),
  ).toBeVisible();
  await expect(
    page.getByText(/Not affiliated with, endorsed by/).first(),
  ).toBeVisible();
  await expect(page.getByText("In development", { exact: true })).toHaveCount(
    3,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Find your starting point" }).click();
  await page
    .getByRole("link", { name: "Subprofessional", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Alphabetical and numerical filing" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Logical reasoning", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /Read draft/ }).click();
  await expect(
    page.getByRole("heading", { name: "Learning objectives" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rationale" })).toBeVisible();
});
test("ungraded exercise supports retry and explanation", async ({ page }) => {
  await page.goto("/practice");
  await page.getByLabel("Your answer in minutes").fill("100");
  await page.getByRole("button", { name: /Check my thinking/ }).click();
  await expect(page.getByRole("status")).toContainText("Try working out");
  await page.getByLabel("Your answer in minutes").fill("110");
  await page.getByRole("button", { name: /Check my thinking/ }).click();
  await expect(page.getByRole("status")).toContainText("110 minutes");
});
test("invalid policies return 404", async ({ request }) => {
  expect((await request.get("/policies/unknown")).status()).toBe(404);
});
