import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkBuildTraces } from "../scripts/check-build-traces.mjs";
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture(files: string[]) {
  const root = mkdtempSync(path.join(tmpdir(), "csc-trace-check-"));
  roots.push(root);
  mkdirSync(path.join(root, ".next/server/app"), { recursive: true });
  writeFileSync(path.join(root, ".next/server/app/page.js"), "runtime");
  writeFileSync(path.join(root, ".next/server/app/page.js.nft.json"), JSON.stringify({ version: 1, files }));
  return root;
}
describe("deployable production trace files", () => {
  it("accepts existing runtime files without requiring a live build lock", () => {
    expect(checkBuildTraces(fixture(["./page.js"]))).toEqual({ manifests: 1, files: 1 });
  });
  it("catches the deleted build lock referenced by the failed Vercel deployment", () => {
    expect(() => checkBuildTraces(fixture(["../../lock"]))).toThrow("1 temporary artifact reference(s), 1 missing file reference(s)");
  });
  it("rejects existing development/cache files and missing runtime files", () => {
    const root = fixture(["../../cache/artifact", "./missing.js"]);
    mkdirSync(path.join(root, ".next/cache"));
    writeFileSync(path.join(root, ".next/cache/artifact"), "not a runtime dependency");
    expect(() => checkBuildTraces(root)).toThrow("1 temporary artifact reference(s), 1 missing file reference(s)");
  });
});
