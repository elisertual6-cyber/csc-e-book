import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: /commerce\.spec\.ts/,
  fullyParallel: true,
  expect: { timeout: 20000 },
  workers: 2,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    env: {
      APP_URL: "http://127.0.0.1:3100",
      REGISTRATION_ENABLED: "true",
      PAYMENT_PROVIDER: "mock",
      PDF_PRIVATE_DIR: process.env.PDF_PRIVATE_DIR!,
    },
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
