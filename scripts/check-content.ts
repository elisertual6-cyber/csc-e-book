import { readFileSync } from "node:fs";
import { validateBank, checkLesson } from "../src/lib/content-validation";
import { validateDraftPack } from "../src/lib/draft-pack";
import { draftLessons } from "../src/lib/lesson-catalog";
const bank = validateBank(
  JSON.parse(readFileSync("content/questions.json", "utf8")),
);
const pack = validateDraftPack(JSON.parse(readFileSync("content/editorial/numerical-foundations.json", "utf8")));
validateBank([...bank, ...pack.questions]);
for (const lesson of draftLessons) {
  const markdown = readFileSync(`content/lessons/${lesson.slug}.md`, "utf8");
  checkLesson(markdown);
  if (!markdown.startsWith(`# ${lesson.title}\n`) || !markdown.includes("Draft editorial")) throw new Error("Lesson catalog/title or draft label mismatch.");
}
console.log(
  `Validated ${draftLessons.length} public draft lessons and ${bank.length + pack.questions.length} draft question records (${bank.length} seed, ${pack.questions.length} awaiting manual editorial import). Independent human review pending; commercial launch requires at least 500 reviewed questions.`,
);
