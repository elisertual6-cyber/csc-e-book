import { defineConfig } from "@playwright/test";
export default defineConfig({ testDir: "./e2e", testMatch: /purchase-mail\.spec\.ts/, workers: 1, retries: 0, projects: [{ name: "local-purchase-queue" }] });
