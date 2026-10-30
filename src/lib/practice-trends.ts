import type { AttemptSummary } from "./exam-types";

// History supplies completed attempts newest-finalized first. Preserve that order:
// sorting by start time would misorder sessions resumed later.
export const trendGroupKey = (attempt: AttemptSummary) => JSON.stringify([attempt.title, attempt.level, attempt.mode, attempt.totalQuestions]);
export function validTrendAttempts(attempts: AttemptSummary[]) {
  return attempts.filter(attempt => (attempt.status === "SUBMITTED" || attempt.status === "EXPIRED") &&
    Number.isInteger(attempt.score) && attempt.score !== null && attempt.score >= 0 &&
    Number.isInteger(attempt.totalQuestions) && attempt.totalQuestions > 0 && attempt.score <= attempt.totalQuestions);
}
export function trendGroups(attempts: AttemptSummary[]) {
  const groups = new Map<string, { key: string; title: string; level: string; mode: string; totalQuestions: number; count: number }>();
  for (const attempt of validTrendAttempts(attempts)) {
    const key = trendGroupKey(attempt);
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { key, title: attempt.title, level: attempt.level, mode: attempt.mode, totalQuestions: attempt.totalQuestions, count: 1 });
  }
  return [...groups.values()];
}
export function practiceTrend(attempts: AttemptSummary[], group = "") {
  const points = validTrendAttempts(attempts).filter(attempt => !group || trendGroupKey(attempt) === group).slice(0, 10).reverse()
    .map(attempt => ({ ...attempt, percent: Math.round(attempt.score! / attempt.totalQuestions * 10000) / 100 }));
  const first = points[0]?.percent ?? null;
  const latest = points.at(-1)?.percent ?? null;
  return { points, first, latest, change: points.length < 2 ? null : Math.round((latest! - first!) * 100) / 100 };
}
