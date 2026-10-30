"use client";
import { useId, useState } from "react";
import Link from "next/link";
import type { AttemptSummary } from "@/lib/exam-types";
import { practiceTrend, trendGroups } from "@/lib/practice-trends";

const trackTitle = (level: string) => level === "COMMON" ? "Both tracks" : level === "PROFESSIONAL" ? "Professional" : level === "SUBPROFESSIONAL" ? "Subprofessional" : level;
const modeTitle = (mode: string) => mode === "MOCK" ? "Timed mock" : "Practice";
export default function PracticeTrend({ attempts, limit }: { attempts: AttemptSummary[]; limit: number }) {
  const id = useId();
  const [group, setGroup] = useState("");
  const groups = trendGroups(attempts);
  const { points, first, latest, change } = practiceTrend(attempts, group);
  const coordinates = points.map((point, index) => ({ x: points.length === 1 ? 340 : 70 + index * 540 / (points.length - 1), y: 170 - point.percent * 1.5 }));
  return <section className="practice-trend" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Recent result trend</h2>
    {!groups.length ? <p>Complete a practice session to see your result trend.</p> : <>
      <label htmlFor={`${id}-group`}>Compare sessions</label><select id={`${id}-group`} value={group} onChange={event => setGroup(event.target.value)}>
        <option value="">All recent completed sessions</option>{groups.map(item => <option key={item.key} value={item.key}>{item.title} · {trackTitle(item.level)} · {modeTitle(item.mode)} · {item.totalQuestions} items ({item.count} {item.count === 1 ? "session" : "sessions"})</option>)}
      </select>
      <p className="fine-print">Up to 10 completed sessions from your latest {limit}, oldest to newest. Matching groups share a title, track, mode and item count; questions and difficulty may vary. This compares practice results, not exam readiness.</p>
      <p role="status" aria-label="Trend selection">Showing {points.length} completed {points.length === 1 ? "session" : "sessions"}.</p>
      {points.length > 0 && <>
        <dl className="trend-metrics"><div><dt>First shown</dt><dd>{first}%</dd></div><div><dt>Latest shown</dt><dd>{latest}%</dd></div><div><dt>Change from first</dt><dd>{change === null ? "—" : `${change > 0 ? "+" : ""}${change}`} {change !== null && <span>percentage {Math.abs(change) === 1 ? "point" : "points"}</span>}</dd></div></dl>
        {change === null && <p className="fine-print">Complete another matching session to compare two results.</p>}
        <svg className="trend-chart" viewBox="0 0 640 215" role="img" aria-label={`Practice results, oldest to newest: ${points.map(point => `${point.percent}%`).join(", ")}. Full details are below.`}>
          {[0, 50, 100].map(value => <g key={value}><line x1="70" x2="610" y1={170 - value * 1.5} y2={170 - value * 1.5} className="trend-grid" /><text x="60" y={176 - value * 1.5} textAnchor="end">{value}%</text></g>)}
          {points.length > 1 && <polyline points={coordinates.map(point => `${point.x},${point.y}`).join(" ")} fill="none" className="trend-line" />}
          {coordinates.map((point, index) => <g key={points[index].id}><circle cx={point.x} cy={point.y} r="5" /><text x={point.x} y="203" textAnchor="middle">{index + 1}</text></g>)}
        </svg>
        <details className="trend-details"><summary>View session details ({points.length})</summary><table><caption>Sessions shown in the chart, oldest to newest</caption><thead><tr><th scope="col">Session</th><th scope="col">Result</th></tr></thead><tbody>{points.map((point, index) => <tr key={point.id}><th scope="row"><span>{index + 1}. {point.title}</span><small>{trackTitle(point.level)} · {modeTitle(point.mode)} · {point.status === "EXPIRED" ? "Expired" : "Submitted"}</small></th><td><strong>{point.percent}%</strong><small>{point.score} / {point.totalQuestions} correct</small>{point.accessLocked ? <small>Current exam access required for explanations.</small> : <Link className="text-link" href={`/practice/${point.id}`}>Review session {index + 1} →</Link>}</td></tr>)}</tbody></table></details>
      </>}
    </>}
  </section>;
}
