import type { PrismaClient } from "@prisma/client";
import { processMailBatch, queuePurchaseNotices } from "./mail";
import { mailConfigurationIssues } from "./mail-readiness";
import { HttpError } from "./http";

export function requirePurchaseMailConfiguration() {
  if (process.env.PURCHASE_MAIL_AUTOMATION !== "true" || mailConfigurationIssues().length)
    throw new HttpError(503, "Reviewer email delivery must be configured before starting live checkout.");
}

// Only the verified order identified by the payment service may be dispatched here.
export async function processPurchaseMail(db: PrismaClient, orderId: string) {
  const queued = await queuePurchaseNotices(db, { orderId, limit: 1 });
  return { queued, ...await processMailBatch(db, 1, { purchaseOnly: true, orderId }) };
}

export async function retryPurchaseMail(db: PrismaClient) {
  const queued = await queuePurchaseNotices(db, { limit: 10 });
  return { queued, ...await processMailBatch(db, 10, { purchaseOnly: true }) };
}
