import { readFileSync, readdirSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { timedMockDefinitions } from "../src/lib/timed-mock-policy";

describe("timed mock source selections", () => {
  it("selects complete, track-matched existing questions with balanced topics", () => {
    const questions = readdirSync("content/editorial").filter(f => f.endsWith(".json")).flatMap(f => JSON.parse(readFileSync(`content/editorial/${f}`, "utf8")).questions ?? []) as { key: string; topic: string; level: string; choices: { isCorrect: boolean }[]; explanation: string }[];
    for (const definition of timedMockDefinitions) {
      expect(new Set(definition.questionKeys).size).toBe(160);
      const selected = definition.questionKeys.map(key => questions.find(q => q.key === key));
      expect(selected.every(q => !!q && ["COMMON", definition.level].includes(q.level))).toBe(true);
      for (const topic of definition.topics) expect(selected.filter(q => q?.topic === topic).length).toBeGreaterThanOrEqual(8);
      for (const q of selected) {
        expect(q?.choices).toHaveLength(4);
        expect(q?.choices.filter(c => c.isCorrect)).toHaveLength(1);
        expect(q?.explanation.length).toBeGreaterThan(10);
      }
    }
  });
});
