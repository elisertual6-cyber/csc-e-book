import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { questionImportRows } from "../src/lib/draft-pack";
async function main() {
  process.umask(0o077);
  const rows = questionImportRows(JSON.parse(readFileSync("content/editorial/numerical-foundations.json", "utf8")));
  const directory = path.resolve(".local/editorial");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, `numerical-foundations-${crypto.randomUUID()}.import.json`);
  await writeFile(file, JSON.stringify(rows, null, 2), { mode: 0o600, flag: "wx" });
  console.log(`Exported ${rows.length} draft question inputs to ${file}. No database changes or approvals were made.`);
}
main().catch(() => { console.error("Draft pack export failed; inspect source validation without exposing answer keys in logs."); process.exitCode = 1; });
