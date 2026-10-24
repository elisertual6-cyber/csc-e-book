import { defineConfig } from "@playwright/test";

// The transaction/CLI checks need their own seeded database and no web server.
// Keep their count/conflict fixtures out of the concurrent browser suite.
export default defineConfig({
  testDir: "./e2e",
  testMatch: /operator-draft-import\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
});
