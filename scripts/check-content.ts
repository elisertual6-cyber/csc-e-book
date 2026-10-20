import { readFileSync } from "node:fs";
import { validateBank, checkLesson } from "../src/lib/content-validation";
const bank = validateBank(
  JSON.parse(readFileSync("content/questions.json", "utf8")),
);
checkLesson(readFileSync("content/lessons/arithmetic.md", "utf8"));
console.log(
  `Validated ${bank.length} original draft question(s) and 1 draft lesson. Independent human review pending; commercial launch requires at least 500 reviewed questions.`,
);
