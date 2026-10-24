import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import pack from "../content/editorial/numerical-foundations.json";
import seed from "../content/questions.json";
import english from "../content/editorial/english-foundations.json";
import { editorialPacks } from "../src/lib/editorial-packs";
import { questionImportRows, validateDraftPack } from "../src/lib/draft-pack";
import { checkLesson, validateBank } from "../src/lib/content-validation";
import { draftLessons, findDraftLesson } from "../src/lib/lesson-catalog";

describe("original draft teaching content", () => {
  it("keeps English drafts distinct across packs and resolves every allowlisted lesson", () => {
    const language = validateDraftPack(english);
    expect(language.questions).toHaveLength(15);
    expect(validateBank([...seed, ...pack.questions, ...language.questions])).toHaveLength(36);
    expect(new Set(language.questions.map(q => q.topic))).toEqual(new Set(["vocabulary", "grammar", "sentences"]));
    for (const question of language.questions) {
      expect(question.status).toBe("DRAFT");
      expect(question.sourceNotes).toContain("Independent human correctness/originality review pending");
    }
    const slugs = Object.values(editorialPacks).flatMap(p => [...p.lessons]);
    expect(new Set(slugs).size).toBe(8);
    expect(slugs.every(slug => findDraftLesson(slug))).toBe(true);
    expect(editorialPacks.numerical.lessons).toHaveLength(5);
    expect(editorialPacks.language.lessons).toHaveLength(3);
  });
  it("keeps the review pack distinct from seeded items and in draft state", () => {
    const result = validateDraftPack(pack);
    expect(result.questions).toHaveLength(20);
    expect(validateBank([...seed, ...result.questions])).toHaveLength(21);
    expect(new Set(result.questions.map(q => q.topic)).size).toBe(4);
    for (const question of result.questions) {
      expect(question.status).toBe("DRAFT");
      expect(question.sourceNotes).toContain("Independent human correctness/originality review pending");
    }
  });

  it("rejects claimed review/publication and duplicate items in review packs", () => {
    expect(() => validateDraftPack({ ...pack, status: "PUBLISHED" })).toThrow();
    expect(() => validateDraftPack({ ...pack, reviewStatus: "APPROVED" })).toThrow();
    expect(() => validateDraftPack({ ...pack, questions: [{ ...pack.questions[0], status: "APPROVED" }] })).toThrow();
    expect(() => validateDraftPack({ ...pack, questions: [pack.questions[0], pack.questions[0]] })).toThrow();
  });

  it("exports only editable inputs without lifecycle/version/approval claims", () => {
    const rows = questionImportRows(pack);
    expect(rows).toHaveLength(20);
    expect(Object.keys(rows[0]).sort()).toEqual(["key", "prompt", "topic", "level", "difficulty", "sourceNotes", "explanation", "choices"].sort());
    expect(rows[0].choices.filter(c => c.isCorrect)).toHaveLength(1);
  });

  it("checks all twenty numerical answer keys independently from their explanation text", () => {
    const results = [
      `${80 * 3 / 8} cards`, `${45 / 5}/${100 / 5}`, `₱${600 * (1 - 0.12)}`, `${(150 - 120) / 120 * 100}%`, `${1 * 5 + 2 * 4}/20`,
      `${72 / (5 + 3) * 5} cards`, `₱${120 / 8 * 6}`, `${(4 * 10 + 6 * 15) / 10} pages`, `${18 / 3 * 5} folders`, `${(7 * 12 - 18) / 6} minutes`,
      String(21 + 5), String(20 / 2), String(36 + 4), String(9 + (8 - 1) * 3), String(2 * 3 ** (5 - 1)),
      `${16 * 45 / 60} kilometres`, `${(160 - 25) / 3} pages`, `${1 / (1 / 6 + 1 / 3)} hours`, `₱${(150 - 15) / 3}`, `${18 / 3} minutes`,
    ];
    expect(pack.questions.map(q => q.choices.find(c => c.isCorrect)?.text)).toEqual(results);
  });

  it("keeps lesson files complete and addresses limited to the public catalog", () => {
    expect(draftLessons).toHaveLength(8);
    expect(new Set(draftLessons.map(l => l.slug)).size).toBe(draftLessons.length);
    for (const lesson of draftLessons) {
      const markdown = readFileSync(`content/lessons/${lesson.slug}.md`, "utf8");
      expect(markdown).toMatch(/^# /);
      expect(markdown).toContain("Draft editorial");
      expect(markdown).toContain("independent");
      checkLesson(markdown);
    }
    for (const slug of ["../questions", "fractions.md", "constructor", "FRACTIONS", "not-a-lesson"]) expect(findDraftLesson(slug)).toBeUndefined();
  });
});
