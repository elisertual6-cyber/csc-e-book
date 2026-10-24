import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { canonical, openRecoveryBundle, recoveryHash, recoveryTables, sealRecoveryBundle, validateRecoveryBundle } from "../src/lib/recovery-bundle";
function fixture() {
  const name = "12345678-1234-1234-1234-123456789abc.pdf";
  const pdf = Buffer.from("%PDF-private-recovery-fixture");
  const dump = Buffer.from("synthetic-pg-dump");
  return { version: 1, createdAt: new Date().toISOString(), revision: "a".repeat(40),
    counts: Object.fromEntries(recoveryTables.map(t => [t, t === "PdfEdition" ? 1 : 0])),
    dump: { base64: dump.toString("base64"), sha256: recoveryHash(dump) },
    files: [{ name, base64: pdf.toString("base64"), sha256: recoveryHash(pdf) }],
    editions: [{ id: "synthetic", creatorId: "synthetic-author", title: "Synthetic proof", version: "proof-1", kind: "DRAFT", filename: `supabase:${name}`, sha256: recoveryHash(pdf), manifest: { lessons: [], questions: [] }, createdAt: new Date().toISOString(), publishedAt: null }],
  };
}
describe("encrypted recovery archive", () => {
  it("authenticates and restores database/PDF records and hides plaintext", () => {
    const data = fixture(), key = randomBytes(32).toString("hex");
    const archive = sealRecoveryBundle(data, key);
    expect(archive.includes(Buffer.from("Synthetic proof"))).toBe(false);
    expect(openRecoveryBundle(archive, key)).toEqual(data);
    expect(sealRecoveryBundle(data, key).equals(archive)).toBe(false);
  });
  it("rejects wrong keys, tampering, truncation and invalid key formats", () => {
    const key = randomBytes(32).toString("hex"), archive = sealRecoveryBundle(fixture(), key);
    expect(() => openRecoveryBundle(archive, randomBytes(32).toString("hex"))).toThrow();
    const changed = Buffer.from(archive); changed[changed.length - 25] ^= 1;
    expect(() => openRecoveryBundle(changed, key)).toThrow();
    expect(() => openRecoveryBundle(archive.subarray(0, -1), key)).toThrow();
    expect(() => sealRecoveryBundle(fixture(), "short-key")).toThrow();
  });
  it.each(["missing-file", "wrong-hash", "unsafe-name", "duplicate-file", "duplicate-edition", "invalid-base64", "missing-table", "wrong-count"])("rejects inconsistent archives: %s", (issue) => {
    const data = fixture();
    if (issue === "missing-file") data.files = [];
    if (issue === "wrong-hash") data.editions[0].sha256 = "b".repeat(64);
    if (issue === "unsafe-name") data.files[0].name = "../public.pdf";
    if (issue === "duplicate-file") data.files.push(data.files[0]);
    if (issue === "duplicate-edition") data.editions.push(data.editions[0]);
    if (issue === "invalid-base64") data.dump.base64 += "!";
    if (issue === "missing-table") delete data.counts.User;
    if (issue === "wrong-count") data.counts.PdfEdition = 2;
    expect(() => validateRecoveryBundle(data)).toThrow();
  });
  it("compares database JSON independently of object key order", () => {
    expect(canonical({ b: [2, { y: false, x: 1 }], a: "test" })).toBe(canonical({ a: "test", b: [2, { x: 1, y: false }] }));
  });
});
