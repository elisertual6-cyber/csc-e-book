import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { api, HttpError, json } from "../src/lib/http";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("private API request observations", () => {
  it("gives concurrent requests distinct generated references and preserves response semantics", async () => {
    vi.stubEnv("OBSERVABILITY_LOGS", "true");
    const sink = vi.spyOn(console, "info").mockImplementation(() => {});
    const responses = await Promise.all(Array.from({ length: 12 }, (_, n) => api("commerce", async () => json({ n }, 201))));
    const ids = responses.map(r => r.headers.get("x-request-id"));
    expect(new Set(ids).size).toBe(12);
    for (const r of responses) {
      expect(r.status).toBe(201);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
      expect(r.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/);
    }
    const entries = sink.mock.calls.map(([line]) => JSON.parse(line));
    expect(entries.map(e => e.requestId).sort()).toEqual([...ids].sort());
    expect(entries.every(e => e.operation === "commerce" && e.durationMs >= 0)).toBe(true);
  });

  it("keeps throttling and conflict status/headers while logging only fixed categories", async () => {
    vi.stubEnv("OBSERVABILITY_LOGS", "true");
    const sink = vi.spyOn(console, "info").mockImplementation(() => {});
    const throttled = await api("auth", async () => { throw new HttpError(429, "Please retry."); });
    expect(throttled.status).toBe(429);
    expect(throttled.headers.get("retry-after")).toBe("60");
    const conflict = await api("admin", async () => { throw { code: "P2002", message: "private database fields" }; });
    expect(conflict.status).toBe(409);
    expect(sink.mock.calls.map(([s]) => JSON.parse(s).failure)).toEqual(["expected", "conflict"]);
    expect(JSON.stringify(sink.mock.calls)).not.toContain("private database fields");
  });

  it("does not log validation input or exception names/messages/stacks", async () => {
    vi.stubEnv("OBSERVABILITY_LOGS", "true");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const secret = "sk_test_private__email_cookie_download_token";
    const invalid = await api("auth", async () => { z.literal("valid").parse(secret); return json({}); });
    expect(invalid.status).toBe(400);
    const error = new Error(secret); error.name = secret;
    const failed = await api("commerce", async () => { throw error; });
    expect(failed.status).toBe(500);
    expect(await failed.text()).not.toContain(secret);
    expect(JSON.stringify([...info.mock.calls, ...errors.mock.calls])).not.toContain(secret);
    const entry = JSON.parse(errors.mock.calls[0][0]);
    expect(Object.keys(entry).sort()).toEqual(["event", "timestamp", "requestId", "operation", "status", "durationMs", "failure"].sort());
    expect(entry.requestId).toBe(failed.headers.get("x-request-id"));
    expect(entry.failure).toBe("internal");
  });

  it("logs server failures even when completion logging is disabled", async () => {
    vi.stubEnv("OBSERVABILITY_LOGS", "false");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await api("health", async () => json({ status: "degraded" }, 503));
    await api("live", async () => json({ status: "ok" }));
    expect(errors).toHaveBeenCalledTimes(1);
    expect(info).not.toHaveBeenCalled();
  });

  it("does not turn a completed action into a failure if the log sink throws", async () => {
    vi.stubEnv("OBSERVABILITY_LOGS", "true");
    vi.spyOn(console, "info").mockImplementation(() => { throw new Error("unavailable sink"); });
    const response = await api("commerce", async () => json({ committed: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ committed: true });
  });
});
