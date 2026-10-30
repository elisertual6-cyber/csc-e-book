import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient, type User } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { localSmtp } from "./local-smtp";
import { processPurchaseMail, retryPurchaseMail } from "../src/lib/purchase-mail";
import { encryptMail, processMailBatch, queuePurchaseNotices } from "../src/lib/mail";

test("verified paid reviewers send one scoped SMTP notice; retries exclude account mail and deny revoked, refunded and malformed purchases", async () => {
  test.setTimeout(90000);
  expect(new URL(process.env.DATABASE_URL!).pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const smtp = await localSmtp();
  const settings = { NODE_ENV: "test", MAIL_TRANSPORT: "smtp", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtp.port), SMTP_ALLOW_INSECURE: "true", SMTP_USER: "", SMTP_PASSWORD: "", MAIL_FROM: "sender@example.test", APP_URL: "http://127.0.0.1:3100" };
  const original = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  Object.assign(process.env, settings);
  const users: User[] = [];
  try {
    for (let i = 0; i < 2; i++) users.push(await db.user.create({ data: { email: `purchase-${randomUUID()}@example.test`, emailVerifiedAt: new Date() } }));
    const product = await db.product.create({ data: { slug: `mail-${randomUUID()}`, name: "Synthetic reviewer", description: "Isolated purchase mail fixture, not a release", version: "fixture", prices: { create: { amountMinor: 9900, currency: "PHP" } } }, include: { prices: true } });
    async function paid(index = 0) {
      return db.order.create({ data: { userId: users[index].id, status: "PAID", totalMinor: 9900, currency: "PHP", paymentMethod: "gcash", items: { create: { productId: product.id, priceId: product.prices[0].id, unitPriceMinor: 9900, productName: "Synthetic reviewer", productVersion: "fixture" } }, payments: { create: { provider: "paymongo", providerEventId: `synthetic-${randomUUID()}`, status: "VERIFIED", verifiedAt: new Date(), amountMinor: 9900, currency: "PHP" } }, entitlements: { create: { userId: users[index].id, productId: product.id } }, notices: { create: { userId: users[index].id, transport: "purchase-pending" } } } });
    }
    const first = await paid(), unrelated = await paid(1);
    const account = await db.mailMessage.create({ data: { userId: users[0].id, purpose: "PASSWORD_CHANGED", transport: "smtp", expiresAt: new Date(Date.now() + 60000), encryptedPayload: encryptMail({ to: users[0].email, subject: "Account fixture", text: "Must remain outside purchase dispatch" }, Buffer.from(process.env.MAIL_ENCRYPTION_KEY!, "hex")) } });
    const results = await Promise.all([processPurchaseMail(db, first.id), processPurchaseMail(db, first.id)]);
    expect(results.reduce((sum, result) => sum + result.sent, 0)).toBe(1);
    expect(smtp.messages).toHaveLength(1);
    expect(smtp.messages[0]).toContain("Synthetic reviewer");
    expect(smtp.messages[0].replace(/=\r?\n/g, "")).toContain("/account/purchases");
    expect(smtp.messages[0]).not.toContain("/api/commerce/downloads/");
    expect((await db.mailMessage.findUniqueOrThrow({ where: { id: account.id } })).status).toBe("PENDING");
    expect(await db.mailMessage.count({ where: { notice: { orderId: unrelated.id } } })).toBe(0);
    const sent = await db.mailMessage.findFirstOrThrow({ where: { notice: { orderId: first.id } } });
    expect(sent.encryptedPayload).toBeNull();
    expect(await processPurchaseMail(db, first.id)).toMatchObject({ queued: 0, sent: 0 });
    smtp.setAccept(false);
    expect(await processPurchaseMail(db, unrelated.id)).toMatchObject({ retried: 1, sent: 0 });
    const pending = await db.mailMessage.findFirstOrThrow({ where: { notice: { orderId: unrelated.id } } });
    expect(pending.encryptedPayload).not.toBeNull(); expect(pending.availableAt.getTime()).toBeGreaterThan(Date.now());
    await db.mailMessage.update({ where: { id: pending.id }, data: { availableAt: new Date(0) } });
    smtp.setAccept(true);
    expect(await retryPurchaseMail(db)).toMatchObject({ sent: 1 });
    expect(smtp.messages).toHaveLength(2);
    for (const kind of ["refund", "revocation", "wrong-amount", "unverified"] as const) {
      const order = await paid();
      await queuePurchaseNotices(db, { orderId: order.id });
      if (kind === "refund") await db.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } });
      if (kind === "revocation") await db.entitlement.updateMany({ where: { orderId: order.id }, data: { revokedAt: new Date() } });
      if (kind === "wrong-amount") await db.payment.updateMany({ where: { orderId: order.id }, data: { amountMinor: 1 } });
      if (kind === "unverified") await db.user.update({ where: { id: users[0].id }, data: { emailVerifiedAt: null } });
      expect(await processPurchaseMail(db, order.id)).toMatchObject({ cancelled: 1, sent: 0 });
      await db.user.update({ where: { id: users[0].id }, data: { emailVerifiedAt: new Date() } });
    }
    const orphan = await db.mailMessage.create({ data: { userId: users[0].id, purpose: "PURCHASE_READY", transport: "smtp", expiresAt: new Date(Date.now() + 60000), encryptedPayload: encryptMail({ to: users[0].email, subject: "Invalid purchase", text: "No paid order" }, Buffer.from(process.env.MAIL_ENCRYPTION_KEY!, "hex")) } });
    expect(await processMailBatch(db, 10, { purchaseOnly: true })).toMatchObject({ sent: 0, cancelled: 1 });
    expect((await db.mailMessage.findUniqueOrThrow({ where: { id: orphan.id } })).encryptedPayload).toBeNull();
    expect((await db.mailMessage.findUniqueOrThrow({ where: { id: account.id } })).status).toBe("PENDING");
    expect(smtp.messages).toHaveLength(2);
    await expect(processMailBatch(db, 1, { purchaseOnly: true, orderId: " " })).rejects.toThrow();
    // In a production worker, sandbox payments never authorize purchase email.
    const sandbox = await paid();
    await db.payment.updateMany({ where: { orderId: sandbox.id }, data: { provider: "paymongo_test" } });
    Object.assign(process.env, { NODE_ENV: "production", APP_URL: "https://csc-e-book.vercel.app" });
    // Configuration alone is checked first; production SMTP must stay strict.
    process.env.SMTP_ALLOW_INSECURE = "false";
    expect(await queuePurchaseNotices(db, { orderId: sandbox.id })).toBe(0);
    expect(await db.mailMessage.count({ where: { notice: { orderId: sandbox.id } } })).toBe(0);
  } finally {
    for (const [key, value] of Object.entries(original)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    await smtp.close(); await db.$disconnect();
  }
});
