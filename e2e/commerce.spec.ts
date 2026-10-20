import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { digest } from "../src/lib/security";

test("development purchase, fulfillment, private delivery and access reversal", async ({
  playwright,
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const origin = "http://127.0.0.1:3100",
    prefix = `commerce-${randomUUID().slice(0, 8)}`;
  const contexts = [];
  try {
    const users = await Promise.all(
      ["ADMIN", "CUSTOMER", "CUSTOMER", "REVIEWER"].map((role, i) =>
        db.user.create({
          data: {
            email: `${prefix}-${i}@example.test`,
            role: role as "ADMIN" | "CUSTOMER" | "REVIEWER",
            name: `Commerce learner ${i}`,
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
      const ctx = await playwright.request.newContext({
        baseURL: origin,
        extraHTTPHeaders: { Origin: origin, "X-CSC-Action": "1" },
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
      });
      contexts.push(ctx);
    }
    const [admin, alice, bob, reviewer] = contexts;
    const anon = await playwright.request.newContext({ baseURL: origin });
    contexts.push(anon);
    expect((await anon.get("/api/commerce/orders")).status()).toBe(401);
    for (const ctx of [alice, reviewer]) {
      expect((await ctx.get("/api/admin/products")).status()).toBe(403);
      expect((await ctx.get("/api/admin/orders")).status()).toBe(403);
      expect(
        (
          await ctx.post("/api/admin/orders", {
            data: { entitlementId: "fake", granted: true },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await ctx.post("/api/admin/products", {
            data: { action: "activate", id: "fake", active: true },
          })
        ).status(),
      ).toBe(403);
    }
    const create = {
      action: "create",
      data: {
        slug: prefix,
        name: `${prefix} Test reviewer`,
        description:
          "Synthetic development proof for isolated checkout testing.",
        version: "test-1",
        grantsExams: true,
      },
      amountMinor: 9900,
    };
    let r = await admin.post("/api/admin/products", { data: create });
    expect(r.status()).toBe(200);
    const product = await r.json();
    r = await admin.post("/api/admin/products", {
      data: { action: "activate", id: product.id, active: true },
    });
    expect(r.status()).toBe(409);
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText("SYNTHETIC DEVELOPMENT PROOF. NOT FOR SALE.");
    const bytes = await pdf.save(),
      filename = `${randomUUID()}.pdf`;
    await mkdir(process.env.PDF_PRIVATE_DIR!, { recursive: true });
    await writeFile(path.join(process.env.PDF_PRIVATE_DIR!, filename), bytes);
    const edition = await db.pdfEdition.create({
      data: {
        creatorId: users[0].id,
        kind: "DRAFT",
        title: "Synthetic test proof",
        version: "test-1",
        filename,
        sha256: digest(bytes),
        manifest: { lessons: [], questions: [] },
      },
    });
    r = await admin.post("/api/admin/products", {
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
    const listed = catalog.products.find(
      (p: { id: string }) => p.id === product.id,
    );
    expect(listed.price.amountMinor).toBe(9900);
    expect(JSON.stringify(listed)).not.toMatch(/privateKey|filename|sha256/);
    expect(
      (
        await alice.post("/api/commerce/orders", {
          data: {
            priceId: listed.price.id,
            checkoutKey: randomUUID(),
            totalMinor: 1,
          },
        })
      ).status(),
    ).toBe(400);
    const checkoutKey = randomUUID();
    const replies = await Promise.all(
      [1, 2].map(() =>
        alice.post("/api/commerce/orders", {
          data: { priceId: listed.price.id, checkoutKey },
        }),
      ),
    );
    for (const reply of replies) expect(reply.status()).toBe(201);
    const order = await replies[0].json();
    expect((await replies[1].json()).id).toBe(order.id);
    expect(
      (
        await alice.post("/api/commerce/downloads", {
          data: { artifactId: artifact.id },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await bob.post(`/api/commerce/orders/${order.id}`, {
          data: { action: "simulatePayment" },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await alice.post(`/api/commerce/orders/${order.id}`, {
          data: { action: "simulatePayment", amountMinor: 1 },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await admin.post("/api/admin/products", {
          data: { action: "price", id: product.id, amountMinor: 19900 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await alice.post("/api/commerce/orders", {
          data: { priceId: listed.price.id, checkoutKey: randomUUID() },
        })
      ).status(),
    ).toBe(409);
    const paid = await Promise.all(
      [1, 2].map(() =>
        alice.post(`/api/commerce/orders/${order.id}`, {
          data: { action: "simulatePayment" },
        }),
      ),
    );
    for (const reply of paid) {
      expect(reply.status()).toBe(200);
      expect((await reply.json()).status).toBe("PAID");
    }
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(await db.entitlement.count({ where: { orderId: order.id } })).toBe(
      1,
    );
    expect(
      await db.deliveryNotice.count({ where: { orderId: order.id } }),
    ).toBe(1);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
        .totalMinor,
    ).toBe(9900);
    expect(
      await db.auditEvent.count({
        where: { targetId: order.id, action: "commerce.mock.fulfill" },
      }),
    ).toBe(1);
    const entitlement = await db.entitlement.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect((await bob.get("/api/commerce/orders")).status()).toBe(200);
    expect(await (await bob.get("/api/commerce/orders")).json()).toEqual([]);
    let download = await (
      await alice.post("/api/commerce/downloads", {
        data: { artifactId: artifact.id },
      })
    ).json();
    expect((await bob.get(download.url)).status()).toBe(404);
    r = await alice.get(download.url);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("application/pdf");
    expect(digest(await r.body())).toBe(digest(bytes));
    expect((await alice.get(download.url)).status()).toBe(410);
    download = await (
      await alice.post("/api/commerce/downloads", {
        data: { artifactId: artifact.id },
      })
    ).json();
    expect(
      (
        await admin.post("/api/admin/orders", {
          data: { entitlementId: entitlement.id, granted: false },
        })
      ).status(),
    ).toBe(200);
    expect((await alice.get(download.url)).status()).toBe(403);
    expect(
      (
        await admin.post("/api/admin/orders", {
          data: { entitlementId: entitlement.id, granted: true },
        })
      ).status(),
    ).toBe(200);
    expect((await alice.get(download.url)).status()).toBe(200);
    download = await (
      await alice.post("/api/commerce/downloads", {
        data: { artifactId: artifact.id },
      })
    ).json();
    await db.download.updateMany({
      where: { tokenHash: digest(download.url.split("/").pop()) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await alice.get(download.url)).status()).toBe(410);
    download = await (
      await alice.post("/api/commerce/downloads", {
        data: { artifactId: artifact.id },
      })
    ).json();
    const consumed = await Promise.all([
      alice.get(download.url),
      alice.get(download.url),
    ]);
    expect(consumed.map((r) => r.status()).sort()).toEqual([200, 410]);
    await writeFile(
      path.join(process.env.PDF_PRIVATE_DIR!, filename),
      Buffer.from("tampered"),
    );
    expect(
      (
        await alice.post("/api/commerce/downloads", {
          data: { artifactId: artifact.id },
        })
      ).status(),
    ).toBe(409);
    await writeFile(path.join(process.env.PDF_PRIVATE_DIR!, filename), bytes);
    await page.context().addCookies((await alice.storageState()).cookies);
    await page.goto("/account/purchases");
    await expect(
      page.getByRole("heading", { name: create.data.name }),
    ).toBeVisible();
    await expect(
      page.getByText("Purchase notice recorded in development outbox.", {
        exact: false,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Request draft test PDF", exact: false })
      .click();
    await expect(
      page.getByRole("link", { name: "Download PDF now" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/phase4-library-${testInfo.project.name}.png`,
      fullPage: true,
    });
    const [transfer] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("link", { name: "Download PDF now" }).click(),
    ]);
    expect(transfer.suggestedFilename()).toBe("csc-study-reviewer.pdf");
    expect(await transfer.failure()).toBeNull();
    await page.context().addCookies((await admin.storageState()).cookies);
    await page.goto("/admin/products");
    await expect(
      page.getByRole("heading", { name: create.data.name }),
    ).toBeVisible();
    await expect(
      page.getByText(`${order.id} · Customer ${users[1].id}`, { exact: true }),
    ).toBeVisible();
    await page.context().addCookies((await alice.storageState()).cookies);
    // A pending browser-created order remains unpaid until explicit simulation.
    await page.goto("/shop");
    const card = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: create.data.name }) });
    await card.getByRole("button", { name: "Create simulated order" }).click();
    await expect(page).toHaveURL(/\/account\/purchases$/);
    await expect(
      page.getByRole("button", { name: "Simulate successful payment" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Cancel order", exact: true })
      .click();
    await expect(page.getByText("CANCELLED", { exact: true })).toBeVisible();
    expect(
      (
        await admin.post("/api/admin/products", {
          data: { action: "refundMock", id: order.id },
        })
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
    ).toBe(409);
    expect(
      (
        await alice.post(`/api/commerce/orders/${order.id}`, {
          data: { action: "simulatePayment" },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await anon.post("/api/commerce/webhook", {
          data: { status: "paid", orderId: order.id },
        })
      ).status(),
    ).toBe(503);
  } finally {
    for (const ctx of contexts) await ctx.dispose();
    await db.$disconnect();
  }
});
