import { test, expect } from "@playwright/test";
test("uptime, readiness and denied mutations have private generated request references", async ({ request }) => {
  const uptime = await request.get("/api/live", { headers: { "X-Request-ID": "spoofed-id-private-token" } });
  expect(uptime.status()).toBe(200);
  expect(await uptime.json()).toEqual({ status: "ok" });
  const ready = await request.get("/api/health");
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ status: "ok", database: "connected" });
  const denied = await request.post("/api/auth/login", { data: {}, headers: { Origin: "https://untrusted.example" } });
  expect(denied.status()).toBe(403);
  const ids = [uptime, ready, denied].map(r => r.headers()["x-request-id"]);
  expect(new Set(ids).size).toBe(3);
  for (const response of [uptime, ready, denied]) {
    expect(response.headers()["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.headers()["cache-control"]).toContain("no-store");
  }
});
