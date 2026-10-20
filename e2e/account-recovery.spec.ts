import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { digest } from "../src/lib/security";
import {
  decryptMail,
  encryptMail,
  processMailBatch,
  queuePurchaseNotices,
} from "../src/lib/mail";
import { localSmtp } from "./local-smtp";

test("verify mailbox, reset safely, revoke sessions and deliver private transactional mail", async ({
  page,
  playwright,
}, testInfo) => {
  test.setTimeout(120000);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const origin = "http://127.0.0.1:3100",
    email = `recovery-${randomUUID()}@example.test`,
    password = randomUUID() + "-original",
    newPassword = randomUUID() + "-updated";
  const headers = { Origin: origin, "X-CSC-Action": "1" };
  const alice = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: headers,
    }),
    other = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: headers,
    }),
    anon = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: headers,
    });
  const names = [
    "MAIL_TRANSPORT",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_ALLOW_INSECURE",
    "MAIL_FROM",
    "SMTP_USER",
    "SMTP_PASSWORD",
  ];
  const original = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  const smtp = await localSmtp();
  const key = Buffer.from(process.env.MAIL_ENCRYPTION_KEY!, "hex");
  process.env.MAIL_TRANSPORT = "file";
  let fixtureUserId: string | undefined;
  try {
    expect(
      (
        await alice.post("/api/auth/register", {
          data: { name: "Recovery Learner", email, password },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await other.post("/api/auth/login", { data: { email, password } })
      ).status(),
    ).toBe(200);
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    fixtureUserId = user.id;
    expect(
      (
        await anon.post("/api/auth/request-verification", { data: {} })
      ).status(),
    ).toBe(401);
    expect(
      (
        await alice.post("/api/auth/request-verification", {
          headers: { Origin: "https://untrusted.example.test" },
          data: {},
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await alice.post("/api/auth/request-verification", { data: {} })
      ).status(),
    ).toBe(202);
    const verification = await db.mailMessage.findFirstOrThrow({
      where: { userId: user.id, purpose: "VERIFY_EMAIL" },
    });
    expect(verification.encryptedPayload!.includes(email)).toBe(false);
    function linkFor(encrypted: string) {
      const payload = decryptMail(encrypted, key);
      const url = payload.text
        .split("\n")
        .find((line) => line.startsWith(origin))!;
      const token = new URLSearchParams(new URL(url).hash.slice(1)).get(
        "token",
      )!;
      return { url, token };
    }
    const verificationLink = linkFor(verification.encryptedPayload!);
    const record = await db.accountToken.findUniqueOrThrow({
      where: { id: verification.tokenId! },
    });
    expect(record.tokenHash === digest(verificationLink.token)).toBe(true);
    expect(record.tokenHash === verificationLink.token).toBe(false);
    const mismatched = await db.mailMessage.create({
      data: {
        userId: user.id,
        tokenId: record.id,
        purpose: "RESET_PASSWORD",
        transport: "file",
        expiresAt: record.expiresAt,
        encryptedPayload: verification.encryptedPayload,
      },
    });
    const deliveries = await Promise.all([
      processMailBatch(db),
      processMailBatch(db),
    ]);
    expect(deliveries.reduce((n, c) => n + c.sent, 0)).toBe(1);
    expect(
      (await db.mailMessage.findUniqueOrThrow({ where: { id: mismatched.id } }))
        .status,
    ).toBe("CANCELLED");
    expect(
      (
        await db.mailMessage.findUniqueOrThrow({
          where: { id: verification.id },
        })
      ).encryptedPayload,
    ).toBeNull();
    const privateFile = path.join(
      process.env.MAIL_PRIVATE_DIR!,
      `${verification.id}.json`,
    );
    expect((await stat(privateFile)).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(privateFile, "utf8")).to === email).toBe(
      true,
    );
    expect(
      (
        await anon.post("/api/auth/reset-password", {
          data: { token: verificationLink.token, password: newPassword },
        })
      ).status(),
    ).toBe(400);
    await page.goto(verificationLink.url);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } }))
        .emailVerifiedAt,
    ).toBeNull();
    await page
      .getByRole("button", { name: "Confirm email address", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "email address is verified",
    );
    expect(
      (
        await anon.post("/api/auth/verify-email", {
          data: { token: verificationLink.token },
        })
      ).status(),
    ).toBe(400);
    const requestKnown = await anon.post("/api/auth/request-reset", {
        data: { email },
      }),
      requestUnknown = await anon.post("/api/auth/request-reset", {
        data: { email: `absent-${randomUUID()}@example.test` },
      });
    expect(requestKnown.status()).toBe(202);
    expect(requestUnknown.status()).toBe(202);
    expect(await requestKnown.json()).toEqual(await requestUnknown.json());
    let resets = await db.mailMessage.findMany({
      where: {
        userId: user.id,
        purpose: "RESET_PASSWORD",
        token: { purpose: "RESET_PASSWORD" },
      },
      orderBy: { createdAt: "asc" },
    });
    expect(resets.length).toBe(1);
    const oldLink = linkFor(resets[0].encryptedPayload!);
    expect(
      (
        await anon.post("/api/auth/request-reset", { data: { email } })
      ).status(),
    ).toBe(202);
    expect(
      await db.mailMessage.count({
        where: {
          userId: user.id,
          purpose: "RESET_PASSWORD",
          token: { purpose: "RESET_PASSWORD" },
        },
      }),
    ).toBe(1);
    await db.accountToken.update({
      where: { id: resets[0].tokenId! },
      data: { createdAt: new Date(Date.now() - 120000) },
    });
    expect(
      (
        await anon.post("/api/auth/request-reset", { data: { email } })
      ).status(),
    ).toBe(202);
    resets = await db.mailMessage.findMany({
      where: {
        userId: user.id,
        purpose: "RESET_PASSWORD",
        token: { purpose: "RESET_PASSWORD" },
      },
      orderBy: { createdAt: "asc" },
    });
    expect(resets.length).toBe(2);
    const active = resets.find((r) => r.status === "PENDING")!,
      resetLink = linkFor(active.encryptedPayload!);
    expect(
      (
        await anon.post("/api/auth/reset-password", {
          data: { token: oldLink.token, password: newPassword },
        })
      ).status(),
    ).toBe(400);
    await db.accountToken.update({
      where: { id: active.tokenId! },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (
        await anon.post("/api/auth/reset-password", {
          data: { token: resetLink.token, password: newPassword },
        })
      ).status(),
    ).toBe(400);
    await db.accountToken.update({
      where: { id: active.tokenId! },
      data: { expiresAt: new Date(Date.now() + 1800000) },
    });
    // Switch only this isolated message to the local SMTP sink. No remote service is contacted.
    process.env.MAIL_TRANSPORT = "smtp";
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = String(smtp.port);
    process.env.SMTP_ALLOW_INSECURE = "true";
    process.env.MAIL_FROM = "sender@example.test";
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    await db.mailMessage.update({
      where: { id: active.id },
      data: { transport: "smtp" },
    });
    expect((await processMailBatch(db)).sent).toBe(1);
    expect(smtp.messages.length).toBe(1);
    expect((await processMailBatch(db)).sent).toBe(0);
    await page.goto(resetLink.url);
    await page
      .getByLabel("New password (12–128 characters)", { exact: true })
      .fill(newPassword);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(newPassword + "-mismatch");
    await page
      .getByRole("button", { name: "Save new password", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("do not match");
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(newPassword);
    await page
      .getByRole("button", { name: "Save new password", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "all sessions signed out",
    );
    expect((await alice.get("/api/commerce/orders")).status()).toBe(401);
    expect((await other.get("/api/commerce/orders")).status()).toBe(401);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect(
      (
        await anon.post("/api/auth/reset-password", {
          data: { token: resetLink.token, password: newPassword },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await alice.post("/api/auth/login", { data: { email, password } })
      ).status(),
    ).toBe(401);
    expect(
      (
        await alice.post("/api/auth/login", {
          data: { email, password: newPassword },
        })
      ).status(),
    ).toBe(200);
    // A stale password login cannot establish a session after a racing reset commits.
    const current = await db.user.findUniqueOrThrow({ where: { id: user.id } }),
      raceToken = randomBytes(32).toString("hex"),
      finalPassword = randomUUID() + "-final";
    await db.accountToken.create({
      data: {
        userId: user.id,
        email,
        purpose: "RESET_PASSWORD",
        authVersion: current.authVersion,
        tokenHash: digest(raceToken),
        expiresAt: new Date(Date.now() + 1800000),
      },
    });
    const race = await Promise.all([
      other.post("/api/auth/login", { data: { email, password: newPassword } }),
      anon.post("/api/auth/reset-password", {
        data: { token: raceToken, password: finalPassword },
      }),
      anon.post("/api/auth/reset-password", {
        data: { token: raceToken, password: finalPassword },
      }),
    ]);
    expect([200, 401]).toContain(race[0].status());
    expect([race[1].status(), race[2].status()].sort()).toEqual([200, 400]);
    expect((await other.get("/api/commerce/orders")).status()).toBe(401);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).role,
    ).toBe("CUSTOMER");
    // SMTP rejection retries with backoff and erases credentials after the retry cap.
    smtp.setAccept(false);
    const failed = await db.mailMessage.create({
      data: {
        userId: user.id,
        purpose: "PASSWORD_CHANGED",
        transport: "smtp",
        expiresAt: new Date(Date.now() + 86400000),
        encryptedPayload: encryptMail(
          {
            to: email,
            subject: "Synthetic retry test",
            text: "Local delivery test only.",
          },
          key,
        ),
      },
    });
    const firstFailure = await processMailBatch(db);
    expect(firstFailure.retried).toBeGreaterThanOrEqual(1);
    let row = await db.mailMessage.findUniqueOrThrow({
      where: { id: failed.id },
    });
    expect(row.status).toBe("PENDING");
    expect(row.lastErrorCode).toBe("DELIVERY_FAILED");
    expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
    await db.mailMessage.update({
      where: { id: failed.id },
      data: { attempts: 4, availableAt: new Date(Date.now() - 1000) },
    });
    expect((await processMailBatch(db)).failed).toBeGreaterThanOrEqual(1);
    row = await db.mailMessage.findUniqueOrThrow({ where: { id: failed.id } });
    expect(row.status).toBe("FAILED");
    expect(row.encryptedPayload).toBeNull();
    process.env.MAIL_TRANSPORT = "file";
    // Purchase email is queued only for a verified mailbox and backed by coherent paid state.
    const product = await db.product.create({
      data: {
        slug: `mail-${randomUUID()}`,
        name: "Synthetic mail product",
        description: "Local notification testing",
        version: "test",
        prices: { create: { amountMinor: 9900 } },
      },
      include: { prices: true },
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
        notices: { create: { userId: user.id } },
      },
    });
    await Promise.all([queuePurchaseNotices(db), queuePurchaseNotices(db)]);
    expect(
      await db.mailMessage.count({ where: { notice: { orderId: order.id } } }),
    ).toBe(1);
    expect((await processMailBatch(db)).sent).toBeGreaterThanOrEqual(1);
    expect(
      (
        await db.deliveryNotice.findFirstOrThrow({
          where: { orderId: order.id },
        })
      ).transport,
    ).toBe("development-file");
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page
      .getByLabel("Password (12–128 characters)", { exact: true })
      .fill(finalPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByText("Email address verified.", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/phase5-account-${testInfo.project.name}.png`,
      fullPage: true,
    });
  } finally {
    if (fixtureUserId)
      await db.mailMessage.updateMany({
        where: {
          userId: fixtureUserId,
          status: { in: ["PENDING", "PROCESSING"] },
        },
        data: {
          status: "CANCELLED",
          encryptedPayload: null,
          leaseKey: null,
          leaseUntil: null,
        },
      });
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
    await smtp.close();
    await alice.dispose();
    await other.dispose();
    await anon.dispose();
    await db.$disconnect();
  }
});
