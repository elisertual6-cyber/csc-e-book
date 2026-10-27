import { describe, expect, it } from "vitest";
import { loadPracticeSeries } from "../src/lib/series-manifest";
import { practiceSeriesKey, questionKeysForSet, validSeriesSettings } from "../src/lib/practice-series-policy";
import { practiceReviewDocuments } from "../src/lib/practice-review";
import numerical from "../content/validation/series-numerical-cases.json";
import references from "../content/references/practice-series-sources.json";
const sets = loadPracticeSeries();
const questions = sets.flatMap(set => set.questions);
type Case = { key: string; kind: string; [field: string]: unknown };
function number(value: unknown): number {
  const text = String(value), parts = text.split("/");
  return parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : Number(text);
}
function numericAnswer(text: string) {
  const match = text.match(/^(-?\d+(?:\.\d+)?)(?:\/(\d+))?/);
  if (!match) throw new Error("Expected a numerical option.");
  return Number(match[1]) / Number(match[2] ?? 1);
}
// Small arithmetic parser: data can contain only numbers, parentheses and the
// five operators. No evaluation of JS, names, calls or third-party code.
function evaluate(expression: string) {
  const tokens = expression.match(/\d+(?:\.\d+)?|\*\*|[()+\-*/]/g) ?? [];
  if (tokens.join("") !== expression.replaceAll(" ", "")) throw new Error("Unexpected expression.");
  let index = 0;
  const atom = (): number => {
    const token = tokens[index++];
    if (token === "(") { const value = sum(); if (tokens[index++] !== ")") throw new Error(); return value; }
    if (!/^\d/.test(token ?? "")) throw new Error();
    return Number(token);
  };
  const power = (): number => { const value = atom(); return tokens[index] === "**" ? (index++, value ** power()) : value; };
  const product = (): number => {
    let value = power();
    while (tokens[index] === "*" || tokens[index] === "/") { const operator = tokens[index++], right = power(); value = operator === "*" ? value * right : value / right; }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[index] === "+" || tokens[index] === "-") { const operator = tokens[index++], right = product(); value = operator === "+" ? value + right : value - right; }
    return value;
  };
  const value = sum(); if (index !== tokens.length) throw new Error(); return value;
}
describe("five fixed practice sets", () => {
  it("contains 800 unique keyed questions, 160 per set and one proposed answer per item", () => {
    expect(sets).toHaveLength(5); expect(questions).toHaveLength(800);
    expect(new Set(questions.map(q => q.key)).size).toBe(800);
    for (const set of sets) {
      expect(set.questions.map(q => q.key)).toEqual(questionKeysForSet(set.position));
      expect(set.questions).toHaveLength(160);
      expect(new Set(set.questions.map(q => q.topic)).size).toBe(20);
      for (const q of set.questions) {
        expect(q.status).toBe("DRAFT"); expect(q.choices.filter(c => c.isCorrect)).toHaveLength(1);
        expect(q.explanation.length).toBeGreaterThan(20);
      }
      const documents = practiceReviewDocuments(set.questions, set.title);
      expect((documents.questions.match(/^## \d+\./gm) ?? [])).toHaveLength(160);
      expect((documents.answers.match(/^## \d+\./gm) ?? [])).toHaveLength(160);
    }
  });
  it("records actually consulted online sources while keeping primary-source limitations explicit", () => {
    expect(references.sources.map(source => source.id)).toEqual(["CSC-SOURCE-1", "CSC-SOURCE-2", "CSC-SOURCE-3"]);
    expect(references.sources[1].url).toContain("openstax");
    for (const set of sets.slice(1)) for (const q of set.questions) {
      expect(q.sourceNotes).toMatch(/CSC-SOURCE-[13]/);
      if (["arithmetic", "fractions", "ratios", "sequences", "word-problems", "data"].includes(q.topic)) expect(q.sourceNotes).toContain("CSC-SOURCE-2");
      expect(q.sourceNotes).toContain("Independent human correctness/originality review pending");
    }
    expect(references.blockedPrimarySources).toContain("https://www.csc.gov.ph");
  });
  it("rejects partial, duplicate, timed, paid or misnumbered fixed-set settings", () => {
    const good = { seriesKey: practiceSeriesKey, setPosition: 1, questionKeys: questionKeysForSet(1), level: "COMMON", mode: "PRACTICE", access: "FREE", durationSeconds: 0, questionCount: 160 };
    expect(validSeriesSettings(good)).toBe(true);
    for (const changes of [{ setPosition: 0 }, { setPosition: 6 }, { questionKeys: good.questionKeys.slice(1) }, { questionKeys: Array(160).fill("same") }, { durationSeconds: 60 }, { access: "PREMIUM" }, { level: "PROFESSIONAL" }, { questionCount: 1 }, { seriesKey: "other" }])
      expect(validSeriesSettings({ ...good, ...changes })).toBe(false);
  });
  it("independently checks the 192 additional numerical/data answers using equations and inverse checks", () => {
    expect(numerical).toHaveLength(192);
    for (const c of numerical as Case[]) {
      const q = questions.find(q => q.key === c.key)!;
      expect(q, c.key).toBeDefined();
      const answer = q.choices.find(choice => choice.isCorrect)!.text;
      const n = (field: string) => number(c[field]);
      const list = (field: string) => (c[field] as unknown[]).map(number);
      const near = (actual: number, expected: number) => expect(actual, c.key).toBeCloseTo(expected, 6);
      if (c.kind === "clock") {
        const [hours, minutes] = answer.split(":").map(Number); near(hours * 60 + minutes - n("duration"), n("start")); continue;
      }
      if (c.kind === "compare_rates") {
        expect(answer.startsWith("A has the higher rate"), c.key).toBe(true);
        expect(n("a") * n("bt")).toBeGreaterThan(n("b") * n("at")); continue;
      }
      if (c.kind === "error_rate") {
        expect(answer).toContain("P has a lower rate: 2%");
        const [a, b] = list("errors"), [at, bt] = list("entries"); near(a / at, 0.02); near(b / bt, 0.03); continue;
      }
      if (c.kind === "observed_change") { expect(answer).toContain(`rose by ${n("after") - n("before")}`); continue; }
      const value = numericAnswer(answer), values = c.values ? list("values") : [];
      switch (c.kind) {
        case "expression": near(value, evaluate(String(c.expression))); break;
        case "sum_difference": near(value + values[2], values[0] + values[1]); break;
        case "product": near(value / values[0], values[1]); break;
        case "quotient": near(value * values[1], values[0]); break;
        case "fraction_difference": near(value + values[1], values[0]); break;
        case "stock": near(value + n("used"), n("boxes") * n("each")); break;
        case "balance": near(value + n("payments") * n("price") - n("start"), n("receipt")); break;
        case "fraction_of": near(value / n("whole"), n("num") / n("den")); break;
        case "decimal_fraction": near(value, n("decimal")); break;
        case "fraction_sum": near(value - values[0], values[1]); break;
        case "discount": near(1 - value / n("original"), n("rate") / 100); break;
        case "percent_change": near(n("before") * (1 + value / 100), n("after")); break;
        case "reverse_discount": near(value * (1 - n("rate") / 100), n("paid")); break;
        case "complement": near(value + n("part"), 1); break;
        case "share": near(n("total") * value / 100, n("selected")); break;
        case "ratio_parts": near(value / n("b"), n("total") / (n("a") + n("b"))); break;
        case "map": near(value * 100000 / n("scale"), n("cm")); break;
        case "missing_mean": near((n("subtotal") + value) / n("count"), n("mean")); break;
        case "weighted_mean": { const [a, b] = list("counts"), [x, y] = list("prices"); near(value * (a + b), a * x + b * y); break; }
        case "inverse_work": near(value * n("new"), n("workers") * n("days")); break;
        case "ratio_reduce": near(value * n("b"), n("a")); break;
        case "recipe": near(value / n("target"), n("cups") / n("servings")); break;
        case "chain_ratio": near(value * n("c"), n("a")); break;
        case "arithmetic_next": near(value - list("terms").at(-1)!, n("difference")); break;
        case "geometric_next": near(value / list("terms").at(-1)!, n("ratio")); break;
        case "nth_square": near(value - n("const"), n("n") ** 2); break;
        case "alternating": near(value, n("start") + 3 * n("up") - 2 * n("down")); break;
        case "fibonacci": { const terms = list("first"); while (terms.length < 6) terms.push(terms.at(-1)! + terms.at(-2)!); near(value, terms[5]); break; }
        case "arithmetic_nth": near((value - n("first")) / n("difference") + 1, n("n")); break;
        case "sequence_sum": near(value, Array.from({ length: n("n") }, (_, i) => (i + 1) * n("step")).reduce((a, b) => a + b, 0)); break;
        case "power_nth": near(value, n("base") ** n("n")); break;
        case "speed": near(value * n("minutes") / 60, n("distance")); break;
        case "joint_rate": near(value * list("times").reduce((total, time) => total + 1 / time, 0), 1); break;
        case "purchase": near(value * n("pens") + n("books") * n("book"), n("total")); break;
        case "rectangle": near(2 * (n("length") + value / n("length")), n("perimeter")); break;
        case "simple_interest": near(value / n("principal") / n("years") * 100, n("rate")); break;
        case "tank": near(value * (n("inflow") - n("drain")), n("target")); break;
        case "age": near(value * (n("factor") + 1), n("total")); break;
        case "data_total": near(value, values.reduce((a, b) => a + b, 0)); break;
        case "attendance": near(n("invited") * value / 100, n("attended")); break;
        case "data_mean": near(value * values.length, values.reduce((a, b) => a + b, 0)); break;
        case "median": near(value, [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]); break;
        case "inclusion_exclusion": near(value + n("both") - n("neither"), n("a") + n("b")); break;
        default: throw new Error(`Missing numerical verification kind: ${c.kind}`);
      }
    }
  });
});
