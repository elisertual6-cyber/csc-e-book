"use client";
import { useId, useRef, useState } from "react";
import { curriculum } from "@/lib/curriculum";
import type { AttemptView } from "@/lib/exam-types";

type Props = Pick<AttemptView, "questions" | "responses"> & { result: NonNullable<AttemptView["result"]> };
const categories = ["All answers", "Incorrect", "Unanswered", "Correct", "Flagged"] as const;
type Category = typeof categories[number];
const subjectTitle = (topic: string) => curriculum.find(subject => subject.slug === topic)?.title ?? topic;

// Mounted only after the server has finalized and released this attempt's result.
export default function ExamAnswerReview({ questions, responses, result }: Props) {
  const [category, setCategory] = useState<Category>("All answers");
  const [topic, setTopic] = useState("");
  const [query, setQuery] = useState("");
  const categoryControl = useRef<HTMLSelectElement>(null);
  const id = useId();
  const answers = new Map(result.answers.map(answer => [answer.questionKey, answer]));
  const flagged = new Set(responses.filter(response => response.flagged).map(response => response.questionKey));
  const rows = questions.flatMap((question, index) => {
    const answer = answers.get(question.questionKey);
    if (!answer) return [];
    const outcome = answer.selectedLabel === null ? "Unanswered" : answer.isCorrect ? "Correct" : "Incorrect";
    return [{ question, answer, number: index + 1, outcome, flagged: flagged.has(question.questionKey),
      selected: question.choices.find(choice => choice.label === answer.selectedLabel),
      correct: question.choices.find(choice => choice.label === answer.correctLabel) }];
  });
  const topics = [...new Set(rows.map(row => row.question.topic))].sort((a, b) => subjectTitle(a).localeCompare(subjectTitle(b)));
  const matchesCategory = (row: typeof rows[number], selection: Category) => selection === "All answers" ||
    (selection === "Flagged" ? row.flagged : row.outcome === selection);
  const term = query.trim().toLocaleLowerCase();
  const visible = rows.filter(row => matchesCategory(row, category) && (!topic || row.question.topic === topic) &&
    (!term || `${row.question.prompt} ${row.selected?.text ?? ""} ${row.correct?.text ?? ""} ${row.answer.explanation}`.toLocaleLowerCase().includes(term)));
  function reset() {
    setCategory("All answers"); setTopic(""); setQuery("");
    categoryControl.current?.focus();
  }
  return <section className="answer-review-section" aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Answers and detailed explanations</h3>
    <p className="fine-print">Focus on the answers you want to revisit. Filters change this review, not your saved result.</p>
    <div className="answer-review-controls">
      <div><label htmlFor={`${id}-category`}>Answer category</label><select id={`${id}-category`} ref={categoryControl} value={category} onChange={event => setCategory(event.target.value as Category)}>
        {categories.map(value => <option key={value} value={value}>{value} ({rows.filter(row => matchesCategory(row, value)).length})</option>)}
      </select></div>
      <div><label htmlFor={`${id}-subject`}>Review subject</label><select id={`${id}-subject`} value={topic} onChange={event => setTopic(event.target.value)}>
        <option value="">All subjects</option>{topics.map(value => <option key={value} value={value}>{subjectTitle(value)}</option>)}
      </select></div>
      <div className="answer-review-search"><label htmlFor={`${id}-search`}>Search this review</label><input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Question, answer or explanation" /></div>
    </div>
    <div className="answer-review-summary"><p role="status" aria-label="Review filter results">Showing {visible.length} of {rows.length} answers</p><button className="button button-light" onClick={reset}>Reset review filters</button></div>
    {visible.length === 0 && <p className="notice">No answers match these filters. Try another category, subject or search, or reset the filters.</p>}
    {visible.map(row => <article className="answer-review" key={row.question.questionKey}>
      <p className="answer-review-outcome">{row.outcome}{row.flagged ? " · Flagged for review" : ""} · {subjectTitle(row.question.topic)}</p>
      <h4>{row.number}. {row.question.prompt}</h4>
      <p>Your answer: {row.answer.selectedLabel ?? "Unanswered"}{row.selected && <> — {row.selected.text}</>}</p>
      <p><strong>Correct answer: {row.answer.correctLabel}{row.correct && <> — {row.correct.text}</>}</strong></p>
      <p>{row.answer.explanation}</p>
      <p className="fine-print">Source notes: {row.answer.sourceNotes}</p>
    </article>)}
  </section>;
}
