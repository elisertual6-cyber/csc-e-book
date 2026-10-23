import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ query: vi.fn(), on: vi.fn(), constructed: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("pg", () => ({ Pool: class {
  constructor(options: unknown) { state.constructed(options); }
  query = state.query;
  on = state.on;
} }));
import { checkDatabaseReadiness } from "../src/lib/readiness";
const diagnosticGlobal = globalThis as unknown as { readinessPool?: unknown };
beforeEach(() => { delete diagnosticGlobal.readinessPool; vi.clearAllMocks(); });
afterEach(() => { delete diagnosticGlobal.readinessPool; vi.unstubAllEnvs(); });
describe("bounded database readiness", () => {
  it("reports unavailable without creating a connection when no database is configured", async () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(await checkDatabaseReadiness()).toBe(false);
    expect(state.constructed).not.toHaveBeenCalled();
  });
  it("handles connection/query failure and recovers on a later successful probe", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://fixture.invalid/test");
    state.query.mockRejectedValueOnce(new Error("private connection details")).mockResolvedValueOnce({ rows: [{ result: 1 }] });
    expect(await checkDatabaseReadiness()).toBe(false);
    expect(await checkDatabaseReadiness()).toBe(true);
    expect(state.constructed).toHaveBeenCalledTimes(1);
    expect(state.constructed.mock.calls[0][0]).toMatchObject({ max: 1, connectionTimeoutMillis: 2000, statement_timeout: 2000, query_timeout: 2500 });
    const handler = state.on.mock.calls.find(([name]) => name === "error")?.[1];
    expect(() => handler(new Error("idle connection lost"))).not.toThrow();
  });
});
