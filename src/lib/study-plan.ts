import { draftLessons } from "./lesson-catalog";

export type StudyTrack = "PROFESSIONAL" | "SUBPROFESSIONAL";
export type StudyMinutes = 15 | 30 | 60;
export const plannerStorageKey = "csc-study-planner-v1";
export type PlannerState = {
  version: 1;
  track: StudyTrack;
  minutes: StudyMinutes;
  startDate: string;
  day: number;
  completed: Record<StudyTrack, number[]>;
};
export const newPlanner = (): PlannerState => ({ version: 1, track: "PROFESSIONAL", minutes: 30, startDate: "", day: 1, completed: { PROFESSIONAL: [], SUBPROFESSIONAL: [] } });

export function validStartDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function planDate(startDate: string, day: number) {
  if (!validStartDate(startDate) || !Number.isInteger(day) || day < 1 || day > 30) return "";
  const date = new Date(`${startDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + day - 1);
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
export function readSavedPlanner(raw: string | null): PlannerState | null {
  if (!raw || raw.length > 5000) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !["PROFESSIONAL", "SUBPROFESSIONAL"].includes(value.track) || ![15, 30, 60].includes(value.minutes) || typeof value.startDate !== "string" || (value.startDate !== "" && !validStartDate(value.startDate)) || !Number.isInteger(value.day) || value.day < 1 || value.day > 30) return null;
    const completed = {} as PlannerState["completed"];
    for (const track of ["PROFESSIONAL", "SUBPROFESSIONAL"] as const) {
      const days = value.completed?.[track];
      if (!Array.isArray(days) || days.length > 30 || days.some(d => !Number.isInteger(d) || d < 1 || d > 30)) return null;
      completed[track] = [...new Set<number>(days)];
    }
    // Return only allowlisted settings, never arbitrary saved properties.
    return { version: 1, track: value.track, minutes: value.minutes, startDate: value.startDate, day: value.day, completed };
  } catch { return null; }
}
export function sessionBudget(minutes: StudyMinutes) {
  const start = Math.ceil(minutes / 6);
  const focus = Math.floor(minutes / 2);
  return { start, focus, check: minutes - start - focus };
}
export function buildStudyPlan(track: StudyTrack) {
  const lessons = draftLessons.filter(l => l.track === "COMMON" || l.track === track);
  // Preserve the 16 topic-session positions and rest/review days. Additional
  // drafts share later topic sessions rather than disappearing from the plan.
  const groups = Array.from({ length: 16 }, (_, slot) => [lessons[slot % lessons.length]]);
  const extra = lessons.slice(16);
  extra.forEach((lesson, index) => groups[(Math.max(0, 16 - extra.length) + index) % 16].push(lesson));
  return Array.from({ length: 30 }, (_, index) => {
    const day = index + 1;
    if (day === 29) return { day, kind: "review", title: "Return to your difficult topics", description: "Choose up to two lessons below. Explain the method on paper, then check the worked rationale and note what still needs help.", lessons };
    if (day === 30) return { day, kind: "reflection", title: "Reflect and plan your next steps", description: "Write what became clearer, what remains uncertain and which topics need more time. Choose a realistic next week; completing this plan does not establish exam readiness.", lessons: [] };
    const week = Math.floor(index / 7);
    const position = index % 7;
    const weekGroups = groups.slice(week * 4, week * 4 + 4);
    const weekLessons = weekGroups.flat();
    if (position < 4) {
      const selected = weekGroups[position];
      return { day, kind: "lesson", title: selected[0].title, description: selected.length > 1
        ? "This session includes two draft lessons. Try a small part of each, or spread the work over additional days. Keep time for checking the rationale; the suggested budget is not a requirement to finish both lessons."
        : "Read the draft explanation, try its paper practice before checking the rationale, and write one point to revisit. A repeated topic is another pass, not extra content.", lessons: selected };
    }
    if (position === 4) return { day, kind: "review", title: "Review this week's ideas", description: "Choose the parts of this week's lessons that need attention. Summarize the method in your own words and revisit one worked example.", lessons: weekLessons };
    if (position === 5) return { day, kind: "practice", title: "Practice and check your reasoning", description: "Redo selected paper exercises from this week's lessons before reading their rationales. Record mistakes on paper; this is ungraded self-checking.", lessons: weekLessons };
    return { day, kind: "catch-up", title: "Catch up or rest", description: "Rest, or use an optional short session to revisit an unfinished lesson. Move at your own pace; a missed day is not a failed exam.", lessons: [] };
  });
}
