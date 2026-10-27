// Node operator/test manifest only. Never import these banks in public/client code.
import { readFileSync } from "node:fs";
import { validateDraftPack } from "./draft-pack";
import { validateBank } from "./content-validation";
import { editorialPacks } from "./editorial-packs";
export const seriesPacks = [
  ["practice-core", "practice-extended"],
  ["series-2-core", "series-2-extended"],
  ["series-3-core", "series-3-extended"],
  ["series-4-core", "series-4-extended"],
  ["series-5-core", "series-5-extended"],
] as const;
export function loadPracticeSeries() {
  const sets = seriesPacks.map((names, index) => ({
    position: index + 1, title: `Practice Set ${index + 1}`,
    questions: names.flatMap(name => validateDraftPack(JSON.parse(readFileSync(`content/editorial/${editorialPacks[name].file}`, "utf8"))).questions),
  }));
  if (sets.some(set => set.questions.length !== 160)) throw new Error("Every set requires 160 questions.");
  validateBank(sets.flatMap(set => set.questions));
  return sets;
}
