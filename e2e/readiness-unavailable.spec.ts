import { test, expect } from "@playwright/test";
test("public demo and uptime remain available while readiness reports database failure", async ({ request }) => {
  const started = performance.now();
  const health = await request.get("/api/health", { timeout: 8000 });
  expect(health.status()).toBe(503);
  expect(await health.json()).toEqual({ status: "degraded", database: "unavailable" });
  expect(health.headers()["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
  expect(health.headers()["cache-control"]).toContain("no-store");
  expect(performance.now() - started).toBeLessThan(8000);
  const uptime = await request.get("/api/live");
  expect(uptime.status()).toBe(200);
  expect(await uptime.json()).toEqual({ status: "ok" });
  expect(uptime.headers()["x-request-id"]).not.toBe(health.headers()["x-request-id"]);
  expect((await request.get("/")).status()).toBe(200);
});
