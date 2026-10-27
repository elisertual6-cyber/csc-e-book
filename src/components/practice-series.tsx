"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SeriesProgress } from "@/lib/practice-series-policy";
const descriptions = {
  not_prepared: "This set is being prepared.",
  awaiting_review: "Available after independent content review and release.",
  locked: "Finish and submit every earlier set to unlock this one.",
  available: "Ready to start. Your answers will be saved to your account.",
  in_progress: "Continue from your saved answers.",
  completed: "Completed. The next released set is now unlocked.",
};
export default function PracticeSeries() {
  const router = useRouter();
  const [progress, setProgress] = useState<SeriesProgress | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const keys = useRef<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    fetch("/api/exams/series", { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (active) { if (response.ok) setProgress(data); else setMessage(data.error); }
    }).catch(() => { if (active) setMessage("Could not load your sets. Reload to try again."); });
    return () => { active = false; };
  }, []);
  async function start(templateId: string) {
    setBusy(true); setMessage("");
    keys.current[templateId] ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/exams/attempts", {
        method: "POST", headers: { "Content-Type": "application/json", "X-CSC-Action": "1" },
        body: JSON.stringify({ templateId, startKey: keys.current[templateId] }),
      });
      const data = await response.json();
      if (response.ok) router.push(`/practice/${data.id}`);
      else setMessage(data.error);
    } catch { setMessage("The start could not be confirmed. Retry this set, or check your saved history."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Your five practice sets">
    <p className="feedback" role="status">{message || (!progress ? "Loading your sets…" : `${progress.completedSets} of ${progress.totalSets} sets completed`)}</p>
    {progress && <ol className="practice-set-list">{progress.sets.map(set => <li key={set.position} className="exam-panel">
      <p className="eyebrow">SET {set.position} OF {progress.totalSets} · {set.questionCount} QUESTIONS</p>
      <h2>{set.title}</h2>
      <p>{set.position === progress.totalSets && set.state === "completed" ? "All five sets are complete. You can review your answers in your history." : descriptions[set.state]}</p>
      {(set.state === "in_progress" || set.state === "completed") && <p>{set.answered} of {set.questionCount} answered</p>}
      {set.attemptId ? <Link className="button" href={`/practice/${set.attemptId}`}>Resume Set {set.position}</Link>
        : set.templateId && (set.state === "available" || set.state === "completed")
          ? <button className="button" disabled={busy} onClick={() => void start(set.templateId!)}>{busy ? "Starting…" : set.state === "completed" ? `Practise Set ${set.position} again` : `Start Set ${set.position}`}</button>
          : <button className="button button-light" disabled>{set.state === "locked" ? `Set ${set.position} locked` : `Set ${set.position} not yet released`}</button>}
    </li>)}</ol>}
    <Link className="text-link" href="/practice/history">Your saved attempts and answer reviews →</Link>
  </section>;
}
