"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ExamOption } from "@/lib/exam-types";
export default function ExamLobby() {
  const router = useRouter();
  const [options, setOptions] = useState<ExamOption[]>([]),
    [level, setLevel] = useState("PROFESSIONAL"),
    [mode, setMode] = useState("PRACTICE"),
    [selected, setSelected] = useState(""),
    [topic, setTopic] = useState(""),
    [count, setCount] = useState(1),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const requestKey = useRef<{ key: string; signature: string } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/exams/templates", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (active) {
          if (r.ok) setOptions(data);
          else setMessage(data.error);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setMessage("Unable to load sessions. Please reload.");
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const filtered = options.filter((t) => t.level === level && t.mode === mode),
    chosen = filtered.find((t) => t.id === selected);
  return (
    <section className="exam-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">PRACTICE SESSIONS · SAVED PROGRESS</div>
          <h2>Choose your session.</h2>
        </div>
        <Link className="text-link" href="/practice/history">
          Your history & reports →
        </Link>
      </div>
      <div className="exam-filters">
        <label>
          Learning track
          <select
            disabled={loading || busy}
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setSelected("");
              setTopic("");
            }}
          >
            <option value="PROFESSIONAL">Professional</option>
            <option value="SUBPROFESSIONAL">Subprofessional</option>
          </select>
        </label>
        <label>
          Session type
          <select
            disabled={loading || busy}
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setSelected("");
              setTopic("");
            }}
          >
            <option value="PRACTICE">Topic practice</option>
            <option value="MOCK">Timed mock examination</option>
          </select>
        </label>
      </div>
      {loading ? (
        <p>Loading available sessions…</p>
      ) : !filtered.length ? (
        <div className="notice">
          No sessions are available for this track and mode yet. Try another
          session type or open the five practice sets above.
        </div>
      ) : (
        <fieldset className="session-options">
          <legend>Available sessions</legend>
          {filtered.map((t) => (
            <label className="session-option" key={t.id}>
              <input
                type="radio"
                name="template"
                value={t.id}
                checked={selected === t.id}
                onChange={() => {
                  setSelected(t.id);
                  setTopic("");
                  setCount(t.questionCount);
                  setMessage("");
                }}
              />
              <span>
                <strong>{t.title}</strong>
                <small>
                  {t.questionCount} questions ·{" "}
                  {t.durationSeconds
                    ? t.durationSeconds % 60 ? `${t.durationSeconds} seconds` : `${t.durationSeconds / 60} minutes`
                    : "Untimed"}{" "}
                  ·{" "}
                  {t.access === "FREE"
                    ? t.unreviewed ? "Free draft practice" : "Free reviewed session"
                    : "Purchased exam access required"}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {chosen?.unreviewed && <p className="notice">Unreviewed practice · These questions and proposed keys may contain errors. This timed session reuses questions from the five practice sets.</p>}
      {chosen && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            const body = {
              templateId: chosen.id,
              ...(mode === "PRACTICE"
                ? { questionCount: count, ...(topic ? { topic } : {}) }
                : {}),
            };
            const signature = JSON.stringify(body);
            if (requestKey.current?.signature !== signature)
              requestKey.current = { signature, key: crypto.randomUUID() };
            try {
              const r = await fetch("/api/exams/attempts", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-CSC-Action": "1",
                },
                body: JSON.stringify({
                  ...body,
                  startKey: requestKey.current.key,
                }),
              });
              const data = await r.json();
              if (r.ok) router.push(`/practice/${data.id}`);
              else setMessage(data.error);
            } catch {
              setMessage(
                "Could not confirm the start. Retry the same selection, or check your history before starting a different session.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {mode === "PRACTICE" && (
            <div className="exam-filters">
              <label>
                Number of questions
                <input
                  type="number"
                  min="1"
                  max={chosen.questionCount}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  required
                />
              </label>
              <label>
                Topic
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                >
                  <option value="">All session topics</option>
                  {chosen.topics.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {!chosen.canStart && (
            <p className="notice">
              This session requires active purchased exam access. Checkout is
              not enabled yet.
            </p>
          )}
          <button className="button" disabled={busy || !chosen.canStart}>
            {busy ? "Starting…" : "Start this session"}
          </button>
          <p className="fine-print">
            Timing and question counts are configured for practice. They are not
            verified official 2027 CSC examination specifications. Answers are
            shown only after submission.
          </p>
        </form>
      )}
      <p className="feedback" role="status">
        {message}
      </p>
    </section>
  );
}
