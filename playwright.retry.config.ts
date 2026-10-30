import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
// Editorial fixture creation uses global serializable duplicate-prompt checks.
// Keep fixtures sequential; retry concurrency is exercised explicitly inside each test.
export default defineConfig({ ...base, testMatch: /exam-retry\.spec\.ts/, testIgnore: [], workers: 1,
  projects: base.projects?.map(project => ({ ...project, testIgnore: [] })) });
