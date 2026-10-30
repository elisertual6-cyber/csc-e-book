import { describe, expect, it } from "vitest";
import type { AttemptSummary } from "../src/lib/exam-types";
import { practiceTrend, trendGroups, trendGroupKey } from "../src/lib/practice-trends";
const row = (id: string, changes: Partial<AttemptSummary> = {}): AttemptSummary => ({ id, title: "Practice Set 1", level: "COMMON", mode: "PRACTICE", status: "SUBMITTED", startedAt: "2026-10-01T00:00:00Z", deadlineAt: null, score: 3, totalQuestions: 4, accessLocked: false, byTopic: [], ...changes });
describe("recent completed practice trends", () => {
  it("does not invent a result or change for empty and single-session histories", () => {
    expect(practiceTrend([])).toEqual({ points: [], first: null, latest: null, change: null });
    expect(practiceTrend([row("one", { score: 1, totalQuestions: 3 })])).toMatchObject({ first: 33.33, latest: 33.33, change: null });
  });
  it("excludes active, missing, invalid or impossible grades and includes valid expired sessions", () => {
    const input = [row("active", { status: "IN_PROGRESS" }), row("missing", { score: null }), row("zero-denominator", { totalQuestions: 0 }), row("negative", { score: -1 }), row("too-high", { score: 5 }), row("fractional", { score: 1.5 }), row("bad-total", { totalQuestions: Infinity }), row("expired", { status: "EXPIRED", score: 0 })];
    expect(practiceTrend(input).points.map(point => point.id)).toEqual(["expired"]);
  });
  it("uses the ten most recently finalized entries, reversed for the chart without mutating or sorting by start time", () => {
    const input = Array.from({ length: 12 }, (_, i) => row(`attempt-${i}`, { startedAt: i === 0 ? "2020-01-01T00:00:00Z" : "2026-01-01T00:00:00Z" }));
    const copy = structuredClone(input);
    expect(practiceTrend(input).points.map(point => point.id)).toEqual(Array.from({ length: 10 }, (_, i) => `attempt-${9 - i}`));
    expect(input).toEqual(copy);
  });
  it("groups by title, track, mode AND count, filtering before limiting so matching sessions are not lost", () => {
    const original = row("matching");
    const input = [row("retry", { title: "Focused practice: Practice Set 1" }), row("count", { totalQuestions: 10 }), row("track", { level: "PROFESSIONAL" }), row("mode", { mode: "MOCK" }), original, row("other-match", { accessLocked: true })];
    const groups = trendGroups(input);
    expect(groups).toHaveLength(5);
    expect(groups.at(-1)?.count).toBe(2);
    expect(practiceTrend(input, trendGroupKey(original)).points.map(point => point.id)).toEqual(["other-match", "matching"]);
    expect(practiceTrend(input, "unknown").points).toEqual([]);
  });
  it("reports percentage-point changes using the displayed percentages, including decreases and no change", () => {
    expect(practiceTrend([row("new", { score: 3 }), row("old", { score: 1 })])).toMatchObject({ first: 25, latest: 75, change: 50 });
    expect(practiceTrend([row("new", { score: 1 }), row("old", { score: 3 })]).change).toBe(-50);
    expect(practiceTrend([row("new"), row("old")]).change).toBe(0);
    expect(practiceTrend([row("new", { score: 2, totalQuestions: 3 }), row("old", { score: 1, totalQuestions: 3 })]).change).toBe(33.34);
  });
});
