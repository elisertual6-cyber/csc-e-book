import "server-only";
import { after } from "next/server";
import { getDb } from "./db";
import { processPurchaseMail } from "./purchase-mail";

export function schedulePurchaseMail(result: { orderId?: string; status?: string }) {
  if (process.env.PURCHASE_MAIL_AUTOMATION !== "true" || result.status !== "PAID" || !result.orderId) return;
  const orderId = result.orderId;
  after(async () => {
    try {
      const counts = await processPurchaseMail(getDb(), orderId);
      const event = JSON.stringify({ event: "purchase_mail_dispatch", source: "payment", ...counts });
      try { if (counts.retried || counts.failed) console.error(event); else console.info(event); } catch { /* Keep delivery separate from logging. */ }
    } catch {
      // The paid order/unique notice is already committed; the retry sweep can recover it.
      try { console.error(JSON.stringify({ event: "purchase_mail_dispatch", source: "payment", failure: "dispatch_failed" })); } catch { /* No IDs, recipients, links or provider errors. */ }
    }
  });
}
