import nodemailer from "nodemailer";
import { z } from "zod";
import { mailSetup, mailTransport, smtpConfig } from "./mail";

type MailIssueField = "MAIL_TRANSPORT" | "MAIL_ENCRYPTION_KEY" | "APP_URL" | "SMTP_HOST" | "SMTP_PORT" | "SMTP_USER" | "SMTP_PASSWORD" | "MAIL_FROM" | "SMTP_ALLOW_INSECURE";
type MailIssueProblem = "required" | "expected_64_hex_characters" | "expected_plain_email_address" | "expected_valid_port" | "smtp_required" | "insecure_not_allowed" | "expected_application_origin";
export type MailConfigurationIssue = { field: MailIssueField; problem: MailIssueProblem };
export function mailConfigurationIssues(env: Record<string, string | undefined> = process.env) {
  const issues: MailConfigurationIssue[] = [];
  const add = (field: MailIssueField, problem: MailIssueProblem) => issues.push({ field, problem });
  if (env.MAIL_TRANSPORT !== "smtp") add("MAIL_TRANSPORT", "smtp_required");
  if (!/^[a-f0-9]{64}$/i.test(env.MAIL_ENCRYPTION_KEY ?? "")) add("MAIL_ENCRYPTION_KEY", "expected_64_hex_characters");
  if (!env.SMTP_HOST?.trim()) add("SMTP_HOST", "required");
  const port = Number(env.SMTP_PORT ?? 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) add("SMTP_PORT", "expected_valid_port");
  if (!z.email().safeParse(env.MAIL_FROM).success) add("MAIL_FROM", "expected_plain_email_address");
  const gmail = env.SMTP_HOST?.toLowerCase() === "smtp.gmail.com";
  if ((gmail || env.SMTP_PASSWORD) && !env.SMTP_USER) add("SMTP_USER", "required");
  if ((gmail || env.SMTP_USER) && !env.SMTP_PASSWORD) add("SMTP_PASSWORD", "required");
  if (env.SMTP_ALLOW_INSECURE === "true" && (env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(env.SMTP_HOST ?? ""))) add("SMTP_ALLOW_INSECURE", "insecure_not_allowed");
  try {
    const origin = new URL(env.APP_URL ?? "http://localhost:3000");
    if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || !["http:", "https:"].includes(origin.protocol) || (env.NODE_ENV === "production" && origin.protocol !== "https:")) throw new Error();
  } catch { add("APP_URL", "expected_application_origin"); }
  return issues;
}
export class MailReadinessError extends Error {
  constructor(public stage: "configuration" | "smtp-connection", public reason: "configuration" | "authentication" | "connection" | "unknown", public issues: MailConfigurationIssue[] = []) {
    super(`Mail readiness failed at ${stage} (${reason}).`);
  }
}
// verify() negotiates the connection/TLS/authentication; it never submits an email.
export async function checkMailReadiness(connect = false) {
  const issues = mailConfigurationIssues();
  if (issues.length) throw new MailReadinessError("configuration", "configuration", issues);
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
