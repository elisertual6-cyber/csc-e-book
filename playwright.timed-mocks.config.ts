import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
export default defineConfig({ ...base, testMatch: /timed-mocks\.spec\.ts/, testIgnore: [],
  workers: 1, projects: base.projects?.map(project => ({ ...project, testIgnore: [] })) });
