import { describe, it, expect } from "vitest";
import { rootCertificates } from "node:tls";
import { recoverySourceConfiguration } from "../src/lib/recovery-source";
const url = "postgresql://operator:private%3Apassword@database.example.test:5432/postgres?sslmode=require&schema=public";
describe("verified recovery source TLS", () => {
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
