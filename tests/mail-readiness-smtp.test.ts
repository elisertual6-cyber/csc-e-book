import { afterEach, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { checkMailReadiness } from "../src/lib/mail-readiness";
import { localSmtp } from "../e2e/local-smtp";
afterEach(() => vi.unstubAllEnvs());
it("negotiates with a loopback SMTP receiver without delivering a message", async () => {
  const smtp = await localSmtp();
  try {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("MAIL_TRANSPORT", "smtp");
    vi.stubEnv("MAIL_ENCRYPTION_KEY", randomBytes(32).toString("hex"));
    vi.stubEnv("APP_URL", "http://127.0.0.1:3100"); vi.stubEnv("MAIL_FROM", "fixture@example.test");
    vi.stubEnv("SMTP_HOST", "127.0.0.1"); vi.stubEnv("SMTP_PORT", String(smtp.port));
    vi.stubEnv("SMTP_ALLOW_INSECURE", "true"); vi.stubEnv("SMTP_USER", ""); vi.stubEnv("SMTP_PASSWORD", "");
    expect(await checkMailReadiness(true)).toMatchObject({ smtpConnection: "verified", delivery: "not_tested" });
    expect(smtp.messages).toEqual([]);
  } finally { await smtp.close(); }
});
