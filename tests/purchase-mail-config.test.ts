import { afterEach, expect, it, vi } from "vitest";
import { requirePurchaseMailConfiguration } from "../src/lib/purchase-mail";
afterEach(() => vi.unstubAllEnvs());
it("requires explicit purchase automation and safe SMTP before live checkout", () => {
  const settings = { NODE_ENV: "production", PURCHASE_MAIL_AUTOMATION: "true", MAIL_TRANSPORT: "smtp", MAIL_ENCRYPTION_KEY: "9".repeat(64), SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465", SMTP_USER: "fixture@example.test", SMTP_PASSWORD: "synthetic-app-password", MAIL_FROM: "fixture@example.test", SMTP_ALLOW_INSECURE: "false", APP_URL: "https://csc-e-book.vercel.app" };
  for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, value);
  expect(() => requirePurchaseMailConfiguration()).not.toThrow();
  for (const [name, value] of [["PURCHASE_MAIL_AUTOMATION", "false"], ["MAIL_TRANSPORT", "file"], ["MAIL_ENCRYPTION_KEY", ""], ["SMTP_PASSWORD", ""], ["SMTP_ALLOW_INSECURE", "true"], ["APP_URL", "http://localhost:3000"]]) {
    vi.stubEnv(name, value);
    expect(() => requirePurchaseMailConfiguration()).toThrow("Reviewer email delivery must be configured");
    vi.stubEnv(name, settings[name as keyof typeof settings]);
  }
});
