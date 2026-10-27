"use client";
import { useEffect, useState } from "react";
type Template = {
  id: string;
  slug: string;
  title: string;
  level: string;
  mode: string;
  access: string;
  topics: string[];
  questionCount: number;
  durationSeconds: number;
  version: number;
  active: boolean;
  seriesKey?: string | null;
};
const empty = {
  slug: "",
  title: "",
  level: "PROFESSIONAL",
  mode: "PRACTICE",
  access: "PREMIUM",
  topics: [],
  questionCount: 10,
  durationSeconds: 900,
};
export default function ExamTemplateStudio() {
  const [rows, setRows] = useState<Template[]>([]),
    [selected, setSelected] = useState<Template | null>(null),
    [form, setForm] =
      useState<Omit<Template, "id" | "version" | "active">>(empty),
    [topics, setTopics] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/exam-templates", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (active) {
          if (r.ok) setRows(data);
          else setMessage(data.error);
        }
      })
      .catch(() => setMessage("Unable to load templates."));
    return () => {
      active = false;
    };
  }, []);
  async function change(action: string) {
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        ...form,
        topics: topics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const r = await fetch("/api/admin/exam-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSC-Action": "1" },
        body: JSON.stringify({
          action,
          ...(action === "create"
            ? {}
            : { id: selected?.id, version: selected?.version }),
          ...(action === "create" || action === "save"
            ? { data: payload }
            : {}),
        }),
      });
      const data = await r.json();
      if (!r.ok) setMessage(data.error);
      else {
        setSelected(data);
        setForm({
          slug: data.slug,
          title: data.title,
          level: data.level,
          mode: data.mode,
          access: data.access,
          topics: data.topics,
          questionCount: data.questionCount,
          durationSeconds: data.durationSeconds,
        });
        setTopics(data.topics.join(", "));
        setMessage(
          data.active
            ? "Template activated with reviewed question availability checked."
            : "Saved inactive. Activate only after confirming reviewed content and intended access.",
        );
        const list = await fetch("/api/admin/exam-templates", {
          cache: "no-store",
        });
        if (list.ok) setRows(await list.json());
      }
    } catch {
      setMessage("Unable to save the template.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="studio-grid">
      <aside className="record-list">
        <h2>Exam templates</h2>
        {rows.map((t) => (
          <button
            className="record"
            key={t.id}
            onClick={() => {
              setSelected(t);
              setForm({
                slug: t.slug,
                title: t.title,
                level: t.level,
                mode: t.mode,
                access: t.access,
                topics: t.topics,
                questionCount: t.questionCount,
                durationSeconds: t.durationSeconds,
              });
              setTopics(t.topics.join(", "));
              setMessage("");
            }}
          >
            <strong>{t.title}</strong>
            <span>
              {t.mode} · {t.access} · v{t.version} ·{" "}
              {t.active ? "ACTIVE" : "INACTIVE"}
            </span>
          </button>
        ))}
      </aside>
      <section className="editor-panel">
        <h2>
          {selected ? "Configure this template" : "Create an exam template"}
        </h2>
        <button
          className="button button-light"
          onClick={() => {
            setSelected(null);
            setForm(empty);
            setTopics("");
            setMessage("");
          }}
        >
          New template
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void change(selected ? "save" : "create");
          }}
        >
          {selected?.seriesKey && <p className="notice">This set has 160 fixed questions. Its membership and order are preserved. An explicit unreviewed-practice release can activate it while preserving its draft editorial status.</p>}
          <fieldset disabled={busy || !!selected?.seriesKey}>
            <legend>Session settings</legend>
          <label>
            Template key
            <input
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </label>
          <label>
            Title
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Track
            <select
              value={form.level}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            >
              <option value="COMMON" disabled>Mixed skills (fixed practice set)</option>
              <option value="PROFESSIONAL">Professional</option>
              <option value="SUBPROFESSIONAL">Subprofessional</option>
            </select>
          </label>
          <label>
            Mode
            <select
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
            >
              <option value="PRACTICE">Topic practice</option>
              <option value="MOCK">Timed mock examination</option>
            </select>
          </label>
          <label>
            Access
            <select
              value={form.access}
              onChange={(e) => setForm({ ...form, access: e.target.value })}
            >
              <option value="PREMIUM">
                Purchased exam entitlement required
              </option>
              <option value="FREE">
                Free reviewed session for signed-in learners
              </option>
            </select>
          </label>
          <label>
            Topic keys (comma separated; empty includes all eligible topics)
            <input value={topics} onChange={(e) => setTopics(e.target.value)} />
          </label>
          <label>
            Question count (1–200)
            <input
              type="number"
              min="1"
              max="200"
              required
              value={form.questionCount}
              onChange={(e) =>
                setForm({ ...form, questionCount: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Duration in seconds (0 = untimed practice; otherwise 60–14400)
            <input
              type="number"
              min="0"
              max="14400"
              required
              value={form.durationSeconds}
              onChange={(e) =>
                setForm({ ...form, durationSeconds: Number(e.target.value) })
              }
            />
          </label>
          </fieldset>
          <div className="actions">
            <button className="button" disabled={busy || !!selected?.seriesKey}>
              {selected
                ? "Save as inactive new version"
                : "Create inactive template"}
            </button>
            {selected && (
              <button
                className="button button-light"
                type="button"
                disabled={busy}
                onClick={() =>
                  void change(selected.active ? "deactivate" : "activate")
                }
              >
                {selected.active ? "Deactivate" : "Activate reviewed template"}
              </button>
            )}
          </div>
        </form>
        <p className="notice">
          Counts and durations are illustrative practice settings, not official
          2027 specifications. Saving changes deactivates the template. Existing
          attempts retain their original settings and question snapshots.
        </p>
        <p className="feedback" role="status">
          {message}
        </p>
      </section>
    </div>
  );
}
