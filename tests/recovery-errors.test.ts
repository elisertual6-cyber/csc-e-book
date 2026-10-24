import { describe, expect, it } from "vitest";
import { recoveryFailureReason } from "../src/lib/recovery-errors";
describe("safe recovery failure diagnostics", () => {
  it.each([
    ["SELF_SIGNED_CERT_IN_CHAIN", "tls_certificate"], ["ERR_TLS_CERT_ALTNAME_INVALID", "tls_certificate"],
    ["28P01", "database_authentication"], ["42501", "database_permission"], ["ENOTFOUND", "network"],
    ["53300", "database_unavailable"], ["42P01", "schema_missing"], ["0A000", "snapshot_unsupported"],
  ])("classifies %s without printing source details", (code, expected) => {
    expect(recoveryFailureReason({ code, message: "sensitive server details", detail: "private identity" })).toBe(expected);
  });
  it("classifies nested TLS causes and aggregate connection errors", () => {
    expect(recoveryFailureReason(new Error("private endpoint", { cause: { code: "CERT_HAS_EXPIRED" } }))).toBe("tls_certificate");
    expect(recoveryFailureReason(new AggregateError([{ code: "ECONNREFUSED" }], "private endpoint"))).toBe("network");
  });
  it("does not expose arbitrary codes, messages or cyclic/oversized error graphs", () => {
    const cycle: { code: string; cause?: unknown } = { code: "private-credential" }; cycle.cause = cycle;
    expect(recoveryFailureReason(cycle)).toBe("unknown");
    expect(recoveryFailureReason({ errors: Array(100).fill(cycle), message: "private connection string" })).toBe("unknown");
    expect(recoveryFailureReason("secret message")).toBe("unknown");
  });
});
