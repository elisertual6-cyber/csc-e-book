import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  testMatch: /readiness-unavailable\.spec\.ts/,
  workers: 1,
  retries: 0,
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "missing-database", use: { baseURL: "http://127.0.0.1:3150" } },
    { name: "unreachable-database", use: { baseURL: "http://127.0.0.1:3151" } },
  ],
  webServer: [3150, 3151].map(port => ({
    env: {
      DATABASE_URL: port === 3150 ? "" : "postgresql://unavailable@127.0.0.1:1/unavailable",
      APP_URL: `http://127.0.0.1:${port}`,
      REGISTRATION_ENABLED: "false",
      GCASH_CHECKOUT_ENABLED: "false",
      MAIL_TRANSPORT: "disabled",
      OBSERVABILITY_LOGS: "false",
    },
    command: `npm run start -- --port ${port}`,
    url: `http://127.0.0.1:${port}/api/live`,
    reuseExistingServer: false,
    timeout: 60000,
  })),
});
