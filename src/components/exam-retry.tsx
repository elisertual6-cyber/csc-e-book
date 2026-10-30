"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AttemptView } from "@/lib/exam-types";
type Selection = "missed" | "incorrect" | "unanswered";
export default function ExamRetry({ id, result }: { id: string; result: NonNullable<AttemptView["result"]> }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>("missed");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const request = useRef<{ selection: Selection; startKey: string } | null>(null);
  const incorrect = result.answers.filter(answer => answer.selectedLabel !== null && !answer.isCorrect).length;
  const unanswered = result.answers.filter(answer => answer.selectedLabel === null).length;
  if (incorrect + unanswered === 0) return <p className="fine-print">Every question was correct. There are no missed questions to retry.</p>;
  return <section className="exam-retry" aria-labelledby="retry-title"><h3 id="retry-title">Practise what you missed</h3>
    <p>Start an untimed session with the questions you want to revisit. Your original result and five-set progress are kept.</p>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setMessage("");
      if (request.current?.selection !== selection) request.current = { selection, startKey: crypto.randomUUID() };
      try {
        const response = await fetch(`/api/exams/attempts/${id}/retry`, { method: "POST", headers: { "Content-Type": "application/json", "X-CSC-Action": "1" }, body: JSON.stringify(request.current) });
        const data = await response.json();
        if (response.ok) router.push(`/practice/${data.id}`);
        else setMessage(data.error);
      } catch { setMessage("The start could not be confirmed. Retry the same selection or check your saved history."); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="retry-selection">Questions to retry</label><select id="retry-selection" value={selection} disabled={busy} onChange={event => setSelection(event.target.value as Selection)}>
        <option value="missed">Incorrect and unanswered ({incorrect + unanswered})</option>
        <option value="incorrect" disabled={!incorrect}>Incorrect only ({incorrect})</option>
        <option value="unanswered" disabled={!unanswered}>Unanswered only ({unanswered})</option>
      </select>
      <button className="button" disabled={busy}>{busy ? "Starting…" : "Start focused practice"}</button>
    </form>
    <p className="fine-print">Answers and explanations appear after you submit the new session.</p><p role="status" aria-label="Focused practice start">{message}</p>
  </section>;
}
