"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { reviewerGuides, reviewerLessonTitle, reviewerTrackLabel } from "@/lib/reviewer-catalog";
const volumes = ["I", "II", "III", "IV", "V", "VI"];
export default function ReviewerLibrary() {
  const searchInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [track, setTrack] = useState("all");
  const term = query.trim().toLowerCase();
  const visible = reviewerGuides.filter(guide => (track === "all" || guide.track === "COMMON" || guide.track === track) &&
    `${guide.title} ${guide.summary} ${guide.lessons.map(reviewerLessonTitle).join(" ")}`.toLowerCase().includes(term));
  return <section id="subject-reviewers" className="reviewer-library" aria-labelledby="reviewer-library-title">
    <div className="reviewer-section-heading"><div><p className="eyebrow">YOUR STUDY SHELF</p><h2 id="reviewer-library-title">Find a subject. Build your foundation.</h2></div><p>Read online for free. Print a guide when you need a paper copy.</p></div>
    <div className="reviewer-filters">
      <div><label htmlFor="reviewer-search">Search reviewers</label><input id="reviewer-search" ref={searchInput} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try percentages, grammar or Filipino" /></div>
      <div><label htmlFor="reviewer-track">Study track</label><select id="reviewer-track" value={track} onChange={event => setTrack(event.target.value)}><option value="all">All reviewers</option><option value="PROFESSIONAL">Professional</option><option value="SUBPROFESSIONAL">Subprofessional</option></select></div>
    </div>
    <p className="reviewer-result-count" role="status">{visible.length} {visible.length === 1 ? "reviewer" : "reviewers"} available</p>
    <div className="reviewer-grid">{visible.map(guide => <article className="reviewer-card" key={guide.slug}>
      <div className="reviewer-cover" aria-hidden="true"><span>CSC STUDY · SUBJECT REVIEWER</span><span className="reviewer-volume">{volumes[reviewerGuides.findIndex(item => item.slug === guide.slug)]}</span><span>{guide.subtitle}</span></div>
      <div className="reviewer-card-body"><p className="eyebrow">{reviewerTrackLabel(guide.track)} · {guide.lessons.length} LESSONS</p><h3>{guide.title}</h3><p>{guide.summary}</p>
        <ul className="reviewer-topics">{guide.lessons.map(slug => <li key={slug}>{reviewerLessonTitle(slug)}</li>)}</ul>
        <Link className="button" href={`/reviewers/${guide.slug}`}>Open {guide.title} reviewer →</Link>
        <span className="fine-print">FREE · UNREVIEWED TEACHING DRAFT</span>
      </div>
    </article>)}</div>
    {visible.length === 0 && <div className="reviewer-empty"><h3>No matching reviewers.</h3><p>Try another subject or reset the filters to see all six guides.</p><button className="button button-light" onClick={() => { setQuery(""); setTrack("all"); searchInput.current?.focus(); }}>Reset reviewer filters</button></div>}
  </section>;
}
