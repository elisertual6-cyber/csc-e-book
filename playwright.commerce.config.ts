import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: /(?:commerce|account-recovery)\.spec\.ts/,
  fullyParallel: true,
  expect: { timeout: 20000 },
  workers: 1,
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
      MAIL_TRANSPORT: "file",
      MAIL_PRIVATE_DIR: process.env.MAIL_PRIVATE_DIR!,
      MAIL_ENCRYPTION_KEY: process.env.MAIL_ENCRYPTION_KEY!,
      PDF_PRIVATE_DIR: process.env.PDF_PRIVATE_DIR!,
    },
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
