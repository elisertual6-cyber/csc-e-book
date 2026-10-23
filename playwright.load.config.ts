import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({
  ...base,
  testMatch: /load\.spec\.ts/,
  testIgnore: [],
  fullyParallel: false,
  workers: 1,
  projects: [{ name: "local-load", use: { ...devices["Desktop Chrome"] } }],
});
