import "dotenv/config";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("customer registration, session, account boundary and logout", async ({
  page,
}) => {
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Test Learner");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`learner-${randomUUID()}@example.test`);
  await page
    .getByLabel("Password (12–128 characters)", { exact: true })
    .fill(randomUUID() + "-learning");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hello, Test Learner." }),
  ).toBeVisible();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/account$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});
