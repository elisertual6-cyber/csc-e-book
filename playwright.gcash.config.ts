import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: /gcash\.spec\.ts/,
  workers: 1,
  retries: 0,
  expect: { timeout: 20000 },
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
  webServer: [
    {
      command: "node scripts/payment-emulator.mjs",
      url: "http://127.0.0.1:3201/health",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "npm run dev -- --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        APP_URL: "http://127.0.0.1:3100",
        PAYMENT_PROVIDER: "paymongo",
        PAYMONGO_MODE: "test",
        GCASH_CHECKOUT_ENABLED: "true",
        PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY!,
        PAYMONGO_WEBHOOK_SECRET: process.env.PAYMONGO_WEBHOOK_SECRET!,
        PAYMONGO_TEST_API_ORIGIN: "http://127.0.0.1:3201",
        MAIL_TRANSPORT: "file",
        MAIL_PRIVATE_DIR: process.env.MAIL_PRIVATE_DIR!,
        MAIL_ENCRYPTION_KEY: process.env.MAIL_ENCRYPTION_KEY!,
        PDF_PRIVATE_DIR: process.env.PDF_PRIVATE_DIR!,
        REGISTRATION_ENABLED: "true",
      },
    },
  ],
});
