"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { AttemptHistory } from "@/lib/exam-types";
import PracticeTrend from "./practice-trend";
export default function ExamHistory() {
  const [data, setData] = useState<AttemptHistory | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/exams/history", { cache: "no-store" })
      .then(async (r) => {
        const result = await r.json();
        if (active) {
          if (r.ok) setData(result);
          else setMessage(result.error);
        }
      })
      .catch(() => {
        if (active) setMessage("Unable to load history. Please reload.");
      });
    return () => {
      active = false;
    };
  }, []);
  if (!data)
    return <p role="status">{message || "Loading your practice history…"}</p>;
  return (
    <section className="exam-panel">
      <div className="exam-metrics">
        <div>
          <strong>{data.completedCount}</strong>
          <span>Completed in your recent {data.limit}</span>
        </div>
        <div>
          <strong>
            {data.averagePercent === null ? "—" : `${data.averagePercent}%`}
          </strong>
          <span>Average practice result (not official)</span>
        </div>
      </div>
      <PracticeTrend attempts={data.attempts} limit={data.limit} />
      <h2>Subject performance</h2>
      {data.byTopic.length ? (
        data.byTopic.map((t) => (
          <div className="topic-report" key={t.topic}>
            <span>{t.topic}</span>
            <progress aria-label={`Correct answers for ${t.topic}`} value={t.correct} max={t.total} />
            <strong>
              {t.correct}/{t.total}
            </strong>
            <small>{t.unanswered} unanswered</small>
          </div>
        ))
      ) : (
        <p>Complete a practice session to see subject reports.</p>
      )}
      <h2>Saved sessions</h2>
      <p className="fine-print">
        All active sessions and your latest {data.limit} completed attempts.
        Summary scores remain yours; question content requires current access.
      </p>
      {!data.attempts.length && (
        <p>
          No saved attempts yet.{" "}
          <Link className="text-link" href="/practice">
            Choose a session →
          </Link>
        </p>
      )}
      {data.attempts.map((a) => (
        <article className="history-row" key={a.id}>
          <div>
            <h3>{a.title}</h3>
            <p>
              {a.level} · {a.mode} · {a.status}
            </p>
            <small>
              {new Date(a.startedAt).toLocaleString()} ·{" "}
              {a.score === null
                ? "Not graded"
                : `${a.score}/${a.totalQuestions} correct`}
            </small>
          </div>
          {a.accessLocked ? (
            <span className="status-pill">Exam access required</span>
          ) : (
            <Link className="button button-light" href={`/practice/${a.id}`}>
              {a.status === "IN_PROGRESS"
                ? "Resume saved session"
                : "Review explanations"}
            </Link>
          )}
        </article>
      ))}
    </section>
  );
}
