"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
type Kind = "lessons" | "questions" | "chapters";
type Row = {
  id: string;
  title?: string;
  prompt?: string;
  slug?: string;
  key?: string;
  status?: string;
  authorId?: string;
  revision?: number;
  version?: number;
  chapter?: { slug: string };
  objectives?: string[];
  markdown?: string;
  position?: number;
  level?: string;
  topic?: string;
  difficulty?: string;
  sourceNotes?: string;
  explanation?: { rationale: string };
  choices?: { label: string; text: string; isCorrect: boolean }[];
};
const emptyLesson = {
  slug: "",
  title: "",
  chapterSlug: "arithmetic",
  objectives: [""],
  markdown:
    "## Learning objectives\n\n\n## Explanation\n\n\n## Worked example\n\n\n## Practice\n\n\n## Rationale\n\n",
};
const emptyQuestion = {
  key: "",
  prompt: "",
  topic: "arithmetic",
  level: "COMMON",
  difficulty: "EASY",
  sourceNotes: "",
  explanation: "",
  choices: ["A", "B", "C", "D"].map((label) => ({
    label,
    text: "",
    isCorrect: label === "A",
  })),
};
export default function EditorialStudio({
  actor,
}: {
  actor: { id: string; role: string };
}) {
  const [kind, setKind] = useState<Kind>("lessons"),
    [rows, setRows] = useState<Row[]>([]),
    [chapters, setChapters] = useState<Row[]>([]),
    [selected, setSelected] = useState<Row | null>(null);
  const [lesson, setLesson] = useState(emptyLesson),
    [question, setQuestion] = useState(emptyQuestion),
    [chapter, setChapter] = useState({
      slug: "",
      title: "",
      position: 26,
      level: "COMMON",
    });
  const [message, setMessage] = useState(""),
    [notes, setNotes] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false);
  const [transfer, setTransfer] = useState(""),
    [format, setFormat] = useState("json");
  const [setFilter, setSetFilter] = useState("all");
  const [contentLoading, setContentLoading] = useState(true);
  const writer = actor.role === "ADMIN" || actor.role === "EDITOR";
  async function refresh(resource: Kind = kind) {
    const response = await fetch(`/api/admin/${resource}${resource === "questions" && setFilter !== "all" ? `?set=${setFilter}` : ""}`, {
      cache: "no-store",
    });
    const data = await response.json();
    if (response.ok) setRows(data);
    else setMessage(data.error);
  }
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/${kind}${kind === "questions" && setFilter !== "all" ? `?set=${setFilter}` : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (alive) { if (Array.isArray(data)) setRows(data); else setMessage(data.error ?? "Unable to load content."); setContentLoading(false); }
      })
      .catch(() => {
        if (alive) { setMessage("Unable to load content."); setContentLoading(false); }
      });
    return () => {
      alive = false;
    };
  }, [kind, setFilter]);
  useEffect(() => {
    fetch("/api/admin/chapters", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setChapters(data);
      })
      .catch(() => setMessage("Unable to load chapters."));
  }, []);
  function choose(row: Row, clone = false) {
    setSelected(clone ? null : row);
    setNotes("");
    setConfirmed(false);
    setMessage("");
    if (kind === "lessons")
      setLesson({
        slug: row.slug!,
        title: row.title!,
        chapterSlug: row.chapter?.slug ?? "arithmetic",
        objectives: row.objectives ?? [],
        markdown: row.markdown ?? "",
      });
    if (kind === "questions")
      setQuestion({
        key: row.key!,
        prompt: row.prompt!,
        topic: row.topic!,
        level: row.level!,
        difficulty: row.difficulty!,
        sourceNotes: row.sourceNotes!,
        explanation: row.explanation?.rationale ?? "",
        choices: row.choices!.map((c) => ({
          label: c.label,
          text: c.text,
          isCorrect: c.isCorrect,
        })),
      });
    if (kind === "chapters")
      setChapter({
        slug: row.slug!,
        title: row.title!,
        position: row.position!,
        level: row.level!,
      });
  }
  async function send(action: string) {
    setBusy(true);
    setMessage("");
    const data =
      kind === "lessons" ? lesson : kind === "questions" ? question : chapter;
    const body =
      action === "create"
        ? { action, data }
        : kind === "chapters"
          ? { action, id: selected?.id, ...(action === "save" ? { data } : {}) }
          : {
              action,
              id: selected?.id,
              revision: selected?.revision,
              ...(action === "save" ? { data } : {}),
              ...(action === "approve" || action === "reject"
                ? { notes, humanReviewed: confirmed }
                : {}),
            };
    try {
      const response = await fetch(`/api/admin/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSC-Action": "1" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) setMessage(result.error);
      else {
        setSelected(kind === "chapters" && action === "delete" ? null : result);
        setMessage("Saved. Review and publication are separate steps.");
        await refresh();
      }
    } catch {
      setMessage("Unable to save. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  const editable =
    writer &&
    (!selected ||
      kind === "chapters" ||
      (selected.status === "DRAFT" && selected.authorId === actor.id));
  return (
    <div className="studio">
      <div className="tabs" role="group" aria-label="Content type">
        {(["lessons", "questions", "chapters"] as const).map((k) => (
          <button
            className={`button ${kind === k ? "" : "button-light"}`}
            key={k}
            aria-pressed={kind === k}
            onClick={() => {
              if (kind === k) return;
              setKind(k);
              setRows([]);
              setContentLoading(true);
              setSelected(null);
              setMessage("");
            }}
          >
            {k[0].toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>
      <div className="studio-grid">
        <aside className="record-list">
          <h2>Content versions</h2>
          {kind === "questions" && <label>Question collection
            <select value={setFilter} onChange={event => {
              setSetFilter(event.target.value); setSelected(null); setQuestion(emptyQuestion); setRows([]); setContentLoading(true);
            }}>
              <option value="all">Latest questions from all collections</option>
              {[1, 2, 3, 4, 5].map(position => <option key={position} value={position}>Practice Set {position} · 160 items</option>)}
            </select>
          </label>}
          <p className="fine-print">
            {contentLoading ? "Loading content…" : kind === "questions" && setFilter !== "all"
              ? `Set ${setFilter}: ${rows.length} of 160 question keys found. Showing the latest version of each.`
              : "Latest 200 records. Export includes the latest version of every question key."}
          </p>
          {rows.map((row) => (
            <button
              className="record"
              key={row.id}
              onClick={() => choose(row)}
              aria-pressed={selected?.id === row.id}
            >
              <strong>{row.title ?? row.prompt?.slice(0, 90)}</strong>
              <span>
                {row.status ?? "Chapter metadata"}
                {row.version ? ` · v${row.version}` : ""}
              </span>
            </button>
          ))}
          {!rows.length && <p>No records yet.</p>}
        </aside>
        <section className="editor-panel">
          <div className="actions">
            <h2>{selected ? "Inspect this version" : "Create a draft"}</h2>
            <button
              className="button button-light"
              onClick={() => {
                setSelected(null);
                setLesson(emptyLesson);
                setQuestion(emptyQuestion);
                setChapter({
                  slug: "",
                  title: "",
                  position: 26,
                  level: "COMMON",
                });
              }}
            >
              New {kind === "chapters" ? "chapter" : "draft"}
            </button>
            {selected && kind !== "chapters" && writer && (
              <button
                className="button button-light"
                onClick={() => choose(selected, true)}
              >
                Copy into next version
              </button>
            )}
          </div>
          <p className="fine-print">
            Only an author can edit their DRAFT. Submitted, approved and
            published versions are locked. Copies need a fresh independent
            review.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(selected ? "save" : "create");
            }}
          >
            <fieldset disabled={!editable || busy}>
              {kind === "lessons" && (
                <>
                  <label>
                    Lesson key
                    <input
                      value={lesson.slug}
                      onChange={(e) =>
                        setLesson({ ...lesson, slug: e.target.value })
                      }
                      required
                      pattern="[a-z0-9-]+"
                    />
                  </label>
                  <label>
                    Title
                    <input
                      value={lesson.title}
                      onChange={(e) =>
                        setLesson({ ...lesson, title: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    Chapter
                    <select
                      value={lesson.chapterSlug}
                      onChange={(e) =>
                        setLesson({ ...lesson, chapterSlug: e.target.value })
                      }
                    >
                      {chapters.map((c) => (
                        <option key={c.id} value={c.slug}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Learning objectives (one per line)
                    <textarea
                      value={lesson.objectives.join("\n")}
                      onChange={(e) =>
                        setLesson({
                          ...lesson,
                          objectives: e.target.value.split("\n"),
                        })
                      }
                    />
                  </label>
                  <label>
                    Lesson Markdown
                    <textarea
                      className="large-textarea"
                      value={lesson.markdown}
                      onChange={(e) =>
                        setLesson({ ...lesson, markdown: e.target.value })
                      }
                    />
                  </label>
                </>
              )}
              {kind === "questions" && (
                <>
                  <label>
                    Question key
                    <input
                      value={question.key}
                      onChange={(e) =>
                        setQuestion({ ...question, key: e.target.value })
                      }
                      required
                      pattern="[a-z0-9-]+"
                    />
                  </label>
                  <label>
                    Prompt
                    <textarea
                      value={question.prompt}
                      onChange={(e) =>
                        setQuestion({ ...question, prompt: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    Topic key
                    <input
                      value={question.topic}
                      onChange={(e) =>
                        setQuestion({ ...question, topic: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    Track
                    <select
                      value={question.level}
                      onChange={(e) =>
                        setQuestion({ ...question, level: e.target.value })
                      }
                    >
                      {["COMMON", "PROFESSIONAL", "SUBPROFESSIONAL"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Difficulty
                    <select
                      value={question.difficulty}
                      onChange={(e) =>
                        setQuestion({ ...question, difficulty: e.target.value })
                      }
                    >
                      {["EASY", "MEDIUM", "HARD"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <fieldset>
                    <legend>Answer choices and correct answer</legend>
                  {question.choices.map((choice, i) => (
                    <div className="choice-editor" key={choice.label}>
                      <label>
                        Option {choice.label}
                        <input
                          value={choice.text}
                          onChange={(e) =>
                            setQuestion({
                              ...question,
                              choices: question.choices.map((c, j) =>
                                j === i ? { ...c, text: e.target.value } : c,
                              ),
                            })
                          }
                          required
                        />
                      </label>
                      <label className="check-label">
                        <input
                          type="radio"
                          name="correct"
                          checked={choice.isCorrect}
                          onChange={() =>
                            setQuestion({
                              ...question,
                              choices: question.choices.map((c, j) => ({
                                ...c,
                                isCorrect: j === i,
                              })),
                            })
                          }
                        />{" "}
                        Correct answer: {choice.label}
                      </label>
                    </div>
                  ))}
                  </fieldset>
                  <label>
                    Answer rationale
                    <textarea
                      value={question.explanation}
                      onChange={(e) =>
                        setQuestion({
                          ...question,
                          explanation: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                  <label>
                    Sources and verification notes
                    <textarea
                      value={question.sourceNotes}
                      onChange={(e) =>
                        setQuestion({
                          ...question,
                          sourceNotes: e.target.value,
                        })
                      }
                      required
                    />
                  </label>
                </>
              )}
              {kind === "chapters" && (
                <>
                  <label>
                    Chapter key
                    <input
                      value={chapter.slug}
                      onChange={(e) =>
                        setChapter({ ...chapter, slug: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    Title
                    <input
                      value={chapter.title}
                      onChange={(e) =>
                        setChapter({ ...chapter, title: e.target.value })
                      }
                      required
                    />
                  </label>
                  <label>
                    Position
                    <input
                      type="number"
                      min="1"
                      value={chapter.position}
                      onChange={(e) =>
                        setChapter({
                          ...chapter,
                          position: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Track
                    <select
                      value={chapter.level}
                      onChange={(e) =>
                        setChapter({ ...chapter, level: e.target.value })
                      }
                    >
                      {["COMMON", "PROFESSIONAL", "SUBPROFESSIONAL"].map(
                        (v) => (
                          <option key={v}>{v}</option>
                        ),
                      )}
                    </select>
                  </label>
                </>
              )}
              <button className="button" disabled={!editable || busy}>
                {busy
                  ? "Saving…"
                  : selected
                    ? "Save draft changes"
                    : "Create draft"}
              </button>
            </fieldset>
          </form>
          {selected && kind !== "chapters" && (
            <div className="review-panel">
              <h3>Review and publication</h3>
              <p>
                Status: <strong>{selected.status}</strong> · Revision{" "}
                {selected.revision}
              </p>
              <label>
                Review notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe the factual, source and answer checks you performed."
                />
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{" "}
                I independently checked correctness, originality and
                authoritative sources where needed.
              </label>
              <div className="actions">
                {selected.status === "DRAFT" &&
                  selected.authorId === actor.id &&
                  writer && (
                    <button
                      className="button"
                      onClick={() => void send("submit")}
                      disabled={busy}
                    >
                      Submit for review
                    </button>
                  )}
                {selected.status === "IN_REVIEW" &&
                  selected.authorId !== actor.id &&
                  ["ADMIN", "REVIEWER"].includes(actor.role) && (
                    <>
                      <button
                        className="button"
                        onClick={() => void send("approve")}
                        disabled={busy}
                      >
                        Approve reviewed version
                      </button>
                      <button
                        className="button button-light"
                        onClick={() => void send("reject")}
                        disabled={busy}
                      >
                        Return to draft
                      </button>
                    </>
                  )}
                {selected.status === "APPROVED" && actor.role === "ADMIN" && (
                  <button
                    className="button"
                    onClick={() => void send("publish")}
                    disabled={busy}
                  >
                    Publish approved version
                  </button>
                )}
                {selected.status !== "ARCHIVED" &&
                  (actor.role === "ADMIN" ||
                    (writer &&
                      selected.authorId === actor.id &&
                      selected.status === "DRAFT")) && (
                    <button
                      className="button button-light"
                      onClick={() => void send("archive")}
                      disabled={busy}
                    >
                      Archive version
                    </button>
                  )}
              </div>
            </div>
          )}
          {kind === "chapters" && selected && writer && (
            <button
              className="button button-light"
              onClick={() => void send("delete")}
            >
              Delete empty chapter
            </button>
          )}
          <p className="feedback" role="status">
            {message}
          </p>
        </section>
      </div>
      {kind === "questions" && (
        <section className="editor-panel">
          <h2>Import and export</h2>
          <p>
            Imports are atomic, validated and always create new DRAFT versions.
            Up to 100 questions per batch. CSV columns: key, prompt, topic,
            level, difficulty, sourceNotes, explanation, optionA–optionD,
            correctLabel.
          </p>
          <div className="actions">
            <Link
              prefetch={false}
              download="questions.json"
              className="text-link"
              href="/api/admin/questions/transfer?format=json"
            >
              Export JSON ↓
            </Link>
            <Link
              prefetch={false}
              download="questions.csv"
              className="text-link"
              href="/api/admin/questions/transfer?format=csv"
            >
              Export CSV ↓
            </Link>
          </div>
          {writer && (
            <>
              <label>
                Format
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </label>
              <label>
                Paste question data
                <textarea
                  className="large-textarea"
                  value={transfer}
                  onChange={(e) => setTransfer(e.target.value)}
                />
              </label>
              <button
                className="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await fetch("/api/admin/questions/transfer", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "X-CSC-Action": "1",
                      },
                      body: JSON.stringify({ format, data: transfer }),
                    });
                    const result = await r.json();
                    setMessage(
                      r.ok
                        ? `Imported ${result.created} draft question(s).`
                        : result.error,
                    );
                    if (r.ok) await refresh();
                  } catch {
                    setMessage("Import failed.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Validate and import drafts
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
