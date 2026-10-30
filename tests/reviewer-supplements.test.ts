import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { reviewerSupplements, findReviewerSupplement } from "../src/lib/reviewer-supplements";
import { reviewerGuides } from "../src/lib/reviewer-catalog";
import { checkLesson } from "../src/lib/content-validation";
describe("six supplementary teaching chapters", () => {
  it("gives every guide a labelled, complete public draft with two worked examples", () => {
    expect(reviewerSupplements.map(lesson => lesson.guide)).toEqual(reviewerGuides.map(guide => guide.slug));
    expect(new Set(reviewerSupplements.map(lesson => lesson.file)).size).toBe(6);
    for (const lesson of reviewerSupplements) {
      const markdown = readFileSync(`content/reviewer-lessons/${lesson.file}`, "utf8");
      expect(markdown.startsWith(`# ${lesson.title}\n`)).toBe(true);
      expect(markdown).toContain("Draft editorial supplement");
      expect(() => checkLesson(markdown)).not.toThrow();
      expect(markdown.match(/^### Example [12]:/gm)).toHaveLength(2);
      expect(markdown).not.toMatch(/<script|content\/editorial|series[2-5]-/);
    }
    expect(findReviewerSupplement("../../content/questions")).toBeUndefined();
  });
  it("independently checks the numerical results taught in the new examples", () => {
    const numerical = readFileSync("content/reviewer-lessons/numerical-steps.md", "utf8");
    expect(800 * (1 - 0.20) * (1 + 0.25)).toBe(800);
    expect(54 / (40 / 60)).toBe(81);
    const due = Math.round(1500 * 0.88 * 1.05);
    expect(due).toBe(1386); expect(numerical).toContain("1,386 units");
    expect(15 / 20).toBe(0.75); expect(12 / 15).toBe(0.80);
    expect((500 - 350) / 500).toBe(0.30);
    const study = readFileSync("content/reviewer-lessons/next-session.md", "utf8");
    const combined = (10 * 60 + 30 * 90) / 40;
    expect(combined).toBe(82.5); expect(study).toContain("**82.5**");
  });
});
