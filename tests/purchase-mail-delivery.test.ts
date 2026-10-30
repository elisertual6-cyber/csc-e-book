import { afterEach, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ after: vi.fn(), db: vi.fn(), process: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: mocked.after }));
vi.mock("../src/lib/db", () => ({ getDb: mocked.db }));
vi.mock("../src/lib/purchase-mail", () => ({ processPurchaseMail: mocked.process }));
import { schedulePurchaseMail } from "../src/lib/purchase-mail-delivery";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetAllMocks(); });
it("never schedules unpaid, refunded, unbound or disabled confirmations", () => {
  vi.stubEnv("PURCHASE_MAIL_AUTOMATION", "false"); schedulePurchaseMail({ orderId: "private-order", status: "PAID" });
  vi.stubEnv("PURCHASE_MAIL_AUTOMATION", "true");
  for (const status of ["PENDING", "REFUNDED", "CANCELLED", undefined]) schedulePurchaseMail({ orderId: "private-order", status });
  schedulePurchaseMail({ status: "PAID" });
  expect(mocked.after).not.toHaveBeenCalled(); expect(mocked.db).not.toHaveBeenCalled();
});
it("dispatches only the committed paid order after returning, logging aggregate counts", async () => {
  vi.stubEnv("PURCHASE_MAIL_AUTOMATION", "true"); const db = {}; mocked.db.mockReturnValue(db);
  mocked.process.mockResolvedValue({ queued: 1, sent: 1, retried: 0, failed: 0, cancelled: 0 });
  const log = vi.spyOn(console, "info").mockImplementation(() => {});
  schedulePurchaseMail({ orderId: "private-order", status: "PAID" });
  expect(mocked.process).not.toHaveBeenCalled(); await mocked.after.mock.calls[0][0]();
  expect(mocked.process).toHaveBeenCalledWith(db, "private-order");
  expect(JSON.parse(log.mock.calls[0][0])).toEqual({ event: "purchase_mail_dispatch", source: "payment", queued: 1, sent: 1, retried: 0, failed: 0, cancelled: 0 });
  expect(log.mock.calls[0][0]).not.toContain("private-order");
});
it("keeps provider/SMTP errors out of payment responses and logs", async () => {
  vi.stubEnv("PURCHASE_MAIL_AUTOMATION", "true"); mocked.process.mockRejectedValue(new Error("private-recipient-and-provider-error"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  schedulePurchaseMail({ orderId: "private-order", status: "PAID" });
  await expect(mocked.after.mock.calls[0][0]()).resolves.toBeUndefined();
  expect(log).toHaveBeenCalledWith(JSON.stringify({ event: "purchase_mail_dispatch", source: "payment", failure: "dispatch_failed" }));
});
