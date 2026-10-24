import { X509Certificate } from "node:crypto";
import { rootCertificates } from "node:tls";
import type { ClientConfig } from "pg";

// Construct explicit pg fields: connection-string SSL options cannot override the verified TLS object.
export function recoverySourceConfiguration(value: string, extraCa = "") {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password || !url.pathname.slice(1)) throw new Error("Invalid recovery source configuration.");
  const password = decodeURIComponent(url.password);
  if (/[\r\n\0]/.test(password)) throw new Error("Unsupported source password format.");
  if (extraCa.length > 128 * 1024) throw new Error("CA bundle too large.");
  const certificates = extraCa.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
  if (extraCa.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, "").trim() || (extraCa.trim() && !certificates.length)) throw new Error("Only PEM CA certificates are accepted.");
  for (const pem of certificates) if (!new X509Certificate(pem).ca) throw new Error("A CA certificate is required.");
  const disableLocal = ["localhost", "127.0.0.1"].includes(url.hostname) && url.searchParams.get("sslmode") === "disable";
  const ca = [...rootCertificates, ...certificates].join("\n");
  const connection: ClientConfig = {
    host: url.hostname, port: Number(url.port || 5432), user: decodeURIComponent(url.username), password,
    database: decodeURIComponent(url.pathname.slice(1)), ssl: disableLocal ? false : { rejectUnauthorized: true, ca },
    connectionTimeoutMillis: 15_000, query_timeout: 120_000,
  };
  return { connection, ca, sslmode: disableLocal ? "disable" : "verify-full" } as const;
}
