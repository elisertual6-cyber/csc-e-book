import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { validateDraftPack } from "../src/lib/draft-pack";
import { validateBank } from "../src/lib/content-validation";
import { editorialPacks } from "../src/lib/editorial-packs";
import { practiceReviewDocuments } from "../src/lib/practice-review";
async function main() {
  if (process.argv.length !== 2) throw new Error("No arbitrary pack paths are accepted.");
  process.umask(0o077);
  const questions = ["practice-core", "practice-extended"].flatMap(name => {
    const pack = editorialPacks[name as "practice-core" | "practice-extended"];
    return validateDraftPack(JSON.parse(readFileSync(`content/editorial/${pack.file}`, "utf8"))).questions;
  });
  validateBank(questions);
  if (questions.length !== 160) throw new Error("Expected the complete 160-question expansion.");
  const documents = practiceReviewDocuments(questions);
  const directory = path.resolve(".local/editorial", `practice-160-${randomUUID()}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(path.join(directory, "questions.md"), documents.questions, { mode: 0o600, flag: "wx" });
  await writeFile(path.join(directory, "answer-key.md"), documents.answers, { mode: 0o600, flag: "wx" });
  await writeFile(path.join(directory, "answer-key.csv"), documents.csv, { mode: 0o600, flag: "wx" });
  console.log(`Prepared 160 questions and proposed answers in ${directory}. No database writes, reviews or publications were performed.`);
}
void main().catch(() => { console.error("Practice review export failed; check the validated fixed manifests."); process.exitCode = 1; });
