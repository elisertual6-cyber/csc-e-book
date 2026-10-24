import "dotenv/config";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { encryptMail } from "../src/lib/mail";
import { localSmtp } from "./local-smtp";
function fixtureDb() {
  expect(new URL(process.env.DATABASE_URL!).pathname).toMatch(/^\/csc_e2e_[a-f0-9]{16}$/);
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}
async function queuedText(id: string) {
  const file = JSON.parse(await readFile(path.join(process.env.MAIL_PRIVATE_DIR!, `${id}.json`), "utf8"));
  return file.text as string;
}
const headers = { Origin: "http://127.0.0.1:3100", "X-CSC-Action": "1" };
test("account requests dispatch only their committed message automatically after the response", async ({ playwright }) => {
  test.setTimeout(90000);
  const db = fixtureDb();
  const api = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3100", extraHTTPHeaders: headers });
  const email = `automatic-${randomUUID()}@example.test`, password = `${randomUUID()}-old`, updated = `${randomUUID()}-new`;
  const owners: string[] = [];
  try {
    expect((await api.post("/api/auth/register", { data: { email, password, name: "Synthetic automatic mail" } })).status()).toBe(201);
    const user = await db.user.findUniqueOrThrow({ where: { email } }); owners.push(user.id);
    const other = await db.user.create({ data: { email: `other-${email}`, name: "Synthetic queued neighbor", passwordHash: "not-a-login-password" } }); owners.push(other.id);
    const key = Buffer.from(process.env.MAIL_ENCRYPTION_KEY!, "hex");
    const unrelated = await db.mailMessage.create({ data: { userId: other.id, purpose: "PASSWORD_CHANGED", transport: "file", expiresAt: new Date(Date.now() + 600000), availableAt: new Date(0), encryptedPayload: encryptMail({ to: other.email, subject: "Synthetic unrelated", text: "Must not be dispatched by another request" }, key) } });
    const purchase = await db.mailMessage.create({ data: { userId: user.id, purpose: "PURCHASE_READY", transport: "file", expiresAt: new Date(Date.now() + 600000), availableAt: new Date(0), encryptedPayload: encryptMail({ to: email, subject: "Synthetic purchase", text: "Not account mail" }, key) } });
    const requested = await api.post("/api/auth/request-verification", { data: {} });
    expect(requested.status()).toBe(202); expect(Object.keys(await requested.json())).toEqual(["message"]);
    await expect.poll(async () => (await db.mailMessage.findFirst({ where: { userId: user.id, purpose: "VERIFY_EMAIL" } }))?.status, { timeout: 15000 }).toBe("SENT");
    const verification = await db.mailMessage.findFirstOrThrow({ where: { userId: user.id, purpose: "VERIFY_EMAIL" } });
    expect(verification.encryptedPayload).toBeNull();
    const token = (await queuedText(verification.id)).match(/#token=([a-f0-9]{64})/)![1];
    expect((await api.post("/api/auth/verify-email", { data: { token } })).status()).toBe(200);
    const reset = await api.post("/api/auth/request-reset", { data: { email } }); expect(reset.status()).toBe(202);
    const unknown = await api.post("/api/auth/request-reset", { data: { email: `missing-${email}` } });
    expect(unknown.status()).toBe(202); expect(await unknown.json()).toEqual(await reset.json());
    await expect.poll(async () => (await db.mailMessage.findFirst({ where: { userId: user.id, purpose: "RESET_PASSWORD" } }))?.status, { timeout: 15000 }).toBe("SENT");
    const resetMail = await db.mailMessage.findFirstOrThrow({ where: { userId: user.id, purpose: "RESET_PASSWORD" } });
    const resetToken = (await queuedText(resetMail.id)).match(/#token=([a-f0-9]{64})/)![1];
    expect((await api.post("/api/auth/reset-password", { data: { token: resetToken, password: updated } })).status()).toBe(200);
    await expect.poll(async () => (await db.mailMessage.findFirst({ where: { userId: user.id, purpose: "PASSWORD_CHANGED" } }))?.status, { timeout: 15000 }).toBe("SENT");
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    expect((await api.post("/api/auth/login", { data: { email, password } })).status()).toBe(401);
    expect((await api.post("/api/auth/login", { data: { email, password: updated } })).status()).toBe(200);
    expect((await api.post("/api/auth/reset-password", { data: { token: resetToken, password: updated } })).status()).toBe(400);
    for (const id of [unrelated.id, purchase.id]) expect((await db.mailMessage.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING");
  } finally {
    await db.mailMessage.updateMany({ where: { userId: { in: owners }, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "CANCELLED", encryptedPayload: null } });
    await api.dispose(); await db.$disconnect();
  }
});

test("retry sweeper handles due account mail, expired leases, failures and concurrent retries without purchase dispatch", async () => {
  test.setTimeout(90000);
  const db = fixtureDb(), smtp = await localSmtp();
  const prefix = `sweep-${randomUUID()}`;
  const users = await Promise.all([0, 1].map(index => db.user.create({ data: { email: `${prefix}-${index}@example.test`, name: "Synthetic account retry", passwordHash: "not-a-login-password" } })));
  const key = Buffer.from(process.env.MAIL_ENCRYPTION_KEY!, "hex");
  const url = new URL(process.env.DATABASE_URL!); url.searchParams.set("sslmode", "disable");
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development", DATABASE_URL: url.toString(), DIRECT_URL: url.toString(),
    ACCOUNT_MAIL_AUTOMATION: "true", MAIL_TRANSPORT: "smtp", SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtp.port), SMTP_ALLOW_INSECURE: "true",
    SMTP_USER: "", SMTP_PASSWORD: "", MAIL_FROM: "fixture@example.test", APP_URL: "http://127.0.0.1:3100", DATABASE_CA_PEM: "" };
  async function worker(enabled = true) {
    const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "scripts/account-mail-worker.ts", "--send"], { env: { ...env, ACCOUNT_MAIL_AUTOMATION: enabled ? "true" : "false" }, stdio: ["ignore", "pipe", "pipe"] });
    let output = ""; child.stdout.on("data", bytes => { output += bytes.toString(); }); child.stderr.on("data", bytes => { output += bytes.toString(); });
    const [status] = await once(child, "exit");
    for (const user of users) expect(output).not.toContain(user.email);
    expect(output).not.toContain(key.toString("hex"));
    const line = output.split("\n").find(value => value.startsWith('{"accountMail":'))!;
    return { status, report: JSON.parse(line) };
  }
  async function message(index: number, purpose = "PASSWORD_CHANGED", extra = {}) {
    return db.mailMessage.create({ data: { userId: users[index].id, purpose, transport: "smtp", availableAt: new Date(0), expiresAt: new Date(Date.now() + 600000), encryptedPayload: encryptMail({ to: users[index].email, subject: "Synthetic retry", text: "Fixture notification" }, key), ...extra } });
  }
  try {
    await message(0); await message(1);
    await message(0, "PASSWORD_CHANGED", { status: "PROCESSING", leaseKey: randomUUID(), leaseUntil: new Date(0) });
    const expired = await message(0, "PASSWORD_CHANGED", { expiresAt: new Date(0) });
    const future = await message(0, "PASSWORD_CHANGED", { availableAt: new Date(Date.now() + 600000) });
    const purchase = await message(1, "PURCHASE_READY");
    expect((await worker(false)).status).toBe(1); expect(smtp.messages).toHaveLength(0);
    const first = await worker(); expect(first.status).toBe(0); expect(first.report).toMatchObject({ sent: 3, cancelled: 1 });
    expect(smtp.messages).toHaveLength(3); expect((await db.mailMessage.findUniqueOrThrow({ where: { id: expired.id } })).encryptedPayload).toBeNull();
    for (const id of [future.id, purchase.id]) expect((await db.mailMessage.findUniqueOrThrow({ where: { id } })).status).toBe("PENDING");
    smtp.setAccept(false); const retry = await message(0);
    const rejected = await worker(); expect(rejected.status).toBe(1); expect(rejected.report.retried).toBe(1);
    const pending = await db.mailMessage.findUniqueOrThrow({ where: { id: retry.id } });
    expect(pending.status).toBe("PENDING"); expect(pending.availableAt.getTime()).toBeGreaterThan(Date.now());
    smtp.setAccept(true); await db.mailMessage.update({ where: { id: retry.id }, data: { availableAt: new Date(0) } });
    const concurrent = await Promise.all([worker(), worker()]);
    expect(concurrent.reduce((count, item) => count + item.report.sent, 0)).toBe(1);
    expect(smtp.messages).toHaveLength(4);
    expect((await db.mailMessage.findUniqueOrThrow({ where: { id: retry.id } })).encryptedPayload).toBeNull();
  } finally {
    await db.mailMessage.updateMany({ where: { userId: { in: users.map(user => user.id) }, status: { in: ["PENDING", "PROCESSING"] } }, data: { status: "CANCELLED", encryptedPayload: null, leaseKey: null, leaseUntil: null } });
    await smtp.close(); await db.$disconnect();
  }
});
