import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("production disables simulated checkout and unsigned payment events", async ({
  page,
  request,
}) => {
  const email = `commerce-disabled-${randomUUID()}@example.test`;
  await page.goto("/register");
  await page
    .getByLabel("Name", { exact: true })
    .fill("Production boundary test");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password (12–128 characters)", { exact: true })
    .fill(randomUUID() + "-learning");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account$/);
  const headers = { Origin: "http://127.0.0.1:3100", "X-CSC-Action": "1" };
  expect(
    (
      await page.request.post("/api/commerce/orders", {
        headers,
        data: { priceId: "fake", checkoutKey: randomUUID() },
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await page.request.post("/api/commerce/orders/fake", {
        headers,
        data: { action: "simulatePayment" },
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await request.post("/api/commerce/webhook", { data: { status: "paid" } })
    ).status(),
  ).toBe(503);
  expect(
    (await (await request.get("/api/commerce/catalog")).json())
      .checkoutAvailable,
  ).toBe(false);
  const mailKnown = await page.request.post("/api/auth/request-reset", {
    headers,
    data: { email },
  });
  const mailUnknown = await page.request.post("/api/auth/request-reset", {
    headers,
    data: { email: `missing-${randomUUID()}@example.test` },
  });
  expect(mailKnown.status()).toBe(503);
  expect(mailUnknown.status()).toBe(503);
  expect(await mailKnown.json()).toEqual(await mailUnknown.json());
  expect(
    (
      await page.request.post("/api/auth/request-verification", {
        headers,
        data: {},
      })
    ).status(),
  ).toBe(503);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    const product = await db.product.create({
      data: {
        slug: `disabled-${randomUUID()}`,
        name: "Synthetic mock-only product",
        description: "Production isolation test",
        version: "test",
        prices: { create: { amountMinor: 9900, active: true } },
      },
      include: { prices: true },
    });
    const artifact = await db.artifact.create({
      data: {
        productId: product.id,
        version: "test",
        privateKey: `${randomUUID()}.pdf`,
        sha256: "0".repeat(64),
        developmentOnly: true,
        publishedAt: new Date(),
      },
    });
    const order = await db.order.create({
      data: {
        userId: user.id,
        status: "PAID",
        totalMinor: 9900,
        items: {
          create: {
            productId: product.id,
            priceId: product.prices[0].id,
            unitPriceMinor: 9900,
            quantity: 1,
            productVersion: "test",
          },
        },
        payments: {
          create: {
            provider: "mock",
            providerEventId: randomUUID(),
            status: "VERIFIED",
            verifiedAt: new Date(),
            amountMinor: 9900,
          },
        },
        entitlements: { create: { userId: user.id, productId: product.id } },
      },
    });
    expect(order.status).toBe("PAID");
    expect(
      (
        await page.request.post("/api/commerce/downloads", {
          headers,
          data: { artifactId: artifact.id },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await db.$disconnect();
  }
  await page.goto("/shop");
  await expect(
    page.getByText("Sales are not open.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
