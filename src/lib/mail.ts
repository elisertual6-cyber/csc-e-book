// Node-only transport/queue primitives, also used by the operator worker and tests.
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { z } from "zod";
import type { PrismaClient, Prisma } from "@prisma/client";
import { HttpError } from "./http";

type Env = Record<string, string | undefined>;
const payloadSchema = z
  .object({
    to: z.email().max(254),
    subject: z.string().min(1).max(200),
    text: z.string().min(1).max(20000),
  })
  .strict();
export type MailPayload = z.infer<typeof payloadSchema>;
export function mailTransport(
  env: Env = process.env,
): "disabled" | "file" | "smtp" {
  const mode =
    env.MAIL_TRANSPORT ?? (env.NODE_ENV === "production" ? "disabled" : "file");
  if (
    !["disabled", "file", "smtp"].includes(mode) ||
    (mode === "file" && env.NODE_ENV === "production")
  )
    throw new HttpError(503, "Mail delivery is not configured safely.");
  return mode as "disabled" | "file" | "smtp";
}
export function smtpConfig(env: Env = process.env) {
  const host = env.SMTP_HOST,
    from = env.MAIL_FROM;
  const port = Number(env.SMTP_PORT ?? 465);
  if (
    !host ||
    !from ||
    !z.email().safeParse(from).success ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !!env.SMTP_USER !== !!env.SMTP_PASSWORD
  )
    throw new HttpError(503, "SMTP configuration is incomplete.");
  const insecure = env.SMTP_ALLOW_INSECURE === "true";
  if (
    insecure &&
    (env.NODE_ENV === "production" ||
      !["localhost", "127.0.0.1", "::1"].includes(host))
  )
    throw new HttpError(
      503,
      "Unencrypted SMTP is restricted to local development receivers.",
    );
  return {
    host,
    port,
    secure: port === 465,
    requireTLS: !insecure,
    ignoreTLS: insecure,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD! }
      : undefined,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    logger: false as const,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
    tls: { minVersion: "TLSv1.2" as const, rejectUnauthorized: true },
    from,
  };
}
export function mailDirectory(env: Env = process.env) {
  const dir = path.resolve(env.MAIL_PRIVATE_DIR ?? ".local/mail");
  for (const exposed of [path.resolve("public"), path.resolve(".next")])
    if (dir === exposed || dir.startsWith(exposed + path.sep))
      throw new HttpError(503, "Mail files must be private.");
  return dir;
}
export async function mailKey(env: Env = process.env) {
  if (env.MAIL_ENCRYPTION_KEY) {
    if (!/^[a-f0-9]{64}$/i.test(env.MAIL_ENCRYPTION_KEY))
      throw new HttpError(503, "Mail encryption is not configured safely.");
    return Buffer.from(env.MAIL_ENCRYPTION_KEY, "hex");
  }
  if (env.NODE_ENV === "production")
    throw new HttpError(503, "Mail encryption is not configured.");
  const dir = mailDirectory(env);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, "encryption.key");
  try {
    await writeFile(file, randomBytes(32), { mode: 0o600, flag: "wx" });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  const key = await readFile(file);
  if (key.length !== 32)
    throw new HttpError(503, "Mail encryption key is invalid.");
  return key;
}
export function encryptMail(payload: MailPayload, key: Buffer) {
  const nonce = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from("csc-mail-v1"));
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(payloadSchema.parse(payload)), "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    nonce.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    bytes.toString("base64"),
  ].join(":");
}
export function decryptMail(value: string, key: Buffer): MailPayload {
  const [version, nonce, tag, bytes, ...extra] = value.split(":");
  if (version !== "v1" || !nonce || !tag || !bytes || extra.length)
    throw new Error("Invalid encrypted message.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(nonce, "base64"),
  );
  decipher.setAAD(Buffer.from("csc-mail-v1"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return payloadSchema.parse(
    JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(bytes, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    ),
  );
}
export async function mailSetup() {
  const transport = mailTransport();
  if (transport === "disabled")
    throw new HttpError(
      503,
      "Email delivery is not available on this deployment. Contact the operator for account help.",
    );
  if (transport === "smtp") smtpConfig();
  else mailDirectory();
  const origin = new URL(process.env.APP_URL ?? "http://localhost:3000");
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    !["http:", "https:"].includes(origin.protocol) ||
    (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
  )
    throw new HttpError(
      503,
      "A secure application origin is required for email links.",
    );
  return { transport, key: await mailKey(), origin: origin.origin };
}
export async function enqueueMail(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    purpose: string;
    payload: MailPayload;
    expiresAt: Date;
    tokenId?: string;
    noticeId?: string;
  },
  setup: Awaited<ReturnType<typeof mailSetup>>,
) {
  const { payload, ...data } = input;
  return tx.mailMessage.create({
    data: {
      ...data,
      transport: setup.transport,
      encryptedPayload: encryptMail(payload, setup.key),
    },
  });
}
async function deliver(id: string, payload: MailPayload, transport: string) {
  if (transport !== mailTransport()) throw new Error("MAIL_TRANSPORT_CHANGED");
  if (transport === "file") {
    if (!/^[a-z0-9]+$/.test(id)) throw new Error("Invalid message id.");
    const dir = mailDirectory();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    // Private development inbox. Never expose through an HTTP route or log message bodies.
    await writeFile(
      path.join(dir, `${id}.json`),
      JSON.stringify({ id, ...payload }),
      { mode: 0o600 },
    );
    return;
  }
  if (transport !== "smtp") throw new Error("MAIL_DISABLED");
  const { from, ...options } = smtpConfig();
  const sender = nodemailer.createTransport(options);
  try {
    const result = await sender.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      messageId: `<${id}@${from.split("@")[1]}>`,
    });
    if (!result.accepted?.length || result.rejected?.length)
      throw new Error("SMTP_REJECTED");
  } finally {
    sender.close();
  }
}
type NoticeOrder = Prisma.OrderGetPayload<{
  include: {
    payments: true;
    entitlements: true;
    items: { include: { price: true } };
  };
}>;
function eligibleNotice(order: NoticeOrder, userId: string, time: Date) {
  return (
    order.userId === userId &&
    order.status === "PAID" &&
    order.items.length > 0 &&
    order.items.every(
      (i) =>
        i.quantity > 0 &&
        i.unitPriceMinor > 0 &&
        i.price.productId === i.productId &&
        i.price.currency === order.currency &&
        order.entitlements.some(
          (e) =>
            e.userId === userId &&
            e.productId === i.productId &&
            !e.revokedAt &&
            (!e.expiresAt || e.expiresAt > time),
        ),
    ) &&
    order.items.reduce((n, i) => n + i.quantity * i.unitPriceMinor, 0) ===
      order.totalMinor &&
    order.payments.some(
      (p) =>
        p.status === "VERIFIED" &&
        p.verifiedAt &&
        p.amountMinor === order.totalMinor &&
        p.currency === order.currency &&
        (p.provider !== "mock" || process.env.NODE_ENV !== "production"),
    )
  );
}
export async function processMailBatch(db: PrismaClient, limit = 25) {
  const counts = { sent: 0, retried: 0, failed: 0, cancelled: 0 };
  const maximum = Math.max(1, Math.min(100, Math.trunc(limit)));
  for (let i = 0; i < maximum; i++) {
    const claim = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM "MailMessage" WHERE ((status='PENDING' AND "availableAt"<=clock_timestamp()) OR (status='PROCESSING' AND "leaseUntil"<=clock_timestamp())) ORDER BY "availableAt",id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows.length) return null;
      const key = randomUUID();
      const clock = (
        await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
      )[0].now;
      return tx.mailMessage.update({
        where: { id: rows[0].id },
        data: {
          status: "PROCESSING",
          leaseKey: key,
          leaseUntil: new Date(clock.getTime() + 120000),
          attempts: { increment: 1 },
        },
        include: {
          user: {
            select: { email: true, authVersion: true, emailVerifiedAt: true },
          },
          token: true,
          notice: {
            include: {
              order: {
                include: {
                  payments: true,
                  entitlements: true,
                  items: { include: { price: true } },
                },
              },
            },
          },
        },
      });
    });
    if (!claim) break;
    const condition = {
      id: claim.id,
      status: "PROCESSING" as const,
      leaseKey: claim.leaseKey,
    };
    const time = (
      await db.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
    )[0].now;
    if (claim.attempts > 5) {
      await db.mailMessage.updateMany({
        where: condition,
        data: {
          status: "FAILED",
          encryptedPayload: null,
          leaseKey: null,
          leaseUntil: null,
          lastErrorCode: "DELIVERY_FAILED",
        },
      });
      counts.failed++;
      continue;
    }
    const token = claim.token;
    const invalidToken =
      claim.tokenId &&
      (!token ||
        token.userId !== claim.userId ||
        token.purpose !== claim.purpose ||
        token.consumedAt ||
        token.expiresAt <= time ||
        token.authVersion !== claim.user.authVersion ||
        token.email !== claim.user.email);
    const invalidNotice =
      claim.notice &&
      (!claim.user.emailVerifiedAt ||
        !eligibleNotice(claim.notice.order, claim.userId, time));
    if (
      claim.expiresAt <= time ||
      !claim.encryptedPayload ||
      invalidToken ||
      invalidNotice
    ) {
      await db.mailMessage.updateMany({
        where: condition,
        data: {
          status: "CANCELLED",
          encryptedPayload: null,
          leaseUntil: null,
          leaseKey: null,
        },
      });
      counts.cancelled++;
      continue;
    }
    try {
      const payload = decryptMail(claim.encryptedPayload, await mailKey());
      if (payload.to !== claim.user.email)
        throw new Error("Recipient changed.");
      await deliver(claim.id, payload, claim.transport);
      await db.$transaction(async (tx) => {
        const saved = await tx.mailMessage.updateMany({
          where: condition,
          data: {
            status: "SENT",
            sentAt: time,
            encryptedPayload: null,
            leaseUntil: null,
            leaseKey: null,
            lastErrorCode: null,
          },
        });
        if (saved.count && claim.noticeId)
          await tx.deliveryNotice.update({
            where: { id: claim.noticeId },
            data: {
              transport:
                claim.transport === "smtp"
                  ? "smtp-accepted"
                  : "development-file",
            },
          });
      });
      counts.sent++;
    } catch {
      const failed = claim.attempts >= 5;
      await db.mailMessage.updateMany({
        where: condition,
        data: {
          status: failed ? "FAILED" : "PENDING",
          encryptedPayload: failed ? null : claim.encryptedPayload,
          availableAt: new Date(
            time.getTime() + 60000 * 2 ** Math.min(claim.attempts - 1, 6),
          ),
          leaseUntil: null,
          leaseKey: null,
          lastErrorCode: "DELIVERY_FAILED",
        },
      });
      counts[failed ? "failed" : "retried"]++;
    }
  }
  return counts;
}
export async function queuePurchaseNotices(db: PrismaClient) {
  const setup = await mailSetup();
  const notices = await db.deliveryNotice.findMany({
    where: {
      mailMessage: null,
      user: { emailVerifiedAt: { not: null } },
      order: { status: "PAID" },
    },
    include: {
      user: true,
      order: {
        include: {
          payments: true,
          entitlements: true,
          items: { include: { price: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  let queued = 0;
  for (const notice of notices) {
    const order = notice.order;
    if (!eligibleNotice(order, notice.userId, new Date())) continue;
    try {
      await db.$transaction(async (tx) => {
        await enqueueMail(
          tx,
          {
            userId: notice.userId,
            noticeId: notice.id,
            purpose: "PURCHASE_READY",
            expiresAt: new Date(Date.now() + 7 * 86400000),
            payload: {
              to: notice.user.email,
              subject: "Your CSC Study materials are ready",
              text: `Your ${process.env.NODE_ENV !== "production" && order.payments.some((p) => p.provider === "mock") ? "simulated development " : ""}order ${order.id} is ready. Sign in to your account to request a private download: ${setup.origin}/account/purchases\n\nNo private files or download tokens are included in this email. CSC Study is independent and unofficial.`,
            },
          },
          setup,
        );
        await tx.deliveryNotice.update({
          where: { id: notice.id },
          data: {
            transport:
              setup.transport === "smtp"
                ? "smtp-queued"
                : "development-file-queued",
          },
        });
      });
      queued++;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  return queued;
}
