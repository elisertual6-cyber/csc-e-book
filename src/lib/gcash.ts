import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import { lockOrder, artifactBytes } from "@/lib/commerce";
import { audit, type Actor } from "@/lib/editorial";
import { HttpError } from "@/lib/http";
import { digest } from "@/lib/security";
import {
  PaymongoClient,
  paymongoConfig,
  paymongoEvent,
  checkoutId,
  trustedCheckoutUrl,
  verifyPaymongoSignature,
  type CheckoutResource,
  type PaymentResource,
} from "@/lib/paymongo";
const provider = "paymongo_test";
type Order = Awaited<ReturnType<typeof lockOrder>>;
function coherent(order: Order) {
  if (
    order.paymentMethod !== "gcash" ||
    order.currency !== "PHP" ||
    !order.items.length ||
    order.items.some(
      (i) =>
        i.quantity !== 1 ||
        i.unitPriceMinor <= 0 ||
        i.price.productId !== i.productId ||
        i.price.currency !== order.currency,
    ) ||
    order.items.reduce((sum, i) => sum + i.unitPriceMinor * i.quantity, 0) !==
      order.totalMinor
  )
    throw new HttpError(409, "The payment does not match a valid GCash order.");
}
function bound(remote: CheckoutResource, order: Order, localId: string) {
  coherent(order);
  const a = remote.attributes;
  if (
    a.livemode ||
    a.reference_number !== order.id ||
    a.metadata.order_id !== order.id ||
    a.metadata.local_session_id !== localId ||
    a.payment_method_types.length !== 1 ||
    a.payment_method_types[0] !== "gcash" ||
    a.line_items.length !== order.items.length ||
    a.line_items.some(
      (item, i) =>
        item.currency !== order.currency ||
        item.amount !== order.items[i].unitPriceMinor ||
        item.quantity !== order.items[i].quantity,
    ) ||
    a.line_items.reduce((sum, i) => sum + i.amount * i.quantity, 0) !==
      order.totalMinor
  )
    throw new HttpError(
      409,
      "The provider checkout does not match this order.",
    );
  trustedCheckoutUrl(a.checkout_url);
}
async function verifiedUser(tx: Prisma.TransactionClient, id: string) {
  const user = await tx.user.findUniqueOrThrow({
    where: { id },
    select: { emailVerifiedAt: true },
  });
  if (!user.emailVerifiedAt)
    throw new HttpError(
      403,
      "Verify your email address before GCash checkout.",
    );
}
export async function beginGcash(actor: Actor, orderId: string) {
  paymongoConfig();
  const result = await getDb().$transaction(
    async (tx) => {
      const order = await lockOrder(tx, orderId, actor.id);
      coherent(order);
      await verifiedUser(tx, actor.id);
      if (order.status !== "PENDING" && order.status !== "PAID")
        throw new HttpError(409, "This order cannot start a payment.");
      const previous = await tx.paymentSession.findUnique({
        where: { orderId },
      });
      if (previous) {
        if (previous.state === "OPEN" && previous.checkoutUrl)
          return {
            existing: {
              orderId,
              status: order.status,
              checkoutUrl: trustedCheckoutUrl(previous.checkoutUrl),
            },
            order,
            local: previous,
          };
        if (previous.state === "PAID")
          return {
            existing: { orderId, status: order.status, checkoutUrl: null },
            order,
            local: previous,
          };
        throw new HttpError(
          409,
          "This payment needs reconciliation. Check its status or contact the operator; do not start another payment.",
        );
      }
      if (order.status !== "PENDING")
        throw new HttpError(409, "This order is already final.");
      for (const item of order.items) {
        const artifact = await tx.artifact.findFirst({
          where: {
            productId: item.productId,
            version: item.productVersion ?? "",
            publishedAt: { not: null },
          },
          orderBy: { publishedAt: "desc" },
        });
        if (!artifact)
          throw new HttpError(
            409,
            "No released file is available for this order.",
          );
        await artifactBytes(artifact);
      }
      const local = await tx.paymentSession.create({ data: { orderId } });
      await audit(tx, actor, "gcash.checkout.begin", order.id, {
        sessionId: local.id,
        mode: "test",
      });
      return { existing: null, order, local };
    },
    { timeout: 20000 },
  );
  if (result.existing) return result.existing;
  try {
    // One external creation attempt per persisted local session. An ambiguous timeout
    // requires reconciliation; there is no unsafe automatic POST retry.
    const remote = await new PaymongoClient().create(
      result.order,
      result.local.id,
    );
    bound(remote, result.order, result.local.id);
    return await getDb().$transaction(async (tx) => {
      const order = await lockOrder(tx, orderId, actor.id),
        local = await tx.paymentSession.findUniqueOrThrow({
          where: { orderId },
        });
      bound(remote, order, local.id);
      if (local.providerSessionId && local.providerSessionId !== remote.id)
        throw new HttpError(409, "A different checkout is already linked.");
      if (local.state === "PAID" || local.state === "REFUNDED")
        return { orderId, status: order.status, checkoutUrl: null };
      await tx.paymentSession.update({
        where: { id: local.id },
        data: {
          providerSessionId: remote.id,
          providerIntentId: remote.attributes.payment_intent.id,
          checkoutUrl: trustedCheckoutUrl(remote.attributes.checkout_url),
          state: "OPEN",
        },
      });
      return {
        orderId,
        status: order.status,
        checkoutUrl: trustedCheckoutUrl(remote.attributes.checkout_url),
      };
    });
  } catch (error) {
    await getDb().paymentSession.updateMany({
      where: { id: result.local.id, state: "CREATING" },
      data: { state: "REVIEW_REQUIRED" },
    });
    throw error;
  }
}
type Receipt = {
  eventId: string;
  eventType: string;
  bodyHash: string;
  targetId: string;
};
async function receiptLock(tx: Prisma.TransactionClient, receipt: Receipt) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${receipt.eventId},48295))`;
  const previous = await tx.paymentWebhookReceipt.findUnique({
    where: { eventId: receipt.eventId },
  });
  if (previous && previous.bodyHash !== receipt.bodyHash)
    throw new HttpError(
      409,
      "This payment event conflicts with an earlier event.",
    );
  return !!previous;
}
async function syncRemote(remote: CheckoutResource, receipt?: Receipt) {
  const client = new PaymongoClient(),
    a = remote.attributes;
  if (a.payments.length > 5)
    throw new HttpError(409, "The payment history needs operator review.");
  const payments = await Promise.all(
    a.payments.map((p) => client.payment(p.id)),
  );
  const paid = payments.filter((p) => p.attributes.status === "paid");
  if (paid.length > 1)
    throw new HttpError(
      409,
      "Multiple paid records need operator review before fulfillment.",
    );
  const payment: PaymentResource | undefined = paid[0];
  return getDb().$transaction(
    async (tx) => {
      if (receipt && (await receiptLock(tx, receipt)))
        return { duplicate: true };
      const identified = await tx.paymentSession.findUnique({
        where: { id: a.metadata.local_session_id },
        select: { orderId: true },
      });
      if (!identified)
        throw new HttpError(
          409,
          "The checkout is not linked to a local payment session.",
        );
      const order = await lockOrder(tx, identified.orderId);
      const local = await tx.paymentSession.findUniqueOrThrow({
        where: { id: a.metadata.local_session_id },
      });
      bound(remote, order, local.id);
      if (local.providerSessionId && local.providerSessionId !== remote.id)
        throw new HttpError(
          409,
          "The checkout session conflicts with this order.",
        );
      if (
        local.providerIntentId &&
        local.providerIntentId !== a.payment_intent.id
      )
        throw new HttpError(
          409,
          "The payment intent conflicts with this order.",
        );
      await tx.paymentSession.update({
        where: { id: local.id },
        data: {
          providerSessionId: remote.id,
          providerIntentId: a.payment_intent.id,
          checkoutUrl: trustedCheckoutUrl(a.checkout_url),
          state:
            local.state === "PAID" || local.state === "REFUNDED"
              ? local.state
              : "OPEN",
        },
      });
      if (!payment) {
        if (receipt)
          throw new HttpError(
            503,
            "Payment confirmation is not available yet. Retry this event.",
          );
        return { orderId: order.id, status: order.status };
      }
      const p = payment.attributes;
      if (
        p.livemode ||
        p.currency !== order.currency ||
        p.amount !== order.totalMinor ||
        p.source.type !== "gcash" ||
        p.payment_intent_id !== a.payment_intent.id ||
        a.payment_intent.attributes.status !== "succeeded"
      )
        throw new HttpError(
          409,
          "The verified provider payment does not match the order.",
        );
      const refunded = p.refunds.filter(
        (r) => r.attributes.status === "succeeded",
      );
      if (
        new Set(p.refunds.map((r) => r.id)).size !== p.refunds.length ||
        p.refunds.some(
          (r) =>
            r.attributes.payment_id !== payment.id ||
            r.attributes.currency !== p.currency ||
            r.attributes.livemode,
        ) ||
        refunded.reduce((n, r) => n + r.attributes.amount, 0) > p.amount
      )
        throw new HttpError(409, "Refund records need operator review.");
      const existing = await tx.payment.findUnique({
        where: {
          provider_providerEventId: { provider, providerEventId: payment.id },
        },
      });
      if (existing && existing.orderId !== order.id)
        throw new HttpError(
          409,
          "The provider payment is already associated with another order.",
        );
      if (local.providerPaymentId && local.providerPaymentId !== payment.id)
        throw new HttpError(409, "The order already has another payment.");
      const time = (
        await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      )[0].now;
      const terminalRefund =
        refunded.some((r) => r.attributes.amount > 0) ||
        order.status === "REFUNDED" ||
        local.state === "REFUNDED";
      if (order.status === "CANCELLED")
        throw new HttpError(
          409,
          "A cancelled order requires operator reconciliation.",
        );
      await tx.payment.upsert({
        where: {
          provider_providerEventId: { provider, providerEventId: payment.id },
        },
        create: {
          orderId: order.id,
          provider,
          providerEventId: payment.id,
          status: terminalRefund ? "REFUNDED" : "VERIFIED",
          verifiedAt: time,
          amountMinor: p.amount,
          currency: p.currency,
        },
        update: terminalRefund ? { status: "REFUNDED" } : {},
      });
      if (terminalRefund) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "REFUNDED" },
        });
        await tx.entitlement.updateMany({
          where: { orderId: order.id, revokedAt: null },
          data: { revokedAt: time },
        });
        await tx.paymentSession.update({
          where: { id: local.id },
          data: { state: "REFUNDED", providerPaymentId: payment.id },
        });
        if (order.status !== "REFUNDED")
          await audit(tx, null, "gcash.payment.refund", order.id, {
            paymentId: payment.id,
            mode: "test",
            refundedMinor: refunded.reduce(
              (n, r) => n + r.attributes.amount,
              0,
            ),
          });
      } else {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "PAID" },
        });
        // A retry never clears a manual revocation or grants a second entitlement.
        for (const item of order.items)
          await tx.entitlement.upsert({
            where: {
              userId_productId_orderId: {
                userId: order.userId,
                productId: item.productId,
                orderId: order.id,
              },
            },
            create: {
              userId: order.userId,
              productId: item.productId,
              orderId: order.id,
            },
            update: {},
          });
        await tx.deliveryNotice.upsert({
          where: {
            orderId_kind: { orderId: order.id, kind: "PURCHASE_READY" },
          },
          create: { orderId: order.id, userId: order.userId },
          update: {},
        });
        await tx.paymentSession.update({
          where: { id: local.id },
          data: { state: "PAID", providerPaymentId: payment.id },
        });
        if (order.status !== "PAID")
          await audit(tx, null, "gcash.payment.fulfill", order.id, {
            paymentId: payment.id,
            mode: "test",
          });
      }
      if (receipt) await tx.paymentWebhookReceipt.create({ data: receipt });
      return {
        orderId: order.id,
        status: terminalRefund ? "REFUNDED" : "PAID",
      };
    },
    { timeout: 15000 },
  );
}
export async function refreshGcash(actor: Actor, orderId: string) {
  paymongoConfig();
  const local = await getDb().paymentSession.findFirst({
    where: { orderId, order: { userId: actor.id, paymentMethod: "gcash" } },
  });
  if (!local) throw new HttpError(404, "Payment session not found.");
  if (!local.providerSessionId)
    throw new HttpError(
      409,
      "The payment session needs operator reconciliation.",
    );
  return syncRemote(
    await new PaymongoClient().checkout(local.providerSessionId),
  );
}
export async function reconcileGcash(actor: Actor, raw: unknown) {
  if (actor.role !== "ADMIN")
    throw new HttpError(403, "Admin access required.");
  paymongoConfig();
  const input = z
    .object({
      orderId: z.string().min(1).max(100),
      providerSessionId: checkoutId,
    })
    .strict()
    .parse(raw);
  const local = await getDb().paymentSession.findUnique({
    where: { orderId: input.orderId },
  });
  if (!local) throw new HttpError(404, "Payment session not found.");
  const remote = await new PaymongoClient().checkout(input.providerSessionId);
  if (
    remote.attributes.metadata.local_session_id !== local.id ||
    remote.attributes.metadata.order_id !== input.orderId
  )
    throw new HttpError(409, "The checkout belongs to another order.");
  const result = await syncRemote(remote);
  await getDb().auditEvent.create({
    data: {
      actorId: actor.id,
      action: "gcash.payment.reconcile",
      targetId: input.orderId,
      metadata: { providerSessionId: input.providerSessionId, mode: "test" },
    },
  });
  return result;
}
export async function processGcashWebhook(
  body: Uint8Array,
  signature: string | null,
) {
  const config = paymongoConfig();
  verifyPaymongoSignature(body, signature, config.webhookSecret);
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new HttpError(400, "Invalid payment event.");
  }
  const event = paymongoEvent.parse(raw).data,
    a = event.attributes;
  const receipt = {
    eventId: event.id,
    eventType: a.type,
    bodyHash: digest(body),
    targetId: a.data.id,
  };
  const existing = await getDb().paymentWebhookReceipt.findUnique({
    where: { eventId: event.id },
  });
  if (existing) {
    if (existing.bodyHash !== receipt.bodyHash)
      throw new HttpError(
        409,
        "This payment event conflicts with an earlier event.",
      );
    return { duplicate: true };
  }
  const client = new PaymongoClient();
  if (a.type === "checkout_session.payment.paid") {
    if (a.data.type !== "checkout_session")
      throw new HttpError(400, "Invalid checkout event.");
    return syncRemote(await client.checkout(a.data.id), receipt);
  }
  if (a.type === "payment.paid" || a.type === "payment.refunded") {
    if (a.data.type !== "payment")
      throw new HttpError(400, "Invalid payment event.");
    const payment = await client.payment(a.data.id);
    const local = await getDb().paymentSession.findUnique({
      where: { providerIntentId: payment.attributes.payment_intent_id },
    });
    if (!local?.providerSessionId)
      throw new HttpError(
        409,
        "Payment event is waiting for checkout reconciliation.",
      );
    return syncRemote(await client.checkout(local.providerSessionId), receipt);
  }
  return getDb().$transaction(async (tx) => {
    if (await receiptLock(tx, receipt)) return { duplicate: true };
    await tx.paymentWebhookReceipt.create({ data: receipt });
    return { ignored: true };
  });
}
