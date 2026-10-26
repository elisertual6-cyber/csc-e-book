import { describe, expect, it } from "vitest";
import { draftLessons } from "../src/lib/lesson-catalog";
import { buildStudyPlan, newPlanner, planDate, readSavedPlanner, sessionBudget, validStartDate } from "../src/lib/study-plan";

describe("personal study planner", () => {
  it("covers each eligible draft while excluding the other track and reserving review/rest days", () => {
    for (const track of ["PROFESSIONAL", "SUBPROFESSIONAL"] as const) {
      const days = buildStudyPlan(track);
      expect(days.map(d => d.day)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
      const eligible = draftLessons.filter(l => l.track === "COMMON" || l.track === track);
      const covered = new Set(days.filter(d => d.kind === "lesson").flatMap(d => d.lessons.map(l => l.slug)));
      expect(covered).toEqual(new Set(eligible.map(l => l.slug)));
      expect(days.filter(d => d.kind === "lesson")).toHaveLength(16);
      expect(days.filter(d => d.kind === "lesson").every(d => d.lessons.length >= 1 && d.lessons.length <= 2)).toBe(true);
      expect(days.filter(d => d.kind === "lesson").flatMap(d => d.lessons).length).toBe(eligible.length);
      expect(days.filter(d => d.kind === "catch-up").map(d => d.day)).toEqual([7, 14, 21, 28]);
      expect(days.at(-1)?.kind).toBe("reflection");
      for (const day of days) expect(day.lessons.every(l => l.track === "COMMON" || l.track === track)).toBe(true);
    }
  });
  it("keeps each suggested session within the learner's selected time", () => {
    for (const minutes of [15, 30, 60] as const) {
      const budget = sessionBudget(minutes);
      expect(Object.values(budget).reduce((a, b) => a + b, 0)).toBe(minutes);
      expect(Object.values(budget).every(n => Number.isInteger(n) && n > 0)).toBe(true);
    }
  });
  it("adds calendar days without timezone or daylight-saving shifts", () => {
    expect(validStartDate("2027-02-29")).toBe(false);
    expect(validStartDate("2028-02-29")).toBe(true);
    expect(validStartDate("2027-04-31")).toBe(false);
    expect(planDate("2028-02-28", 3)).toBe("Mar 1, 2028");
    expect(planDate("2027-12-31", 2)).toBe("Jan 1, 2028");
    expect(planDate("", 1)).toBe("");
    expect(planDate("2027-01-01", 31)).toBe("");
  });
  it("accepts only supported saved settings and valid completion days", () => {
    const saved = newPlanner();
    saved.completed.PROFESSIONAL = [1, 1, 7];
    const parsed = readSavedPlanner(JSON.stringify({ ...saved, password: "must-never-be-restored" }));
    expect(parsed?.completed.PROFESSIONAL).toEqual([1, 7]);
    expect(parsed).not.toHaveProperty("password");
    for (const input of [null, "broken", "null", JSON.stringify({ ...saved, version: 2 }), JSON.stringify({ ...saved, track: "ADMIN" }), JSON.stringify({ ...saved, day: 0 }), JSON.stringify({ ...saved, minutes: 120 }), JSON.stringify({ ...saved, startDate: "2027-02-30" }), JSON.stringify({ ...saved, completed: { PROFESSIONAL: [31], SUBPROFESSIONAL: [] } })]) expect(readSavedPlanner(input)).toBeNull();
  });
});
