import { test, expect } from "@playwright/test";
import { Client } from "pg";

// No arbitrary target URL: only the disposable-database runner and loopback app.
test("bounded concurrent reads and rejected mutations preserve service availability", async ({ request, baseURL }, testInfo) => {
  test.setTimeout(120_000);
  const url = new URL(process.env.DATABASE_URL ?? "");
  expect(url.pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/);
  expect(baseURL).toBe("http://127.0.0.1:3100");
  const db = new Client({ connectionString: url.toString() });
  await db.connect();
  async function counts() {
    return (await db.query('SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Order") AS orders, (SELECT count(*) FROM "Attempt") AS attempts, (SELECT count(*) FROM "Session") AS sessions')).rows[0];
  }
  try {
    const before = await counts();
    const routes = ["/", "/curriculum", "/api/live", "/api/health", "/api/commerce/catalog"];
    for (const route of routes) expect((await request.get(route)).status()).toBe(200);
    const timings: number[] = [];
    const ids = new Set<string>();
    let cursor = 0;
    await Promise.all(Array.from({ length: 5 }, async () => {
      while (cursor < 100) {
        const route = routes[cursor++ % routes.length];
        const started = performance.now();
        const response = await request.get(route, { timeout: 10000 });
        timings.push(performance.now() - started);
        expect(response.status()).toBe(200);
        if (route.startsWith("/api/")) {
          const id = response.headers()["x-request-id"];
          expect(id).toMatch(/^[a-f0-9-]{36}$/);
          expect(ids.has(id)).toBe(false);
          ids.add(id);
          expect(response.headers()["cache-control"]).toContain("no-store");
        }
        await response.dispose();
      }
    }));
    cursor = 0;
    await Promise.all(Array.from({ length: 5 }, async () => {
      while (cursor++ < 40) {
        const response = await request.post("/api/auth/login", { data: {}, headers: { Origin: "https://untrusted.example", "X-CSC-Action": "1" }, timeout: 10000 });
        expect(response.status()).toBe(403);
        expect(response.headers()["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
        await response.dispose();
      }
    }));
    expect(await counts()).toEqual(before);
    expect((await request.get("/api/health")).status()).toBe(200);
    timings.sort((a, b) => a - b);
    const result = { scope: "local disposable database; not production capacity", concurrency: 5, reads: timings.length, deniedMutations: 40, p50Ms: Math.round(timings[49]), p95Ms: Math.round(timings[94]), maxMs: Math.round(timings[99]) };
    console.log(JSON.stringify(result));
    await testInfo.attach("local-load-summary", { body: JSON.stringify(result, null, 2), contentType: "application/json" });
  } finally { await db.end(); }
});
