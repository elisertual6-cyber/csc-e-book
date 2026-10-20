import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  testIgnore: /(?:commerce|account-recovery|gcash)\.spec\.ts/,
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
      testIgnore: [
        /phase[23]\.spec\.ts/,
        /(?:commerce|account-recovery|gcash)\.spec\.ts/,
      ],
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    env: {
      APP_URL: "http://127.0.0.1:3100",
      REGISTRATION_ENABLED: "true",
      MAIL_TRANSPORT: "disabled",
      PAYMENT_PROVIDER: "paymongo",
      PAYMONGO_MODE: "test",
      GCASH_CHECKOUT_ENABLED: "true",
      PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY!,
      PAYMONGO_WEBHOOK_SECRET: process.env.PAYMONGO_WEBHOOK_SECRET!,
      PDF_PRIVATE_DIR: process.env.PDF_PRIVATE_DIR ?? ".local/test-editions",
    },
    command: "npm run start -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
