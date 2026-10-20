import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import {
  encryptMail,
  decryptMail,
  mailTransport,
  smtpConfig,
  mailDirectory,
} from "../src/lib/mail";
describe("private mail configuration", () => {
  it("authenticates encrypted payloads and rejects corruption/wrong keys", () => {
    const key = randomBytes(32),
      payload = {
        to: "learner@example.test",
        subject: "Account link",
        text: "An opaque private credential",
      };
    const encrypted = encryptMail(payload, key);
    expect(encrypted).not.toContain(payload.to);
    expect(encrypted).not.toContain(payload.text);
    expect(decryptMail(encrypted, key)).toEqual(payload);
    expect(() => decryptMail(encrypted, randomBytes(32))).toThrow();
    expect(() =>
      decryptMail(encrypted.slice(0, -8) + "AAAAAAAA", key),
    ).toThrow();
  });
  it("disables production mail by default and rejects production file inboxes", () => {
    expect(mailTransport({ NODE_ENV: "production" })).toBe("disabled");
    expect(mailTransport({ NODE_ENV: "development" })).toBe("file");
    expect(() =>
      mailTransport({ NODE_ENV: "production", MAIL_TRANSPORT: "file" }),
    ).toThrow();
    expect(() =>
      mailDirectory({ MAIL_PRIVATE_DIR: "public/messages" }),
    ).toThrow();
    expect(() =>
      mailDirectory({ MAIL_PRIVATE_DIR: ".next/messages" }),
    ).toThrow();
  });
  it("requires authenticated TLS verification for remote SMTP and rejects partial credentials", () => {
    const env = {
      NODE_ENV: "production",
      SMTP_HOST: "smtp.example.test",
      SMTP_PORT: "587",
      MAIL_FROM: "support@example.test",
    };
    expect(smtpConfig(env)).toMatchObject({
      secure: false,
      requireTLS: true,
      ignoreTLS: false,
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    });
    expect(smtpConfig({ ...env, SMTP_PORT: "465" })).toMatchObject({
      secure: true,
      requireTLS: true,
    });
    expect(() => smtpConfig({ ...env, SMTP_ALLOW_INSECURE: "true" })).toThrow();
    expect(() => smtpConfig({ ...env, SMTP_USER: "only-user" })).toThrow();
    expect(() => smtpConfig({ ...env, SMTP_PORT: "0" })).toThrow();
    expect(
      smtpConfig({
        NODE_ENV: "development",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: "2525",
        SMTP_ALLOW_INSECURE: "true",
        MAIL_FROM: "sender@example.test",
      }),
    ).toMatchObject({ ignoreTLS: true, requireTLS: false });
  });
});
