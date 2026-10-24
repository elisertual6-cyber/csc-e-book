import nodemailer from "nodemailer";
import { mailSetup, mailTransport, smtpConfig } from "./mail";

export class MailReadinessError extends Error {
  constructor(public stage: "configuration" | "smtp-connection", public reason: "configuration" | "authentication" | "connection" | "unknown") {
    super(`Mail readiness failed at ${stage} (${reason}).`);
  }
}
// verify() negotiates the connection/TLS/authentication; it never submits an email.
export async function checkMailReadiness(connect = false) {
  try {
    if (mailTransport() !== "smtp" || !/^[a-f0-9]{64}$/i.test(process.env.MAIL_ENCRYPTION_KEY ?? "")) throw new Error();
    await mailSetup();
  } catch { throw new MailReadinessError("configuration", "configuration"); }
  if (!connect) return { configuration: "ready", smtpConnection: "not_checked", delivery: "not_tested" } as const;
  const options = smtpConfig();
  const sender = nodemailer.createTransport(options);
  try {
    await sender.verify();
    return { configuration: "ready", smtpConnection: "verified", delivery: "not_tested" } as const;
  } catch (error) {
    const code = (error as { code?: unknown })?.code;
    const reason = code === "EAUTH" ? "authentication" : ["ESOCKET", "ECONNECTION", "ETIMEDOUT", "ETLS", "EDNS"].includes(String(code)) ? "connection" : "unknown";
    throw new MailReadinessError("smtp-connection", reason);
  } finally { sender.close(); }
}
