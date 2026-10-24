import { afterEach, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ after: vi.fn(), db: vi.fn(), process: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocked.after }));
vi.mock("../src/lib/db", () => ({ getDb: mocked.db }));
vi.mock("../src/lib/mail", () => ({ processMailBatch: mocked.process }));
import { scheduleAccountMail } from "../src/lib/account-mail-delivery";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetAllMocks(); });
it("keeps automatic dispatch off unless explicitly enabled", () => {
  vi.stubEnv("ACCOUNT_MAIL_AUTOMATION", "false");
  scheduleAccountMail("private-message-id");
  expect(mocked.after).not.toHaveBeenCalled(); expect(mocked.process).not.toHaveBeenCalled();
});
it("schedules unknown/cooldown responses without a queue lookup", async () => {
  vi.stubEnv("ACCOUNT_MAIL_AUTOMATION", "true");
  scheduleAccountMail(undefined);
  expect(mocked.after).toHaveBeenCalledOnce();
  await mocked.after.mock.calls[0][0]();
  expect(mocked.db).not.toHaveBeenCalled(); expect(mocked.process).not.toHaveBeenCalled();
});
it("defers exact-message account dispatch and reports only aggregate counts", async () => {
  vi.stubEnv("ACCOUNT_MAIL_AUTOMATION", "true");
  const db = {}; mocked.db.mockReturnValue(db);
  mocked.process.mockResolvedValue({ sent: 1, retried: 0, failed: 0, cancelled: 0 });
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  scheduleAccountMail("private-message-id");
  expect(mocked.process).not.toHaveBeenCalled();
  await mocked.after.mock.calls[0][0]();
  expect(mocked.process).toHaveBeenCalledWith(db, 1, { accountOnly: true, messageId: "private-message-id" });
  expect(JSON.parse(log.mock.calls[0][0])).toEqual({ event: "account_mail_dispatch", source: "request", sent: 1, retried: 0, failed: 0, cancelled: 0 });
});
it("absorbs delivery errors without exposing private diagnostics or changing the response", async () => {
  vi.stubEnv("ACCOUNT_MAIL_AUTOMATION", "true");
  mocked.process.mockRejectedValue(new Error("private-provider-response"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  scheduleAccountMail("private-message-id");
  await expect(mocked.after.mock.calls[0][0]()).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledWith(JSON.stringify({ event: "account_mail_dispatch", source: "request", failure: "dispatch_failed" }));
});
