import "server-only";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import type { Prisma, Artifact } from "@prisma/client";
import { getDb } from "@/lib/db";
import { audit, slug, type Actor } from "@/lib/editorial";
import { HttpError } from "@/lib/http";
import { digest } from "@/lib/security";
import { gcashCheckoutEnabled, paymongoConfig } from "@/lib/paymongo";
import { requirePurchaseMailConfiguration } from "@/lib/purchase-mail";
import { paymentAllowedInRuntime } from "@/lib/payment-policy";
import { fullEdition, readEdition } from "@/lib/pdf";
import {
  mockCheckoutEnabled,
  requireMockCheckout,
  simulatePayment,
} from "@/lib/payments";
type Tx = Prisma.TransactionClient;
const id = z.string().min(1).max(100);
const productInput = z
  .object({
    slug,
    name: z.string().trim().min(3).max(160),
    description: z.string().trim().min(10).max(3000),
    version: z.string().trim().min(1).max(60),
    grantsExams: z.boolean(),
  })
  .strict();
const money = z.number().int().min(100).max(10_000_000);
async function clock(tx: Tx) {
  return (
    await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
  )[0].now;
}
export async function lockOrder(tx: Tx, orderId: string, userId?: string) {
  const rows = userId
    ? await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Order" WHERE id=${orderId} AND "userId"=${userId} FOR UPDATE`
    : await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Order" WHERE id=${orderId} FOR UPDATE`;
  if (!rows.length) throw new HttpError(404, "Order not found.");
  return tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { price: true } }, payments: true },
  });
}
export async function artifactBytes(artifact: Artifact) {
  if (!artifact.publishedAt || !artifact.editionId)
    throw new HttpError(409, "The released file is unavailable.");
  if (artifact.developmentOnly) {
    if (!developmentCommerceEnabled())
      throw new HttpError(503, "Development proof delivery is unavailable.");
    const edition = await getDb().pdfEdition.findUnique({
      where: { id: artifact.editionId },
    });
    if (
      !edition ||
      edition.kind !== "DRAFT" ||
      edition.filename !== artifact.privateKey ||
      edition.sha256 !== artifact.sha256
    )
      throw new HttpError(409, "Development proof is unavailable.");
    return readEdition(edition);
  }
  const { edition, bytes } = await fullEdition(artifact.editionId);
  if (
    !edition.publishedAt ||
    edition.filename !== artifact.privateKey ||
    edition.sha256 !== artifact.sha256
  )
    throw new HttpError(409, "The edition release has changed.");
  return bytes;
}
export async function manageAccess(actor: Actor, raw: unknown) {
  if (actor.role !== "ADMIN")
    throw new HttpError(403, "Admin access required.");
  const input = z
    .object({ entitlementId: id, granted: z.boolean() })
    .strict()
    .parse(raw);
  return getDb().$transaction(async (tx) => {
    const entitlement = await tx.entitlement.findUnique({
      where: { id: input.entitlementId },
    });
    if (!entitlement) throw new HttpError(404, "Entitlement not found.");
    const order = await lockOrder(tx, entitlement.orderId);
    const time = await clock(tx);
    if (
      input.granted &&
      (order.userId !== entitlement.userId ||
        order.status !== "PAID" ||
        (entitlement.expiresAt && entitlement.expiresAt <= time) ||
        !order.items.some((i) => i.productId === entitlement.productId) ||
        !order.items.length ||
        order.items.some(
          (i) =>
            i.quantity <= 0 ||
            i.unitPriceMinor <= 0 ||
            i.price.productId !== i.productId ||
            i.price.currency !== order.currency,
        ) ||
        order.items.reduce((n, i) => n + i.quantity * i.unitPriceMinor, 0) !==
          order.totalMinor ||
        !order.payments.some(
          (p) =>
            p.status === "VERIFIED" &&
            p.verifiedAt &&
            p.amountMinor === order.totalMinor &&
            p.currency === order.currency &&
            paymentAllowedInRuntime(p.provider) &&
            (p.provider !== "mock" || mockCheckoutEnabled()),
        ))
    )
      throw new HttpError(
        409,
        "Restore requires an unexpired entitlement backed by a verified paid order.",
      );
    await tx.entitlement.update({
      where: { id: entitlement.id },
      data: { revokedAt: input.granted ? null : time },
    });
    await audit(
      tx,
      actor,
      input.granted ? "commerce.access.restore" : "commerce.access.revoke",
      entitlement.id,
      { orderId: order.id },
    );
    return { id: entitlement.id, granted: input.granted };
  });
}
function developmentCommerceEnabled() {
  return process.env.NODE_ENV !== "production" && (mockCheckoutEnabled() || gcashCheckoutEnabled());
}
export async function catalog() {
  const products = await getDb().product.findMany({
    where: { active: true },
    orderBy: { slug: "asc" },
    include: {
      prices: { where: { active: true }, orderBy: { createdAt: "desc" } },
      artifacts: {
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: "desc" },
      },
    },
  });
  return {
    development: mockCheckoutEnabled(),
    sandbox: gcashCheckoutEnabled() && paymongoConfig().mode === "test",
    live: gcashCheckoutEnabled() && paymongoConfig().mode === "live",
    preferredPaymentMethod: "GCash",
    checkoutAvailable: mockCheckoutEnabled() || gcashCheckoutEnabled(),
    products: products
      .filter(
        (p) =>
          p.prices.length &&
          p.artifacts.some(
            (a) => !a.developmentOnly || developmentCommerceEnabled(),
          ),
      )
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        version: p.version,
        grantsExams: p.grantsExams,
        price: {
          id: p.prices[0].id,
          currency: p.prices[0].currency,
          amountMinor: p.prices[0].amountMinor,
        },
      })),
  };
}
export async function manageProduct(actor: Actor, raw: unknown) {
  if (actor.role !== "ADMIN")
    throw new HttpError(403, "Admin access required.");
  const input = z
    .discriminatedUnion("action", [
      z
        .object({
          action: z.literal("create"),
          data: productInput,
          amountMinor: money,
        })
        .strict(),
      z.object({ action: z.literal("price"), id, amountMinor: money }).strict(),
      z
        .object({ action: z.literal("activate"), id, active: z.boolean() })
        .strict(),
      z
        .object({
          action: z.literal("release"),
          id,
          editionId: id,
          humanReviewed: z.literal(true),
        })
        .strict(),
      z.object({ action: z.literal("refundMock"), id }).strict(),
    ])
    .parse(raw);
  if (input.action === "refundMock") {
    requireMockCheckout();
    return getDb().$transaction(async (tx) => {
      const order = await lockOrder(tx, input.id);
      if (order.status === "REFUNDED")
        return { id: order.id, status: order.status };
      if (
        order.status !== "PAID" ||
        !order.payments.some(
          (p) => p.provider === "mock" && p.status === "VERIFIED",
        ) ||
        order.payments.some((p) => p.provider !== "mock")
      )
        throw new HttpError(
          409,
          "Only simulated paid orders can be reversed here.",
        );
      await tx.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED" },
      });
      await tx.payment.updateMany({
        where: { orderId: order.id, provider: "mock", status: "VERIFIED" },
        data: { status: "REFUNDED" },
      });
      await tx.entitlement.updateMany({
        where: { orderId: order.id, revokedAt: null },
        data: { revokedAt: await clock(tx) },
      });
      await audit(tx, actor, "commerce.mock.refund", order.id, {});
      return { id: order.id, status: "REFUNDED" };
    });
  }
  let release:
    | {
        edition: Awaited<ReturnType<typeof fullEdition>>["edition"];
        developmentOnly: boolean;
      }
    | undefined;
  if (input.action === "release") {
    const edition = await getDb().pdfEdition.findUnique({
      where: { id: input.editionId },
    });
    if (!edition) throw new HttpError(404, "Edition not found.");
    const developmentOnly = edition.kind === "DRAFT";
    if (developmentOnly) {
      if (!developmentCommerceEnabled())
        throw new HttpError(503, "Development proof release is unavailable.");
      await readEdition(edition);
    } else await fullEdition(edition.id);
    release = { edition, developmentOnly };
  }
  return getDb().$transaction(
    async (tx) => {
      if (input.action === "create") {
        const product = await tx.product.create({
          data: {
            ...input.data,
            prices: {
              create: {
                amountMinor: input.amountMinor,
                currency: "PHP",
                active: true,
              },
            },
          },
        });
        await audit(tx, actor, "commerce.product.create", product.id, {});
        return product;
      }
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${input.id} FOR UPDATE`;
      const product = await tx.product.findUniqueOrThrow({
        where: { id: input.id },
        include: { artifacts: true, prices: true },
      });
      if (input.action === "price") {
        await tx.price.updateMany({
          where: { productId: product.id, active: true },
          data: { active: false },
        });
        const price = await tx.price.create({
          data: {
            productId: product.id,
            currency: "PHP",
            amountMinor: input.amountMinor,
            active: true,
          },
        });
        await audit(tx, actor, "commerce.price.create", product.id, {
          priceId: price.id,
          amountMinor: price.amountMinor,
        });
        return price;
      }
      if (input.action === "release" && release) {
        if (product.version !== release.edition.version)
          throw new HttpError(409, "Product and edition versions must match.");
        if (!release.developmentOnly)
          await tx.pdfEdition.update({
            where: { id: release.edition.id },
            data: { publishedAt: await clock(tx) },
          });
        const artifact = await tx.artifact.create({
          data: {
            productId: product.id,
            version: product.version,
            privateKey: release.edition.filename,
            sha256: release.edition.sha256,
            editionId: release.edition.id,
            developmentOnly: release.developmentOnly,
            publishedAt: await clock(tx),
          },
        });
        await audit(tx, actor, "commerce.artifact.release", artifact.id, {
          developmentOnly: release.developmentOnly,
          editionId: release.edition.id,
        });
        return { id: artifact.id, developmentOnly: artifact.developmentOnly };
      }
      if (input.action === "activate") {
        if (input.active) {
          const artifact = product.artifacts
            .filter((a) => a.publishedAt && a.version === product.version)
            .sort(
              (a, b) => b.publishedAt!.getTime() - a.publishedAt!.getTime(),
            )[0];
          if (
            !artifact ||
            !product.prices.some(
              (p) => p.active && p.amountMinor > 0 && p.currency === "PHP",
            )
          )
            throw new HttpError(
              409,
              "Release a matching edition and configure a price first.",
            );
          await artifactBytes(artifact);
        }
        const updated = await tx.product.update({
          where: { id: product.id },
          data: { active: input.active },
        });
        await audit(tx, actor, "commerce.product.active", product.id, {
          active: input.active,
        });
        return updated;
      }
      throw new HttpError(400, "Unknown action.");
    },
    { timeout: 20_000 },
  );
}
export async function checkout(actor: Actor, raw: unknown) {
  const gcash = gcashCheckoutEnabled();
  if (gcash && paymongoConfig().mode === "live") requirePurchaseMailConfiguration();
  if (!mockCheckoutEnabled() && !gcash)
    throw new HttpError(
      503,
      "Checkout is unavailable. No payment will be collected.",
    );
  const input = z
    .object({ priceId: id, checkoutKey: z.uuid() })
    .strict()
    .parse(raw);
  return getDb().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${actor.id},48294))`;
      if (gcash) {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: actor.id },
          select: { emailVerifiedAt: true },
        });
        if (!user.emailVerifiedAt)
          throw new HttpError(
            403,
            "Verify your email address before GCash checkout.",
          );
      }
      const previous = await tx.order.findUnique({
        where: {
          userId_checkoutKey: {
            userId: actor.id,
            checkoutKey: input.checkoutKey,
          },
        },
        include: { items: true },
      });
      if (previous) {
        if (
          previous.items.length !== 1 ||
          previous.items[0].priceId !== input.priceId ||
          previous.paymentMethod !== (gcash ? "gcash" : "mock")
        )
          throw new HttpError(
            409,
            "Checkout key was used for a different selection.",
          );
        return { id: previous.id, status: previous.status };
      }
      const price = await tx.price.findUnique({
        where: { id: input.priceId },
        include: {
          product: {
            include: {
              artifacts: {
                where: { publishedAt: { not: null } },
                orderBy: { publishedAt: "desc" },
              },
            },
          },
        },
      });
      if (!price) throw new HttpError(404, "Price not found.");
      await tx.$queryRaw`SELECT id FROM "Product" WHERE id=${price.productId} FOR SHARE`;
      // Re-read after acquiring the product lock; admin price/activation changes use the same lock.
      const fresh = await tx.price.findUniqueOrThrow({
        where: { id: price.id },
        include: { product: true },
      });
      if (
        !fresh.active ||
        !fresh.product.active ||
        fresh.currency !== "PHP" ||
        fresh.amountMinor <= 0
      )
        throw new HttpError(
          409,
          "This product or price is unavailable. Refresh the catalog.",
        );
      const artifact = price.product.artifacts.find(
        (a) => a.version === fresh.product.version,
      );
      if (!artifact)
        throw new HttpError(409, "No released edition is available.");
      await artifactBytes(artifact);
      const order = await tx.order.create({
        data: {
          userId: actor.id,
          checkoutKey: input.checkoutKey,
          paymentMethod: gcash ? "gcash" : "mock",
          totalMinor: fresh.amountMinor,
          currency: fresh.currency,
          items: {
            create: {
              productId: fresh.productId,
              priceId: fresh.id,
              unitPriceMinor: fresh.amountMinor,
              productName: fresh.product.name,
              productVersion: fresh.product.version,
              quantity: 1,
            },
          },
        },
      });
      await audit(tx, actor, "commerce.order.create", order.id, {
        provider: gcash ? paymongoConfig().mode === "live" ? "paymongo" : "paymongo_test" : "mock",
      });
      return { id: order.id, status: order.status };
    },
    { timeout: 20_000 },
  );
}
export async function orderAction(actor: Actor, orderId: string, raw: unknown) {
  const input = z
    .object({ action: z.enum(["simulatePayment", "cancel"]) })
    .strict()
    .parse(raw);
  requireMockCheckout();
  return getDb().$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId, actor.id);
    if (order.paymentMethod !== "mock")
      throw new HttpError(409, "This order requires its GCash checkout flow.");
    if (input.action === "cancel") {
      if (order.status === "CANCELLED")
        return { id: order.id, status: order.status };
      if (order.status !== "PENDING")
        throw new HttpError(409, "Only a pending order can be cancelled.");
      await tx.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED" },
      });
      await audit(tx, actor, "commerce.order.cancel", order.id, {});
      return { id: order.id, status: "CANCELLED" };
    }
    if (order.status === "PAID") return { id: order.id, status: order.status };
    if (order.status !== "PENDING")
      throw new HttpError(409, "This order cannot be paid.");
    const event = simulatePayment(order);
    if (
      event.orderId !== order.id ||
      event.amountMinor !== order.totalMinor ||
      event.currency !== order.currency ||
      !order.items.length ||
      order.items.some(
        (i) =>
          i.quantity !== 1 ||
          i.unitPriceMinor <= 0 ||
          i.productId !== i.price.productId ||
          i.price.currency !== order.currency,
      ) ||
      order.items.reduce((n, i) => n + i.unitPriceMinor * i.quantity, 0) !==
        order.totalMinor
    )
      throw new HttpError(409, "Payment does not match the order.");
    const time = await clock(tx);
    await tx.payment.create({
      data: {
        orderId: order.id,
        provider: event.provider,
        providerEventId: event.eventId,
        status: "VERIFIED",
        verifiedAt: time,
        amountMinor: event.amountMinor,
        currency: event.currency,
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });
    for (const item of order.items)
      await tx.entitlement.upsert({
        where: {
          userId_productId_orderId: {
            userId: actor.id,
            productId: item.productId,
            orderId: order.id,
          },
        },
        create: {
          userId: actor.id,
          productId: item.productId,
          orderId: order.id,
        },
        update: {},
      });
    await tx.deliveryNotice.create({
      data: { userId: actor.id, orderId: order.id },
    });
    await audit(tx, actor, "commerce.mock.fulfill", order.id, {
      amountMinor: order.totalMinor,
      currency: order.currency,
    });
    return { id: order.id, status: "PAID" };
  });
}
export async function orders(actor: Actor) {
  return getDb().order.findMany({
    where: { userId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      totalMinor: true,
      currency: true,
      createdAt: true,
      paymentMethod: true,
      paymentSession: { select: { state: true } },
      items: {
        select: {
          productId: true,
          productName: true,
          productVersion: true,
          quantity: true,
          unitPriceMinor: true,
        },
      },
      notices: { select: { transport: true, createdAt: true } },
      entitlements: {
        select: {
          productId: true,
          revokedAt: true,
          expiresAt: true,
          product: {
            select: {
              artifacts: {
                where: { publishedAt: { not: null } },
                select: { id: true, version: true, developmentOnly: true },
              },
            },
          },
        },
      },
    },
  });
}
async function downloadAccess(
  tx: Tx,
  actor: Actor,
  artifact: Artifact,
  time: Date,
) {
  if (artifact.developmentOnly && !developmentCommerceEnabled())
    throw new HttpError(
      403,
      "Development files are unavailable in production.",
    );
  const grants = await tx.entitlement.findMany({
    where: {
      userId: actor.id,
      productId: artifact.productId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: time } }],
      order: { status: "PAID", userId: actor.id },
    },
    include: {
      order: {
        include: { payments: true, items: { include: { price: true } } },
      },
    },
  });
  const valid = grants.some(
    (e) =>
      e.order.items.some(
        (i) =>
          i.productId === artifact.productId &&
          i.productVersion === artifact.version,
      ) &&
      e.order.items.length > 0 &&
      e.order.items.every(
        (i) =>
          i.quantity > 0 &&
          i.unitPriceMinor > 0 &&
          i.price.productId === i.productId &&
          i.price.currency === e.order.currency,
      ) &&
      e.order.items.reduce((n, i) => n + i.quantity * i.unitPriceMinor, 0) ===
        e.order.totalMinor &&
      e.order.payments.some(
        (p) =>
          p.status === "VERIFIED" &&
          p.verifiedAt &&
          p.amountMinor === e.order.totalMinor &&
          p.currency === e.order.currency &&
          paymentAllowedInRuntime(p.provider) &&
          (p.provider !== "mock" || mockCheckoutEnabled()),
      ),
  );
  if (!valid)
    throw new HttpError(403, "A current purchase entitlement is required.");
}
export async function issueDownload(actor: Actor, raw: unknown) {
  const input = z.object({ artifactId: id }).strict().parse(raw);
  return getDb().$transaction(
    async (tx) => {
      const artifact = await tx.artifact.findUnique({
        where: { id: input.artifactId },
      });
      if (!artifact) throw new HttpError(404, "File not found.");
      const time = await clock(tx);
      await downloadAccess(tx, actor, artifact, time);
      await artifactBytes(artifact);
      const token = randomBytes(32).toString("hex");
      const row = await tx.download.create({
        data: {
          userId: actor.id,
          artifactId: artifact.id,
          tokenHash: digest(token),
          expiresAt: new Date(time.getTime() + 5 * 60_000),
        },
      });
      await audit(tx, actor, "commerce.download.issue", row.id, {
        artifactId: artifact.id,
      });
      return {
        url: `/api/commerce/downloads/${token}`,
        expiresAt: row.expiresAt,
      };
    },
    { timeout: 20_000 },
  );
}
export async function consumeDownload(actor: Actor, token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new HttpError(404, "Download not found.");
  return getDb().$transaction(
    async (tx) => {
      const hash = digest(token);
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "Download" WHERE "tokenHash"=${hash} AND "userId"=${actor.id} FOR UPDATE`;
      if (!rows.length) throw new HttpError(404, "Download not found.");
      const download = await tx.download.findUniqueOrThrow({
        where: { id: rows[0].id },
        include: { artifact: true },
      });
      const time = await clock(tx);
      if (download.consumedAt || download.expiresAt <= time)
        throw new HttpError(
          410,
          "This link has expired or was used. Request another from your account.",
        );
      await downloadAccess(tx, actor, download.artifact, time);
      const bytes = await artifactBytes(download.artifact);
      await tx.download.update({
        where: { id: download.id },
        data: { consumedAt: time },
      });
      await audit(tx, actor, "commerce.download.consume", download.id, {
        artifactId: download.artifactId,
      });
      return bytes;
    },
    { timeout: 20_000 },
  );
}
