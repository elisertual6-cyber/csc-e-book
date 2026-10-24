import { afterEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ verify: vi.fn(), close: vi.fn(), create: vi.fn(), send: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: mocked.create } }));
import { checkMailReadiness, mailConfigurationIssues } from "../src/lib/mail-readiness";
function setup() {
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("MAIL_TRANSPORT", "smtp");
  vi.stubEnv("MAIL_ENCRYPTION_KEY", "a".repeat(64)); vi.stubEnv("APP_URL", "https://example.test");
  vi.stubEnv("SMTP_HOST", "smtp.gmail.com"); vi.stubEnv("SMTP_PORT", "465");
  vi.stubEnv("SMTP_USER", "sender@example.test"); vi.stubEnv("SMTP_PASSWORD", "fixture-private-credential");
  vi.stubEnv("MAIL_FROM", "sender@example.test"); vi.stubEnv("SMTP_ALLOW_INSECURE", "false");
  mocked.create.mockReturnValue({ verify: mocked.verify, close: mocked.close, sendMail: mocked.send });
}
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe("mail readiness without sending", () => {
  it("identifies invalid field names without exposing secret values or lengths", () => {
    const issues = mailConfigurationIssues({ NODE_ENV: "production", MAIL_TRANSPORT: "smtp", APP_URL: "https://example.test", SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "private-invalid-port", SMTP_USER: "private-address@example.test", SMTP_PASSWORD: "private-password", MAIL_FROM: "private-invalid-address", MAIL_ENCRYPTION_KEY: "private-invalid-key" });
    expect(issues).toEqual([
      { field: "MAIL_ENCRYPTION_KEY", problem: "expected_64_hex_characters" },
      { field: "SMTP_PORT", problem: "expected_valid_port" },
      { field: "MAIL_FROM", problem: "expected_plain_email_address" },
    ]);
    expect(JSON.stringify(issues)).not.toContain("private-");
  });
  it("reports the missing Gmail app-password field before connection", async () => {
    setup(); vi.stubEnv("SMTP_PASSWORD", "");
    await expect(checkMailReadiness(true)).rejects.toMatchObject({ issues: [{ field: "SMTP_PASSWORD", problem: "required" }] });
    expect(mocked.create).not.toHaveBeenCalled();
  });
  it("checks configuration offline without opening a transport or submitting mail", async () => {
    setup(); expect(await checkMailReadiness()).toMatchObject({ configuration: "ready", smtpConnection: "not_checked", delivery: "not_tested" });
    expect(mocked.create).not.toHaveBeenCalled(); expect(mocked.send).not.toHaveBeenCalled();
  });
  it("verifies SMTP with strict TLS, closes transport and never sends email", async () => {
    setup(); mocked.verify.mockResolvedValue(true);
    expect(await checkMailReadiness(true)).toMatchObject({ smtpConnection: "verified", delivery: "not_tested" });
    expect(mocked.create).toHaveBeenCalledWith(expect.objectContaining({ secure: true, requireTLS: true, debug: false, logger: false, tls: { minVersion: "TLSv1.2", rejectUnauthorized: true } }));
    expect(mocked.close).toHaveBeenCalledOnce(); expect(mocked.send).not.toHaveBeenCalled();
  });
  it.each(["EAUTH", "ESOCKET", "untrusted-private-value"])("redacts provider failures and closes transport: %s", async code => {
    setup(); mocked.verify.mockRejectedValue({ code, message: "fixture-private-credential", response: "private identity" });
    try { await checkMailReadiness(true); throw new Error("Expected verification failure"); }
    catch (error) {
      expect(error).toMatchObject({ stage: "smtp-connection", reason: code === "EAUTH" ? "authentication" : code === "ESOCKET" ? "connection" : "unknown" });
      expect(String(error)).not.toContain("fixture-private-credential"); expect(String(error)).not.toContain("private identity");
    }
    expect(mocked.close).toHaveBeenCalledOnce(); expect(mocked.send).not.toHaveBeenCalled();
  });
  it.each(["disabled", "missing-key", "insecure", "http-origin"])("rejects unsafe setup before any connection: %s", async issue => {
    setup();
    if (issue === "disabled") vi.stubEnv("MAIL_TRANSPORT", "disabled");
    if (issue === "missing-key") vi.stubEnv("MAIL_ENCRYPTION_KEY", "");
    if (issue === "insecure") vi.stubEnv("SMTP_ALLOW_INSECURE", "true");
    if (issue === "http-origin") vi.stubEnv("APP_URL", "http://example.test");
    await expect(checkMailReadiness(true)).rejects.toMatchObject({ stage: "configuration" });
    expect(mocked.create).not.toHaveBeenCalled();
  });
});
