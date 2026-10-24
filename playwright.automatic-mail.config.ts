import { defineConfig } from "@playwright/test";
import base from "./playwright.commerce.config";
const server = base.webServer;
if (!server || Array.isArray(server)) throw new Error("Expected one disposable application server.");
export default defineConfig({
  ...base,
  testMatch: /account-mail-automatic\.spec\.ts/,
  webServer: { ...server, env: { ...server.env, ACCOUNT_MAIL_AUTOMATION: "true" } },
});
