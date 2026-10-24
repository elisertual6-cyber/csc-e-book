"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buildStudyPlan, newPlanner, planDate, plannerStorageKey, readSavedPlanner, sessionBudget, type PlannerState, type StudyMinutes, type StudyTrack } from "@/lib/study-plan";

async function persistPlanner(plan: PlannerState, enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(plannerStorageKey, JSON.stringify(plan));
    else localStorage.removeItem(plannerStorageKey);
    return true;
  } catch { return false; }
}

export default function StudyPlanner() {
  const [plan, setPlan] = useState(newPlanner);
  const [save, setSave] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [message, setMessage] = useState("");
  useEffect(() => {
    async function restore() {
      try {
        const raw = localStorage.getItem(plannerStorageKey);
        const saved = readSavedPlanner(raw);
        if (saved) { setPlan(saved); setSave(true); }
        else if (raw) setMessage("The saved plan could not be read. A fresh plan is ready.");
      } catch {
        setStorageOk(false);
        setMessage("Browser saving is unavailable. You can still use and print this plan.");
      }
      setReady(true);
    }
    void restore();
  }, []);
  useEffect(() => {
    if (!ready || !storageOk) return;
    let current = true;
    void persistPlanner(plan, save).then(ok => {
      if (current && !ok) {
        setStorageOk(false);
        setMessage("Browser saving is unavailable. Use print and manage saved data in your browser settings.");
      }
    });
    return () => { current = false; };
  }, [plan, save, ready, storageOk]);
  const days = buildStudyPlan(plan.track);
  const selected = days[plan.day - 1];
  const done = plan.completed[plan.track];
  const budget = sessionBudget(plan.minutes);
  const trackLabel = plan.track === "PROFESSIONAL" ? "Professional" : "Subprofessional";
  function toggleComplete() {
    setPlan(previous => {
      const completed = previous.completed[previous.track];
      return { ...previous, completed: { ...previous.completed, [previous.track]: completed.includes(previous.day) ? completed.filter(d => d !== previous.day) : [...completed, previous.day] } };
    });
  }
  return (
    <div className="study-planner">
      <fieldset className="planner-controls" disabled={!ready}>
        <legend>Make this plan yours</legend>
        <div className="planner-fields">
          <label>Learning track<select value={plan.track} onChange={e => setPlan(p => ({ ...p, track: e.target.value as StudyTrack }))}><option value="PROFESSIONAL">Professional</option><option value="SUBPROFESSIONAL">Subprofessional</option></select></label>
          <label>Daily study time<select value={plan.minutes} onChange={e => setPlan(p => ({ ...p, minutes: Number(e.target.value) as StudyMinutes }))}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></label>
          <label>Start date (optional)<input type="date" value={plan.startDate} onChange={e => setPlan(p => ({ ...p, startDate: e.target.value }))} /></label>
        </div>
        <label className="planner-save"><input type="checkbox" checked={save} disabled={!storageOk} onChange={e => { setSave(e.target.checked); setMessage(""); }} /> Save progress on this browser</label>
        <p className="fine-print">Keep this off on a shared device. Without saving, progress lasts until you reload. Turning it off removes this planner’s saved settings and completed days.</p>
      </fieldset>
      <p className="planner-summary">{trackLabel} · {plan.minutes} minutes per study day · <strong>{done.length} of 30 days marked complete</strong></p>
      <p role="status">{message}</p>
      <div className="planner-day-grid" role="group" aria-label="Choose a study day">
        {days.map(day => <button type="button" key={day.day} disabled={!ready} aria-pressed={plan.day === day.day} aria-label={`Day ${day.day}${done.includes(day.day) ? ", complete" : ""}`} onClick={() => setPlan(p => ({ ...p, day: day.day }))}>Day {day.day}{done.includes(day.day) && <span aria-hidden="true"> ✓</span>}</button>)}
      </div>
      <section className="panel planner-detail" aria-labelledby="planner-day-title">
        <div aria-live="polite" aria-atomic="true">
          <p className="eyebrow">DAY {selected.day}{planDate(plan.startDate, selected.day) && ` · ${planDate(plan.startDate, selected.day)}`}</p>
          <h2 id="planner-day-title">{selected.title}</h2>
          <p>{selected.description}</p>
        </div>
        {selected.kind !== "catch-up" && <p className="planner-budget">Suggested session: {budget.start} minutes to recall or prepare, {budget.focus} minutes to focus, {budget.check} minutes to check and note next steps.</p>}
        {!!selected.lessons.length && <ul className="planner-lessons">{selected.lessons.map(lesson => <li key={lesson.slug}><Link className="text-link" href={`/lessons/${lesson.slug}`}>Open draft: {lesson.title} →</Link></li>)}</ul>}
        <div className="actions"><button type="button" className="button" disabled={!ready} aria-pressed={done.includes(plan.day)} onClick={toggleComplete}>{done.includes(plan.day) ? "Mark day incomplete" : "Mark day complete"}</button><button type="button" className="button button-light" disabled={!ready || plan.day === 30} onClick={() => setPlan(p => ({ ...p, day: p.day + 1 }))}>Next day →</button></div>
      </section>
      <div className="planner-help"><button type="button" className="button button-light" disabled={!ready} onClick={() => window.print()}>Print 30-day plan</button><p className="fine-print">A completion mark records your own study activity. It is not a score, reviewed content or a prediction of exam performance. Each track keeps separate completion marks.</p></div>
      <section className="planner-print" aria-label="Printable 30-day schedule">
        <h2>{trackLabel} study plan</h2>
        <p>{plan.minutes} minutes per study day. Adjust the schedule to your needs. All linked lessons are unapproved drafts; official coverage remains unverified.</p>
        <table><thead><tr><th scope="col">Day</th><th scope="col">Date</th><th scope="col">Focus</th><th scope="col">Completed</th></tr></thead><tbody>{days.map(day => <tr key={day.day}><td>{day.day}</td><td>{planDate(plan.startDate, day.day) || "—"}</td><td>{day.title}</td><td>{done.includes(day.day) ? "Yes" : "—"}</td></tr>)}</tbody></table>
      </section>
    </div>
  );
}
