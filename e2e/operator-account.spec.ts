import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { Client } from "pg";
import { verifyPassword } from "../src/lib/security";

test("operator CLI creates an audited administrator, supports login and refuses credential replacement", async ({ page }) => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  expect(url.pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/);
  const email = `operator-${randomUUID()}@example.test`;
  const password = randomUUID() + "-operator";
  const create = (input: string, identity = email) => spawnSync(process.execPath, [
    "node_modules/tsx/dist/cli.mjs", "scripts/create-user.ts", "--email", identity, "--role", "ADMIN",
  ], { input, encoding: "utf8", timeout: 20000 });
  for (const invalid of ["short-test", "x".repeat(129)]) {
    const result = create(invalid);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid password length");
    expect(result.stdout + result.stderr).not.toContain(invalid);
    expect(result.stdout + result.stderr).not.toContain(email);
  }
  const badEmail = "private-invalid-identity";
  const invalidEmail = create(password, badEmail);
  expect(invalidEmail.status).toBe(1);
  expect(invalidEmail.stderr).toContain("Invalid email");
  expect(invalidEmail.stdout + invalidEmail.stderr).not.toContain(badEmail);
  expect(invalidEmail.stdout + invalidEmail.stderr).not.toContain(password);
  const first = create(password, ` ${email.toUpperCase()} `);
  expect(first.status).toBe(0);
  expect(first.stdout + first.stderr).not.toContain(password);
  expect(first.stdout + first.stderr).not.toContain(email);
  const replacement = randomUUID() + "-replacement";
  const duplicate = create(replacement);
  expect(duplicate.status).toBe(1);
  expect(duplicate.stderr).toContain("Account already exists");
  expect(duplicate.stdout + duplicate.stderr).not.toContain(replacement);
  expect(duplicate.stdout + duplicate.stderr).not.toContain(email);
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  try {
    const user = (await db.query('SELECT id, role, "passwordHash", "emailVerifiedAt" FROM "User" WHERE email=$1', [email])).rows[0];
    expect(user.role).toBe("ADMIN");
    expect(user.emailVerifiedAt).toBeNull();
    expect(await verifyPassword(password, user.passwordHash)).toBe(true);
    expect(await verifyPassword(replacement, user.passwordHash)).toBe(false);
    const audit = (await db.query('SELECT metadata FROM "AuditEvent" WHERE "targetId"=$1 AND action=$2', [user.id, "operator.account.create"])).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].metadata).toEqual({ role: "ADMIN" });
  } finally { await db.end(); }
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password (12–128 characters)", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Make every explanation count." })).toBeVisible();
});
