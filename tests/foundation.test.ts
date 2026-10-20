import { describe, it, expect } from "vitest";
import { chaptersFor, curriculum } from "../src/lib/curriculum";
import { getCatalog, formatPHP } from "../src/lib/catalog";
import { checkLesson, validateBank } from "../src/lib/content-validation";
import questions from "../content/questions.json";
describe("curriculum tracks", () => {
  it("keeps common subjects and each specialized track", () => {
    expect(curriculum).toHaveLength(25);
    expect(new Set(curriculum.map((c) => c.slug)).size).toBe(25);
    expect(chaptersFor("PROFESSIONAL").some((c) => c.slug === "logic")).toBe(
      true,
    );
    expect(chaptersFor("PROFESSIONAL").some((c) => c.slug === "filing")).toBe(
      false,
    );
    expect(
      chaptersFor("SUBPROFESSIONAL").some((c) => c.slug === "filing"),
    ).toBe(true);
    expect(chaptersFor("SUBPROFESSIONAL").some((c) => c.slug === "logic")).toBe(
      false,
    );
    for (const track of ["PROFESSIONAL", "SUBPROFESSIONAL"] as const)
      expect(chaptersFor(track).some((c) => c.slug === "filipino")).toBe(true);
  });
});
describe("configurable catalog", () => {
  it("uses PHP minor units without rounding drift", () => {
    expect(getCatalog({ PRICE_BASIC_PHP: "129.50" })[0].priceMinor).toBe(12950);
    expect(formatPHP(12950)).toContain("129.50");
  });
  it("rejects negative, nonfinite and sub-cent prices", () => {
    for (const price of ["-1", "NaN", "Infinity", "1.234", ""])
      expect(() => getCatalog({ PRICE_BASIC_PHP: price })).toThrow();
  });
});
describe("editorial integrity", () => {
  it("accepts the original draft fixture", () =>
    expect(validateBank(questions)).toHaveLength(1));
  it("rejects normalized duplicates", () =>
    expect(() =>
      validateBank([
        questions[0],
        {
          ...questions[0],
          key: "different",
          prompt: questions[0].prompt.toUpperCase(),
        },
      ]),
    ).toThrow("Duplicate"));
  it("rejects ambiguous answer keys", () =>
    expect(() =>
      validateBank([
        {
          ...questions[0],
          choices: questions[0].choices.map((c) => ({ ...c, isCorrect: true })),
        },
      ]),
    ).toThrow());
  it("rejects duplicate options and absent explanations", () => {
    expect(() =>
      validateBank([
        { ...questions[0], choices: Array(4).fill(questions[0].choices[0]) },
      ]),
    ).toThrow();
    expect(() =>
      validateBank([{ ...questions[0], explanation: "" }]),
    ).toThrow();
  });
  it("rejects incomplete lessons", () =>
    expect(() => checkLesson("# Just a title")).toThrow(
      "Missing lesson section",
    ));
});
