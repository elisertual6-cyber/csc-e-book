import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { loadPracticeSeries } from "../src/lib/series-manifest";
import { practiceReviewDocuments } from "../src/lib/practice-review";
async function main() {
  if (process.argv.length !== 2) throw new Error();
  process.umask(0o077);
  const root = path.resolve(".local/editorial", `five-sets-${randomUUID()}`);
  for (const set of loadPracticeSeries()) {
    const directory = path.join(root, `set-${set.position}`);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const documents = practiceReviewDocuments(set.questions, `${set.title} — 160 original draft questions`);
    for (const [name, text] of [["questions.md", documents.questions], ["answer-key.md", documents.answers], ["answer-key.csv", documents.csv]])
      await writeFile(path.join(directory, name), text, { mode: 0o600, flag: "wx" });
  }
  console.log(`Prepared five sets of 160 questions and separate proposed keys in ${root}. No database writes or releases occurred.`);
}
void main().catch(() => { console.error("Five-set export failed; inspect the fixed source manifests."); process.exitCode = 1; });
