// Fixed diagnostic categories only. Never return error messages, server details or arbitrary codes.
export type RecoveryFailureReason = "tls_certificate" | "database_authentication" | "database_permission" | "network" | "database_unavailable" | "schema_missing" | "snapshot_unsupported" | "tool_unavailable" | "unknown";
export function recoveryFailureReason(error: unknown): RecoveryFailureReason {
  const pending: unknown[] = [error], seen = new Set<unknown>();
  for (let inspected = 0; pending.length && inspected < 16; inspected++) {
    const item = pending.shift();
    if (!item || typeof item !== "object" || seen.has(item)) continue;
    seen.add(item);
    const record = item as { code?: unknown; cause?: unknown; errors?: unknown };
    const code = typeof record.code === "string" ? record.code : "";
    if (["SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID", "ERR_TLS_CERT_ALTNAME_INVALID"].includes(code)) return "tls_certificate";
    if (["28P01", "28000"].includes(code)) return "database_authentication";
    if (code === "42501") return "database_permission";
    if (["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH", "ETIMEDOUT"].includes(code)) return "network";
    if (["57P01", "57P02", "57P03", "53300"].includes(code)) return "database_unavailable";
    if (code === "42P01" || code === "3F000") return "schema_missing";
    if (code === "0A000") return "snapshot_unsupported";
    if (code === "ENOENT") return "tool_unavailable";
    if (record.cause) pending.push(record.cause);
    if (Array.isArray(record.errors)) pending.push(...record.errors.slice(0, 8));
  }
  return "unknown";
}
