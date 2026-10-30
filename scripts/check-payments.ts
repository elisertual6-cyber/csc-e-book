import "dotenv/config";
import { paymongoConfig } from "../src/lib/paymongo";
import { mailConfigurationIssues } from "../src/lib/mail-readiness";
// Configuration only: no gateway request, payment, database write or email submission.
const missing = ["PAYMENT_PROVIDER", "PAYMONGO_MODE", "GCASH_CHECKOUT_ENABLED", "PAYMONGO_SECRET_KEY", "PAYMONGO_WEBHOOK_SECRET", "APP_URL"].filter(field => !process.env[field]);
if (process.env.PAYMONGO_MODE === "live" && process.env.GCASH_LIVE_ENABLED !== "true") missing.push("GCASH_LIVE_ENABLED");
if (process.env.PURCHASE_MAIL_AUTOMATION !== "true") missing.push("PURCHASE_MAIL_AUTOMATION");
let configured = false;
try { paymongoConfig(); configured = true; } catch { /* Never print provider configuration or exception details. */ }
const mailIssues = mailConfigurationIssues();
const ready = configured && missing.length === 0 && mailIssues.length === 0;
console.log(JSON.stringify({ paymentSetup: ready ? "configuration_ready" : "configuration_incomplete", paymentConfiguration: configured ? "valid" : "invalid", missingFields: missing, mailIssues, providerConnection: "not_checked", merchantApproval: "not_checked", reviewerRelease: "not_checked", delivery: "not_tested" }));
if (!ready) process.exitCode = 1;
