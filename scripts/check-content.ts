import { readFileSync } from "node:fs";
import { validateBank, checkLesson } from "../src/lib/content-validation";
import { validateDraftPack } from "../src/lib/draft-pack";
import { draftLessons } from "../src/lib/lesson-catalog";
import { editorialPacks } from "../src/lib/editorial-packs";
const bank = validateBank(
  JSON.parse(readFileSync("content/questions.json", "utf8")),
);
const questions = Object.values(editorialPacks).flatMap(pack => validateDraftPack(JSON.parse(readFileSync(`content/editorial/${pack.file}`, "utf8"))).questions);
validateBank([...bank, ...questions]);
for (const lesson of draftLessons) {
  const markdown = readFileSync(`content/lessons/${lesson.slug}.md`, "utf8");
  checkLesson(markdown);
  if (!markdown.startsWith(`# ${lesson.title}\n`) || !markdown.includes("Draft editorial")) throw new Error("Lesson catalog/title or draft label mismatch.");
}
console.log(
  `Validated ${draftLessons.length} public draft lessons and ${bank.length + questions.length} draft question records (${bank.length} seed, ${questions.length} in manual editorial packs). Independent human review pending; commercial launch requires at least 500 reviewed questions.`,
);
