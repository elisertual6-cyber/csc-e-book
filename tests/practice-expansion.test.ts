import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import core from "../content/editorial/practice-core.json";
import extended from "../content/editorial/practice-extended.json";
import seed from "../content/questions.json";
import { validateDraftPack } from "../src/lib/draft-pack";
import { validateBank } from "../src/lib/content-validation";
import { editorialPacks } from "../src/lib/editorial-packs";
import { curriculum } from "../src/lib/curriculum";
import { practiceReviewDocuments } from "../src/lib/practice-review";
const questions = [...validateDraftPack(core).questions, ...validateDraftPack(extended).questions];
const answer = (key: string) => questions.find(q => q.key === key)?.choices.find(c => c.isCorrect)?.text;
const byTopic = (topic: string) => questions.filter(q => q.topic === topic).map(q => q.choices.find(c => c.isCorrect)?.text);
describe("160-question original draft expansion", () => {
  it("adds 160 unique keyed items while preserving all previous draft packs", () => {
    expect(core.questions).toHaveLength(80); expect(extended.questions).toHaveLength(80);
    const all = Object.values(editorialPacks).flatMap(pack => validateDraftPack(JSON.parse(readFileSync(`content/editorial/${pack.file}`, "utf8"))).questions);
    expect(validateBank([...seed, ...all])).toHaveLength(871);
    expect(new Set(questions.map(q => q.topic)).size).toBe(20);
    for (const q of questions) {
      expect(q.status).toBe("DRAFT");
      expect(q.choices.filter(c => c.isCorrect)).toHaveLength(1);
      expect(q.level).toBe(curriculum.find(c => c.slug === q.topic)?.track);
      expect(q.sourceNotes).toContain("Independent human correctness/originality review pending");
    }
    expect(questions.filter(q => q.level === "COMMON")).toHaveLength(120);
    expect(questions.filter(q => q.level === "PROFESSIONAL")).toHaveLength(24);
    expect(questions.filter(q => q.level === "SUBPROFESSIONAL")).toHaveLength(16);
  });
  it("recalculates 48 numerical/data keys independently of the explanations", () => {
    expect(byTopic("arithmetic")).toEqual([
      String(31 - 4 * 6 + 18 / 3), String((42 - 18) / 6 + 3 ** 2), `${(7.5 + 2.8 - 4.65).toFixed(2)} m`,
      String(2.4 * 0.35), `${96 / 1.2} containers`, `${5 * 2 - 3}/12`, `${24 * 18 - 57} envelopes`, `₱${1250 - 3 * 175 + 240}`,
    ]);
    expect(byTopic("fractions")).toEqual([
      `${150 * 3 / 5} folders`, `${375 / 125}/${1000 / 125}`, `${2 * 4 + 5}/12`, `₱${240 * 0.85}`,
      `${(80 - 64) / 64 * 100}%`, `₱${(800 / 0.8).toLocaleString("en-PH")}`, `${8 - 3}/8`, `${350 / 1400 * 100}%`,
    ]);
    expect(byTopic("ratios")).toEqual([
      `${96 / 8 * 5} folders`, `${3.2 * 50000 / 100000} km`, String(6 * 72 - 355), `₱${(12 * 50 + 8 * 80) / 20}`,
      `${10 * 12 / 15} days`, `${42 / 14}:${56 / 14}`, `${2.5 / 6 * 15} cups`, `${4 * 2}:${7 * 2}:${3 * 7}`,
    ]);
    expect(byTopic("sequences")).toEqual([
      String(18 + 4), String(54 * 3), String(24 + 11), String(16 + 5), String(5 ** 2 + 1), String(11 + 18), String(9 + 9 * 7), `₱${4 + 8 + 12 + 16 + 20}`,
    ]);
    expect(byTopic("word-problems")).toEqual([
      `${72 / (45 / 60)} km/h`, `${Number((1 / (1 / 8 + 1 / 12)).toFixed(1))} hours`, `₱${(142 - 2 * 35) / 3}`, `${18 * (54 / 2 - 18)} cm²`,
      `₱${2500 * 0.06 * 2}`, `${45 / (9 - 3)} minutes`, `${Math.floor((9 * 60 + 35 + 108) / 60)}:${(9 * 60 + 35 + 108) % 60}`, `${48 / 4} years`,
    ]);
    expect(byTopic("data").slice(0, 3)).toEqual([`${48 + 36 + 60} requests`, `${24 / 32 * 100}%`, `${(80 + 100 + 120 + 100) / 4} reports`]);
    expect(answer("practice160-data-04")).toBe(`North: ${45 / 60 * 100}%; South: ${70 / 100 * 100}%; North has the higher rate.`);
    expect(answer("practice160-data-05")).toBe(`${[6, 9, 11, 14, 20].sort((a, b) => a - b)[2]} minutes`);
    expect(answer("practice160-data-06")).toBe(`${18 + 14 - 6 + 4} people`);
    expect(answer("practice160-data-07")).toBe(`A has the lower error rate: ${12 / 600 * 100}% versus ${9 / 300 * 100}%.`);
    expect(answer("practice160-data-08")).toBe(`Recorded visits rose by ${45 - 30}; the figures alone do not establish why.`);
  });
  it("independently checks filing orders, exact copies and the conditional contraposition", () => {
    expect(answer("practice160-filing-01")).toBe(["Ramos", "Reyes", "Rivera", "Ruiz"].sort()[0]);
    expect(answer("practice160-filing-02")).toBe(["Tao", "Tanto", "Tan", "Tang"].sort().join(", "));
    expect(answer("practice160-filing-03")).toBe(["R-004", "R-12", "R-030", "R-9"].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2))).at(-1));
    expect(answer("practice160-filing-04")).toBe(["B-3", "A-10", "B-1", "A-2"].sort((a, b) => a[0].localeCompare(b[0]) || Number(a.slice(2)) - Number(b.slice(2))).join(", "));
    expect(answer("practice160-filing-05")).toBe(["2026-11-02", "2026-02-19", "2026-02-09"].sort().join(", "));
    expect(answer("practice160-filing-06")).toBe(["Delos", "Dizon", "De Leon", "Diaz"].sort((a, b) => a.replaceAll(" ", "").toLowerCase().localeCompare(b.replaceAll(" ", "").toLowerCase()))[0]);
    expect(answer("practice160-filing-07")).toBe(`C-${[7, 19, 21, 103].find(n => n > 19)}`);
    expect(answer("practice160-filing-08")).toBe(["Dela, Ben", "Cruz, Ben", "Dela, Ada", "Cruz, Ana"].sort()[0]);
    expect(answer("practice160-spelling-07")).toBe("AB-5071-Q");
    expect(answer("practice160-spelling-08")).toBe("TX/0084/26");
    const allowed = [false, true].flatMap(urgent => [false, true].map(red => ({ urgent, red }))).filter(x => (!x.urgent || x.red) && !x.red);
    expect(allowed.length).toBeGreaterThan(0); expect(allowed.every(x => !x.urgent)).toBe(true);
    expect(answer("practice160-logic-01")).toBe("K is not urgent.");
  });
  it("exports a separate question booklet and a matching key for every item", () => {
    const docs = practiceReviewDocuments(questions);
    expect((docs.questions.match(/^## \d+\./gm) ?? [])).toHaveLength(160);
    expect((docs.answers.match(/^## \d+\./gm) ?? [])).toHaveLength(160);
    questions.forEach((q, index) => {
      const key = q.choices.find(c => c.isCorrect)!;
      expect(docs.questions).toContain(q.prompt);
      expect(docs.answers).toContain(`## ${index + 1}. ${key.label} — ${key.text}`);
      expect(docs.answers).toContain(q.explanation);
      expect(docs.csv).toContain(`"${q.key}"`);
    });
    expect(docs.questions).not.toContain(questions[0].explanation);
  });
});
