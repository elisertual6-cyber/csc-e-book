import "dotenv/config";
import { test, expect, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { digest } from "../src/lib/security";
test("GCash hosted sandbox, verified canonical payments, idempotency, reconciliation and refunds", async ({
  playwright,
  page,
}, info) => {
  test.setTimeout(150000);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const origin = "http://127.0.0.1:3100",
    prefix = `gcash-${randomUUID().slice(0, 8)}`,
    headers = { Origin: origin, "X-CSC-Action": "1" },
    contexts: APIRequestContext[] = [];
  async function control(data: unknown) {
    const r = await fetch("http://127.0.0.1:3201/control", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fixture-Secret": process.env.PAYMONGO_WEBHOOK_SECRET!,
      },
      body: JSON.stringify(data),
    });
    expect(r.status).toBe(200);
    return r.json();
  }
  try {
    const users = await Promise.all(
      ["ADMIN", "CUSTOMER", "CUSTOMER", "CUSTOMER", "REVIEWER"].map((role, i) =>
        db.user.create({
          data: {
            email: `${prefix}-${i}@example.test`,
            role: role as "ADMIN" | "CUSTOMER" | "REVIEWER",
            emailVerifiedAt: i === 3 ? null : new Date(),
          },
        }),
      ),
    );
    for (const user of users) {
      const token = randomBytes(32).toString("hex");
      await db.session.create({
        data: {
          userId: user.id,
          tokenHash: digest(token),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      contexts.push(
        await playwright.request.newContext({
          baseURL: origin,
          extraHTTPHeaders: headers,
          storageState: {
            cookies: [
              {
                name: "csc_session",
                value: token,
                domain: "127.0.0.1",
                path: "/",
                expires: -1,
                httpOnly: true,
                secure: false,
                sameSite: "Lax",
              },
            ],
            origins: [],
          },
        }),
      );
    }
    const [admin, alice, bob, unverified, reviewer] = contexts;
    const anon = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: headers,
    });
    contexts.push(anon);
    for (const ctx of [alice, bob, reviewer])
      expect(
        (
          await ctx.post("/api/admin/payments", {
            data: { orderId: "fake", providerSessionId: "cs_fake" },
          })
        ).status(),
      ).toBe(403);
    expect(
      (await anon.post("/api/admin/payments", { data: {} })).status(),
    ).toBe(401);
    expect(
      (
        await anon.post("/api/commerce/orders/fake/gcash", {
          data: { action: "checkout" },
        })
      ).status(),
    ).toBe(401);
    const created = await admin.post("/api/admin/products", {
      data: {
        action: "create",
        data: {
          slug: prefix,
          name: `${prefix} Reviewer`,
          description:
            "Synthetic private proof for isolated GCash sandbox checks.",
          version: "gcash-test",
          grantsExams: true,
        },
        amountMinor: 9900,
      },
    });
    expect(created.status()).toBe(200);
    const product = await created.json();
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("GCASH SANDBOX PROOF. SYNTHETIC. NOT FOR SALE.");
    const bytes = await pdf.save(),
      filename = `${randomUUID()}.pdf`;
    await mkdir(process.env.PDF_PRIVATE_DIR!, { recursive: true });
    await writeFile(path.join(process.env.PDF_PRIVATE_DIR!, filename), bytes);
    const edition = await db.pdfEdition.create({
      data: {
        creatorId: users[0].id,
        kind: "DRAFT",
        title: "GCash fixture proof",
        version: "gcash-test",
        filename,
        sha256: digest(bytes),
        manifest: { lessons: [], questions: [] },
      },
    });
    const r = await admin.post("/api/admin/products", {
      data: {
        action: "release",
        id: product.id,
        editionId: edition.id,
        humanReviewed: true,
      },
    });
    expect(r.status()).toBe(200);
    const artifact = await r.json();
    expect(artifact.developmentOnly).toBe(true);
    expect(
      (
        await admin.post("/api/admin/products", {
          data: { action: "activate", id: product.id, active: true },
        })
      ).status(),
    ).toBe(200);
    const catalog = await (await alice.get("/api/commerce/catalog")).json();
    expect(catalog.sandbox).toBe(true);
    expect(catalog.preferredPaymentMethod).toBe("GCash");
    const price = catalog.products.find(
      (p: { id: string }) => p.id === product.id,
    ).price;
    expect(
      (
        await unverified.post("/api/commerce/orders", {
          data: { priceId: price.id, checkoutKey: randomUUID() },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await alice.post("/api/commerce/orders", {
          data: {
            priceId: price.id,
            checkoutKey: randomUUID(),
            amountMinor: 1,
          },
        })
      ).status(),
    ).toBe(400);
    const checkoutKey = randomUUID();
    const repeated = await Promise.all(
      [1, 2].map(() =>
        alice.post("/api/commerce/orders", {
          data: { priceId: price.id, checkoutKey },
        }),
      ),
    );
    for (const response of repeated) expect(response.status()).toBe(201);
    const order = await repeated[0].json();
    expect((await repeated[1].json()).id).toBe(order.id);
    expect(
      (
        await bob.post(`/api/commerce/orders/${order.id}/gcash`, {
          data: { action: "checkout" },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await alice.post(`/api/commerce/orders/${order.id}/gcash`, {
          data: { action: "checkout", amountMinor: 1 },
        })
      ).status(),
    ).toBe(400);
    const begins = await Promise.all(
      [1, 2].map(() =>
        alice.post(`/api/commerce/orders/${order.id}/gcash`, {
          data: { action: "checkout" },
        }),
      ),
    );
    expect(begins.some((r) => r.status() === 200)).toBe(true);
    for (const response of begins)
      expect([200, 409]).toContain(response.status());
    const local = await db.paymentSession.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(local.state).toBe("OPEN");
    expect(
      (await control({ action: "find", orderId: order.id })).sessions.length,
    ).toBe(1);
    const endpoint = `/api/commerce/orders/${order.id}/gcash`;
    expect(
      (await alice.post(endpoint, { data: { action: "refresh" } })).status(),
    ).toBe(200);
    expect(await db.entitlement.count({ where: { orderId: order.id } })).toBe(
      0,
    );
    function event(
      type: string,
      id: string,
      resourceType = "checkout_session",
      eventId = `evt_${randomBytes(8).toString("hex")}`,
    ) {
      return {
        data: {
          id: eventId,
          type: "event",
          attributes: {
            type,
            livemode: false,
            data: { id, type: resourceType },
          },
        },
      };
    }
    function signature(body: string, offset = 0) {
      const t = String(Math.floor(Date.now() / 1000) + offset),
        sig = createHmac("sha256", process.env.PAYMONGO_WEBHOOK_SECRET!)
          .update(t + "." + body)
          .digest("hex");
      return `t=${t},te=${sig},li=`;
    }
    async function webhook(value: unknown, offset = 0) {
      const body = JSON.stringify(value);
      return anon.post("/api/commerce/webhook", {
        headers: {
          "Content-Type": "application/json",
          "Paymongo-Signature": signature(body, offset),
        },
        data: body,
      });
    }
    const paidEvent = event(
      "checkout_session.payment.paid",
      local.providerSessionId!,
    );
    expect(
      (await anon.post("/api/commerce/webhook", { data: paidEvent })).status(),
    ).toBe(401);
    expect((await webhook(paidEvent, -301)).status()).toBe(401);
    expect(
      (
        await webhook({
          ...paidEvent,
          data: {
            ...paidEvent.data,
            attributes: { ...paidEvent.data.attributes, livemode: true },
          },
        })
      ).status(),
    ).toBe(400);
    expect((await webhook(paidEvent)).status()).toBe(503);
    expect(
      await db.paymentWebhookReceipt.count({
        where: { eventId: paidEvent.data.id },
      }),
    ).toBe(0);
    await control({ action: "pay", id: local.providerSessionId });
    await control({
      action: "patch-payment",
      id: local.providerSessionId,
      attributes: { livemode: true },
    });
    expect((await webhook(paidEvent)).status()).toBe(502);
    await control({
      action: "patch-payment",
      id: local.providerSessionId,
      attributes: { livemode: false, amount: 1 },
    });
    expect((await webhook(paidEvent)).status()).toBe(409);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(0);
    await control({
      action: "patch-payment",
      id: local.providerSessionId,
      attributes: { amount: 9900 },
    });
    const confirmed = await Promise.all([
      webhook(paidEvent),
      webhook(paidEvent),
      alice.post(endpoint, { data: { action: "refresh" } }),
    ]);
    for (const response of confirmed) expect(response.status()).toBe(200);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db.entitlement.count({ where: { orderId: order.id } })).toBe(
      1,
    );
    expect(
      await db.deliveryNotice.count({ where: { orderId: order.id } }),
    ).toBe(1);
    expect(
      await db.auditEvent.count({
        where: { targetId: order.id, action: "gcash.payment.fulfill" },
      }),
    ).toBe(1);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("PAID");
    expect(
      (
        await webhook({
          ...paidEvent,
          data: {
            ...paidEvent.data,
            attributes: {
              ...paidEvent.data.attributes,
              type: "payment.failed",
            },
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await webhook(event("unhandled.fixture", local.providerSessionId!))
      ).status(),
    ).toBe(200);
    const entitlement = await db.entitlement.findFirstOrThrow({
      where: { orderId: order.id },
    });
    let d = await (
      await alice.post("/api/commerce/downloads", {
        data: { artifactId: artifact.id },
      })
    ).json();
    expect((await alice.get(d.url)).status()).toBe(200);
    expect(
      (
        await admin.post("/api/admin/orders", {
          data: { entitlementId: entitlement.id, granted: false },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await webhook(
          event("checkout_session.payment.paid", local.providerSessionId!),
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await alice.post("/api/commerce/downloads", {
          data: { artifactId: artifact.id },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await admin.post("/api/admin/orders", {
          data: { entitlementId: entitlement.id, granted: true },
        })
      ).status(),
    ).toBe(200);
    d = await (
      await alice.post("/api/commerce/downloads", {
        data: { artifactId: artifact.id },
      })
    ).json();
    const refund = await control({
      action: "refund",
      id: local.providerSessionId,
      amount: 100,
    });
    expect(
      (
        await webhook(event("payment.refunded", refund.payment.id, "payment"))
      ).status(),
    ).toBe(200);
    expect((await alice.get(d.url)).status()).toBe(403);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("REFUNDED");
    await control({ action: "stale-paid", id: local.providerSessionId });
    expect(
      (
        await webhook(
          event("checkout_session.payment.paid", local.providerSessionId!),
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await db.entitlement.findUniqueOrThrow({
          where: { id: entitlement.id },
        })
      ).revokedAt,
    ).not.toBeNull();
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    ).toBe("REFUNDED");
    // Ambiguous external creation never makes a second remote session on retries.
    const second = await (
      await alice.post("/api/commerce/orders", {
        data: { priceId: price.id, checkoutKey: randomUUID() },
      })
    ).json();
    await control({ action: "fail-next" });
    expect(
      (
        await alice.post(`/api/commerce/orders/${second.id}/gcash`, {
          data: { action: "checkout" },
        })
      ).status(),
    ).toBe(502);
    expect(
      (
        await alice.post(`/api/commerce/orders/${second.id}/gcash`, {
          data: { action: "checkout" },
        })
      ).status(),
    ).toBe(409);
    const ambiguous = await control({ action: "find", orderId: second.id });
    expect(ambiguous.sessions.length).toBe(1);
    expect(
      (
        await admin.post("/api/admin/payments", {
          data: {
            orderId: second.id,
            providerSessionId: local.providerSessionId,
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await admin.post("/api/admin/payments", {
          data: {
            orderId: second.id,
            providerSessionId: ambiguous.sessions[0].id,
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await db.paymentSession.findUniqueOrThrow({
          where: { orderId: second.id },
        })
      ).state,
    ).toBe("OPEN");
    // Customer UI: create an order, open the trusted hosted page, return unpaid,
    // then explicitly refresh canonical provider state. Return-query values grant nothing.
    await page.context().addCookies((await alice.storageState()).cookies);
    await page.goto("/shop");
    await expect(
      page.getByText("Customer payment method: GCash", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `.local/gcash-shop-${info.project.name}.png`,
      fullPage: true,
    });
    const createdResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/commerce/orders") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          name: `${prefix} Reviewer`,
          exact: true,
        }),
      })
      .getByRole("button", { name: "Create GCash sandbox order" })
      .click();
    const uiOrder = await (await createdResponse).json();
    await expect(page).toHaveURL(/\/account\/purchases$/);
    const card = page
      .getByRole("article")
      .filter({ has: page.getByText(`Order ${uiOrder.id}`, { exact: true }) });
    await card
      .getByRole("button", { name: "Pay with GCash (sandbox)", exact: true })
      .click();
    await expect(
      page.getByRole("link", { name: "Continue to GCash sandbox" }),
    ).toHaveAttribute("href", /^https:\/\/checkout\.paymongo\.com\//);
    await page.route("https://checkout.paymongo.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: "<h1>GCash hosted-page fixture — no real payment</h1>",
      }),
    );
    await page.getByRole("link", { name: "Continue to GCash sandbox" }).click();
    await expect(
      page.getByRole("heading", {
        name: "GCash hosted-page fixture — no real payment",
      }),
    ).toBeVisible();
    await page.goto(origin + "/account/purchases?payment_return=1&status=paid");
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: uiOrder.id } })).status,
    ).toBe("PENDING");
    const uiRemote = (await control({ action: "find", orderId: uiOrder.id }))
      .sessions[0];
    await control({ action: "pay", id: uiRemote.id });
    await card
      .getByRole("button", { name: "Check GCash status", exact: true })
      .click();
    await expect(card.getByText("PAID", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/gcash-purchases-${info.project.name}.png`,
      fullPage: true,
    });
  } finally {
    for (const context of contexts) await context.dispose();
    await db.$disconnect();
  }
});
