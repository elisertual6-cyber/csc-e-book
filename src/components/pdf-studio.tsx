"use client";
import { useEffect, useState } from "react";
type Option = {
  id: string;
  title?: string;
  prompt?: string;
  status: string;
  version: number;
};
type Edition = {
  id: string;
  title: string;
  kind: string;
  version: string;
  publishedAt: string | null;
};
export default function PdfStudio({ admin }: { admin: boolean }) {
  const [lessons, setLessons] = useState<Option[]>([]),
    [questions, setQuestions] = useState<Option[]>([]),
    [editions, setEditions] = useState<Edition[]>([]),
    [lessonIds, setLessonIds] = useState<string[]>([]),
    [questionIds, setQuestionIds] = useState<string[]>([]),
    [title, setTitle] = useState("Philippine Civil Service Exam Reviewer 2027"),
    [version, setVersion] = useState("0.2.0-draft.1"),
    [kind, setKind] = useState("DRAFT"),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  async function refresh() {
    const responses = await Promise.all([
      fetch("/api/admin/lessons"),
      fetch("/api/admin/questions"),
      fetch("/api/admin/pdf"),
    ]);
    const results = await Promise.all(responses.map((r) => r.json()));
    if (responses.every((r) => r.ok)) {
      setLessons(results[0]);
      setQuestions(results[1]);
      setEditions(results[2]);
    } else setMessage("Unable to load PDF workspace.");
  }
  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/lessons"),
      fetch("/api/admin/questions"),
      fetch("/api/admin/pdf"),
    ])
      .then(async (responses) => {
        const data = await Promise.all(responses.map((r) => r.json()));
        if (responses.every((r) => r.ok)) {
          setLessons(data[0]);
          setQuestions(data[1]);
          setEditions(data[2]);
        } else setMessage("Unable to load PDF workspace.");
      })
      .catch(() => setMessage("Unable to load PDF workspace."));
  }, []);
  async function post(body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSC-Action": "1" },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      setMessage(
        r.ok
          ? "PDF operation completed. Drafts and full editions remain private."
          : result.error,
      );
      if (r.ok) await refresh();
    } catch {
      setMessage("PDF operation failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="editor-panel">
      <h2>PDF workspace</h2>
      <p>
        Drafts are staff-only proofs. Preview candidates require published,
        independently reviewed content and a separate admin release. Full
        editions remain private and require 500 unique reviewed questions. No
        paid downloads are enabled.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void post({ title, version, kind, lessonIds, questionIds });
        }}
      >
        <label>
          Edition title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label>
          Publication version
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            required
          />
        </label>
        <label>
          Edition type
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="DRAFT">Private editorial draft</option>
            {admin && (
              <>
                <option value="PREVIEW">Reviewed free preview candidate</option>
                <option value="FULL">
                  Private full edition (launch gate applies)
                </option>
              </>
            )}
          </select>
        </label>
        <fieldset>
          <legend>Include lessons</legend>
          {lessons.map((l) => (
            <label className="check-label" key={l.id}>
              <input
                type="checkbox"
                checked={lessonIds.includes(l.id)}
                onChange={(e) =>
                  setLessonIds(
                    e.target.checked
                      ? [...lessonIds, l.id]
                      : lessonIds.filter((id) => id !== l.id),
                  )
                }
              />
              {l.title} · v{l.version} · {l.status}
            </label>
          ))}
        </fieldset>
        <fieldset>
          <legend>Include question-bank exercises</legend>
          {questions.map((q) => (
            <label className="check-label" key={q.id}>
              <input
                type="checkbox"
                checked={questionIds.includes(q.id)}
                onChange={(e) =>
                  setQuestionIds(
                    e.target.checked
                      ? [...questionIds, q.id]
                      : questionIds.filter((id) => id !== q.id),
                  )
                }
              />
              {q.prompt?.slice(0, 100)} · v{q.version} · {q.status}
            </label>
          ))}
        </fieldset>
        <button className="button" disabled={busy || !lessonIds.length}>
          {busy ? "Working…" : "Generate private PDF"}
        </button>
      </form>
      <p role="status" className="feedback">
        {message}
      </p>
      <h3>Generated editions</h3>
      {admin && (
        <label className="check-label">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />{" "}
          I have reviewed the entire candidate PDF, including its template,
          references, copyright and notices.
        </label>
      )}
      {editions.map((e) => (
        <div className="edition-row" key={e.id}>
          <div>
            <strong>{e.title}</strong>
            <p>
              {e.kind} · {e.version} ·{" "}
              {e.publishedAt ? "Public preview released" : "Private"}
            </p>
          </div>
          <a
            className="text-link"
            href={`/api/admin/pdf/${e.id}`}
            target="_blank"
            rel="noreferrer"
          >
            Open protected PDF ↗
          </a>
          {admin && e.kind === "PREVIEW" && !e.publishedAt && (
            <button
              className="button button-light"
              disabled={!confirmed || busy}
              onClick={() =>
                void post({
                  action: "publish",
                  id: e.id,
                  humanReviewed: confirmed,
                })
              }
            >
              Release free preview
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
