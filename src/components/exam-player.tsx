"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AttemptView } from "@/lib/exam-types";
export default function ExamPlayer({ id }: { id: string }) {
  const [view, setView] = useState<AttemptView | null>(null),
    [index, setIndex] = useState(0),
    [busy, setBusy] = useState(true),
    [needsReload, setNeedsReload] = useState(false),
    [message, setMessage] = useState(""),
    [clock, setClock] = useState(0),
    [offset, setOffset] = useState(0);
  const pendingFocus = useRef<{ element: HTMLInputElement; questionKey: string } | null>(null);
  useEffect(() => {
    if (busy) return;
    const pending = pendingFocus.current;
    pendingFocus.current = null;
    // Native disabled controls lose focus while a save is in flight. Restore
    // only the original question/control, never steal focus after navigation.
    if (pending && !needsReload && view?.status === "IN_PROGRESS" &&
      view.questions[Math.min(index, view.questions.length - 1)]?.questionKey === pending.questionKey &&
      pending.element.isConnected && !pending.element.matches(":disabled") &&
      document.activeElement === document.body) pending.element.focus({ preventScroll: true });
  }, [busy, needsReload, view, index]);
  const accept = useCallback((data: AttemptView) => {
    setView(data);
    setOffset(Date.parse(data.serverNow) - Date.now());
    setClock(Date.now());
    setNeedsReload(false);
  }, []);
  const reload = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/exams/attempts/${id}`, { cache: "no-store" });
      const data = await r.json();
      if (r.ok) {
        accept(data);
        setMessage("Progress synchronized with the server.");
      } else {
        setNeedsReload(true);
        setMessage(data.error);
        if (r.status === 401 || r.status === 403 || r.status === 404)
          setView(null);
      }
    } catch {
      setNeedsReload(true);
      setMessage(
        "Could not confirm progress. Reconnect and reload before continuing.",
      );
    } finally {
      setBusy(false);
    }
  }, [id, accept]);
  useEffect(() => {
    let active = true;
    fetch(`/api/exams/attempts/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (active) {
          if (r.ok) accept(data);
          else {
            setMessage(data.error);
            setNeedsReload(true);
          }
          setBusy(false);
        }
      })
      .catch(() => {
        if (active) {
          setBusy(false);
          setNeedsReload(true);
          setMessage(
            "Unable to load your attempt. Please reconnect and reload.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [id, accept]);
  useEffect(() => {
    let ticks = 0;
    const timer = setInterval(() => {
      setClock(Date.now());
      ticks++;
      if (
        view?.status === "IN_PROGRESS" &&
        !busy &&
        !needsReload &&
        ((view.deadlineAt &&
          Date.now() + offset >= Date.parse(view.deadlineAt)) ||
          ticks % 15 === 0)
      )
        void reload();
    }, 1000);
    const visible = () => {
      if (document.visibilityState === "visible" && !busy && !needsReload)
        void reload();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [view, busy, needsReload, offset, reload]);
  async function write(body: unknown, submit = false) {
    if (!view) return;
    const focused = document.activeElement;
    pendingFocus.current = !submit && focused instanceof HTMLInputElement && focused.closest(".exam-question")
      ? { element: focused, questionKey: view.questions[Math.min(index, view.questions.length - 1)].questionKey }
      : null;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`/api/exams/attempts/${id}`, {
        method: submit ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", "X-CSC-Action": "1" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (r.ok) {
        accept(data);
        setMessage(
          data.status === "IN_PROGRESS"
            ? "Saved to your account."
            : "Your saved responses have been graded. This is a practice result, not an official CSC score.",
        );
      } else {
        setNeedsReload(true);
        setMessage(`${data.error} Reload to synchronize before continuing.`);
        if (r.status === 401 || r.status === 403) setView(null);
      }
    } catch {
      setNeedsReload(true);
      setMessage(
        "The last change could not be confirmed. Reconnect and reload; do not assume it was saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!view)
    return (
      <section className="exam-panel">
        <p role="status">{message || "Loading your saved attempt…"}</p>
        <button
          className="button"
          disabled={busy}
          onClick={() => void reload()}
        >
          Reload saved attempt
        </button>
        <p>
          <Link className="text-link" href="/practice/history">
            Back to history →
          </Link>
        </p>
      </section>
    );
  const question = view.questions[Math.min(index, view.questions.length - 1)];
  const saved = view.responses.find(
    (r) => r.questionKey === question.questionKey,
  );
  const done = view.status !== "IN_PROGRESS";
  const remaining = view.deadlineAt
    ? Math.max(
        0,
        Math.ceil((Date.parse(view.deadlineAt) - clock - offset) / 1000),
      )
    : null;
  const disabled = busy || needsReload || done || remaining === 0;
  const answered = view.responses.filter((r) => r.choiceLabel !== null).length;
  const save = (choiceLabel: string | null, flagged: boolean) => {
    const response = {
      questionKey: question.questionKey,
      choiceLabel,
      flagged,
    };
    // Keep the native control responsive while the durable write is pending.
    // busy/needsReload prevent further edits until acknowledgement or resync.
    setView({
      ...view,
      responses: [
        ...view.responses.filter((r) => r.questionKey !== question.questionKey),
        response,
      ],
    });
    void write({
      revision: view.revision,
      responses: [response],
    });
  };
  return (
    <section className="exam-panel">
      <div className="eyebrow">
        {view.series ? `SET ${view.series.position} · MIXED SKILLS` : view.level} · {view.mode} · {view.status}
      </div>
      <h1>{view.title}</h1>
      {(view.unreviewed || view.series?.unreviewed) && <p className="notice">Unreviewed practice · These draft questions and proposed answer keys have not been independently checked and may contain errors.</p>}
      <div className="exam-status">
        <span>
          {answered} of {view.totalQuestions} answered
        </span>
        <span role="timer" aria-live="off">
          {remaining === null
            ? "Untimed practice"
            : `Time remaining: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
        </span>
        <span>
          {busy
            ? "Synchronizing…"
            : needsReload
              ? "Synchronization needed"
              : "Progress saved to your account"}
        </span>
      </div>
      {view.series && done && <p className="notice"><Link className="button" href="/practice/sets">
        {view.series.position < 5 ? "Open your next practice set →" : "View your completed sets →"}
      </Link></p>}
      <p className="fine-print">
        Timing is enforced online. Reconnecting or changing your device clock
        does not extend the session. These timings and results are not official
        CSC specifications or scores.
      </p>
      {view.status === "EXPIRED" && (
        <p className="notice">
          Time ended. Only responses saved before the server deadline were
          graded.
        </p>
      )}
      {view.questions.length > 40 ? <label>Question number
        <select value={index} onChange={event => setIndex(Number(event.target.value))}>
          {view.questions.map((q, i) => {
            const response = view.responses.find(r => r.questionKey === q.questionKey);
            return <option key={q.questionKey} value={i}>Question {i + 1} of {view.totalQuestions}{response?.choiceLabel ? " · Answered" : ""}{response?.flagged ? " · Flagged" : ""}</option>;
          })}
        </select>
      </label> : <nav className="question-nav" aria-label="Question navigation">
        {view.questions.map((q, i) => {
          const response = view.responses.find(
            (r) => r.questionKey === q.questionKey,
          );
          return (
            <button
              key={q.questionKey}
              className={i === index ? "selected" : ""}
              aria-current={i === index ? "step" : undefined}
              aria-label={`Question ${i + 1}${response?.flagged ? ", flagged" : ""}${response?.choiceLabel ? ", answered" : ""}`}
              onClick={() => setIndex(i)}
            >
              {i + 1}
              {response?.flagged ? " ⚑" : ""}
            </button>
          );
        })}
      </nav>}
      <div className="exam-question">
        <span className="eyebrow">
          QUESTION {index + 1} OF {view.totalQuestions} · {question.topic}
        </span>
        <fieldset disabled={disabled}>
          <legend>{question.prompt}</legend>
          {question.choices.map((c) => (
            <label className="exam-choice" key={c.label}>
              <input
                type="radio"
                name="answer"
                value={c.label}
                checked={saved?.choiceLabel === c.label}
                onChange={() => save(c.label, saved?.flagged ?? false)}
              />
              <strong>{c.label}.</strong> {c.text}
            </label>
          ))}
        </fieldset>
        <label className="check-label">
          <input
            type="checkbox"
            checked={saved?.flagged ?? false}
            disabled={disabled}
            onChange={(e) => save(saved?.choiceLabel ?? null, e.target.checked)}
          />{" "}
          Flag this question for review
        </label>
        <div className="actions">
          <button
            className="button button-light"
            disabled={disabled || !saved?.choiceLabel}
            onClick={() => save(null, saved?.flagged ?? false)}
          >
            Clear answer
          </button>
          <button
            className="button button-light"
            disabled={index === 0}
            onClick={() => setIndex(index - 1)}
          >
            Previous
          </button>
          <button
            className="button button-light"
            disabled={index === view.totalQuestions - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next
          </button>
        </div>
      </div>
      <p className="feedback" role="status">
        {message}
      </p>
      {needsReload && (
        <button
          className="button"
          disabled={busy}
          onClick={() => void reload()}
        >
          Reload saved attempt
        </button>
      )}
      {!done && (
        <div className="exam-submit">
          <p>
            {view.series ? "Answer all 160 questions to finish this set and unlock the next released set." : "Submit when you are ready. Unanswered questions receive no credit."}
            You cannot change responses after grading.
          </p>
          <button
            className="button"
            disabled={busy || needsReload || (!!view.series && answered !== view.totalQuestions)}
            onClick={() => void write({ action: "submit" }, true)}
          >
            Submit and view explanations
          </button>
        </div>
      )}
      {view.result && (
        <section className="exam-result">
          <h2>Your practice result</h2>
          <p className="result-score">
            {view.result.correct} / {view.result.total}{" "}
            <span>({view.result.percent}%)</span>
          </p>
          <p>
            {view.result.unanswered} unanswered. This is not an official CSC
            score or passing prediction.
          </p>
          <h3>Performance by subject</h3>
          {view.result.byTopic.map((t) => (
            <div className="topic-report" key={t.topic}>
              <span>{t.topic}</span>
              <progress aria-label={`Correct answers for ${t.topic}`} value={t.correct} max={t.total} />
              <strong>
                {t.correct}/{t.total}
              </strong>
            </div>
          ))}
          <h3>Answers and detailed explanations</h3>
          {view.questions.map((q, i) => {
            const result = view.result!.answers.find(
              (a) => a.questionKey === q.questionKey,
            )!;
            return (
              <article className="answer-review" key={q.questionKey}>
                <h4>
                  {i + 1}. {q.prompt}
                </h4>
                <p>
                  Your answer: {result.selectedLabel ?? "Unanswered"} · Correct
                  answer: {result.correctLabel}
                </p>
                <p>{result.explanation}</p>
                <p className="fine-print">Source notes: {result.sourceNotes}</p>
              </article>
            );
          })}
        </section>
      )}
      <div className="actions">
        {view.series && <Link className="button" href="/practice/sets">{done ? "Continue to your practice sets →" : "Back to your practice sets"}</Link>}
        <Link className="text-link" href="/practice/history">
          History & subject reports →
        </Link>
        <Link className="text-link" href="/practice">
          Choose another session →
        </Link>
      </div>
    </section>
  );
}
