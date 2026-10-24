import { describe, it, expect } from "vitest";
import { rootCertificates } from "node:tls";
import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
import { recoverySourceConfiguration } from "../src/lib/recovery-source";
const url = "postgresql://operator:private%3Apassword@database.example.test:5432/postgres?sslmode=require&schema=public";
describe("verified recovery source TLS", () => {
  it("pins the operator-supplied public Supabase root certificate", () => {
    const pem = readFileSync(new URL("../.github/certs/supabase-root-2021.crt", import.meta.url), "utf8");
    const certificate = new X509Certificate(pem);
    expect(certificate.ca).toBe(true);
    expect(certificate.verify(certificate.publicKey)).toBe(true);
    expect(certificate.fingerprint256).toBe("80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA");
    expect(new Date(certificate.validTo).getTime()).toBeGreaterThan(Date.now());
    expect(pem).not.toContain("PRIVATE KEY");
    expect(recoverySourceConfiguration(url, pem).ca).toContain(pem.trim());
  });
  it("uses explicit verified pg fields and consistent libpq trust roots", () => {
    const config = recoverySourceConfiguration(url, rootCertificates[0]);
    expect(config.sslmode).toBe("verify-full");
    expect(config.connection).toMatchObject({ host: "database.example.test", port: 5432, user: "operator", password: "private:password", database: "postgres", ssl: { rejectUnauthorized: true, ca: config.ca } });
    expect(config.connection).not.toHaveProperty("connectionString");
    expect(config.ca).toContain(rootCertificates[0]);
  });
  it.each(["disable", "no-verify", "prefer", "verify-ca"])("preserves verification despite remote sslmode=%s", mode => {
    const config = recoverySourceConfiguration(url.replace("sslmode=require", `sslmode=${mode}`));
    expect(config.sslmode).toBe("verify-full");
    expect(config.connection.ssl).toMatchObject({ rejectUnauthorized: true });
  });
  it("allows plaintext only for explicitly configured local fixtures", () => {
    expect(recoverySourceConfiguration("postgresql://test:pass@127.0.0.1:5432/postgres?sslmode=disable").connection.ssl).toBe(false);
    expect(recoverySourceConfiguration("postgresql://test:pass@localhost:5432/postgres").connection.ssl).toMatchObject({ rejectUnauthorized: true });
  });
  it("rejects private keys, malformed or oversized CA input", () => {
    for (const pem of ["-----BEGIN PRIVATE KEY-----\nnever-accept\n-----END PRIVATE KEY-----", "not a certificate", "x".repeat(128 * 1024 + 1)]) expect(() => recoverySourceConfiguration(url, pem)).toThrow();
  });
});
