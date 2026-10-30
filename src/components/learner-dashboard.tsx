"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AttemptHistory } from "@/lib/exam-types";
import type { SeriesProgress } from "@/lib/practice-series-policy";
import { studyRecommendations } from "@/lib/study-recommendations";

export default function LearnerDashboard() {
  const [history, setHistory] = useState<AttemptHistory | null>(null);
  const [series, setSeries] = useState<SeriesProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const retryFocus = useRef(false);
  useEffect(() => {
    if (!loading && retryFocus.current) {
      retryFocus.current = false;
      if (document.activeElement === document.body) heading.current?.focus();
    }
  }, [loading]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function read<T,>(path: string): Promise<T> {
      const response = await fetch(path, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Dashboard section unavailable.");
      return response.json();
    }
    void Promise.allSettled([read<AttemptHistory>("/api/exams/history"), read<SeriesProgress>("/api/exams/series")]).then(([attempts, sets]) => {
      if (!active) return;
      setHistory(attempts.status === "fulfilled" ? attempts.value : null);
      setSeries(sets.status === "fulfilled" ? sets.value : null);
      setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [reload]);
  const active = history?.attempts.filter(attempt => attempt.status === "IN_PROGRESS" && !attempt.accessLocked)
    .sort((a, b) => (a.deadlineAt ? Date.parse(a.deadlineAt) : Infinity) - (b.deadlineAt ? Date.parse(b.deadlineAt) : Infinity)) ?? [];
  const recent = history?.attempts.find(attempt => attempt.status !== "IN_PROGRESS");
  const suggestion = studyRecommendations(history?.byTopic ?? [])[0];
  const nextSet = series?.sets.find(set => set.state === "in_progress") ?? series?.sets.find(set => set.state === "available");
  const resumeId = active[0]?.id ?? nextSet?.attemptId;
  const nextTitle = active[0]?.title ?? (nextSet ? `Practice Set ${nextSet.position}` : "Make time for one useful session.");
  const nextHref = resumeId ? `/practice/${resumeId}` : nextSet ? "/practice/sets" : "/practice";
  return <section className="learner-dashboard" aria-labelledby="learning-dashboard-title">
    <h2 id="learning-dashboard-title" ref={heading} tabIndex={-1}>Your learning dashboard</h2>
    {loading ? <p role="status">Loading your learning dashboard…</p> : <>
      {(!history || !series) && <div className="notice"><p>Some progress is temporarily unavailable. Please reload to try again.</p><button className="button button-light" onClick={() => { retryFocus.current = true; setLoading(true); setReload(value => value + 1); }}>Reload dashboard</button></div>}
      <section className="dashboard-next" aria-labelledby="dashboard-next-title"><div><p className="eyebrow">YOUR NEXT STEP</p><h3 id="dashboard-next-title">{nextTitle}</h3><p>{resumeId ? "Continue from your saved answers." : "Choose a session and practise at your own pace."}</p>{active[0]?.deadlineAt && <p className="fine-print">Your timer continues while you are away.</p>}</div><Link className="button" href={nextHref}>{resumeId ? "Continue studying →" : "Start practising →"}</Link></section>
      <dl className="dashboard-metrics">
        <div><dt>Completed sessions</dt><dd>{history?.completedCount ?? "—"}</dd></div>
        <div><dt>Average result</dt><dd>{history?.averagePercent == null ? "—" : `${history.averagePercent}%`}</dd></div>
        <div><dt>Sets finished</dt><dd>{series ? `${series.completedSets} / ${series.totalSets}` : "—"}</dd></div>
      </dl>
      <p className="fine-print">Session figures cover your latest {history?.limit ?? 50} completed attempts. These are practice results, not official scores.</p>
      {series && <div className="dashboard-course"><progress aria-label="Completed practice sets" value={series.completedSets} max={series.totalSets} /><Link className="text-link" href="/practice/sets">View your five sets →</Link></div>}
      <div className="dashboard-columns">
        <section className="dashboard-card" aria-labelledby="recent-result-title"><h3 id="recent-result-title">Latest result</h3>
          {recent ? <><p>{recent.title}</p><p className="dashboard-result">{recent.score} / {recent.totalQuestions} correct</p>{recent.accessLocked ? <p className="fine-print">Current exam access is needed for explanations.</p> : <Link className="text-link" href={`/practice/${recent.id}`}>Review your answers →</Link>}</> : <p>{history ? "Your first completed session will appear here." : "Results are temporarily unavailable."}</p>}
        </section>
        <section className="dashboard-card" aria-labelledby="dashboard-recommendations-title"><h3 id="dashboard-recommendations-title">Study next</h3>
          {suggestion ? <><h4>{suggestion.title}</h4><p>{suggestion.missed} of {suggestion.total} items missed or unanswered in recent practice.</p><Link className="text-link" href={suggestion.href}>Revisit this subject →</Link></> : <><p>{history?.completedCount ? "Keep building on your recent practice." : "Build a foundation while you work toward your first result."}</p><Link className="text-link" href="/reviewers">Choose a subject guide →</Link></>}
        </section>
      </div>
      <nav className="dashboard-links" aria-label="Learning tools"><Link href="/practice/history">Practice history</Link><Link href="/reviewers">Reviewers</Link><Link href="/study-plan">Study planner</Link></nav>
    </>}
  </section>;
}
