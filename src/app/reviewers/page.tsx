import Link from "next/link";
import ReviewerLibrary from "@/components/reviewer-library";
import Storefront from "@/components/storefront";
import { draftLessons } from "@/lib/lesson-catalog";
import { reviewerSupplements } from "@/lib/reviewer-supplements";
import { reviewerGuides } from "@/lib/reviewer-catalog";
import { practiceSetCount, practiceSetSize } from "@/lib/practice-series-policy";
export const metadata = { title: "Free subject reviewers", description: "Read free CSC preparation study guides with explanations, worked examples, paper practice and printable pages." };
export default function Reviewers() {
  return <section className="shell section page-content reviewer-hub">
    <div className="reviewer-hero"><div><p className="eyebrow">READ. UNDERSTAND. TRY AGAIN.</p><h1>A reviewer for every step forward.</h1><p className="lead">Build your foundation with clear explanations, worked examples and practice you can think through at your own pace.</p>
      <div className="actions"><a className="button" href="#subject-reviewers">Explore the reviewers ↓</a><Link className="text-link" href="/practice/sets">Open the five practice sets →</Link></div>
      <p className="reviewer-hero-note">Free online reading · No account needed · Printable guides</p>
    </div><aside className="reviewer-start" aria-label="How to use the reviewers"><p className="eyebrow">A SMALL ROUTINE, REPEATED</p><h2>Learn it. <br />Try it. <br /><em>Make it stick.</em></h2><ol><li>Read a subject guide and follow its examples.</li><li>Try the paper exercises before reading the rationale.</li><li>Use a practice set, then revisit the topics you missed.</li></ol></aside></div>
    <dl className="reviewer-stats"><div><dt>Subject reviewers</dt><dd>{reviewerGuides.length}</dd></div><div><dt>Learning chapters</dt><dd>{draftLessons.length + reviewerSupplements.length}</dd></div><div><dt>Practice questions across {practiceSetCount} sets</dt><dd>{practiceSetCount * practiceSetSize}</dd></div></dl>
    <p className="notice">These free guides and proposed solutions are unreviewed teaching drafts. They may contain errors. This is independent, unofficial study material; official 2027 coverage remains unverified.</p>
    <ReviewerLibrary />
    <section className="reviewer-next" aria-labelledby="reviewer-next-title"><div><p className="eyebrow">PUT THE METHOD INTO PRACTICE</p><h2 id="reviewer-next-title">Ready to try what you learned?</h2><p>Each of the five sets contains 160 questions. Sign in to save your answers, finish a set and unlock the next. Proposed keys and explanations appear after submission.</p></div><div className="actions"><Link className="button" href="/practice/sets">Start your practice journey →</Link><Link className="text-link" href="/study-plan">Build a study plan →</Link></div></section>
    <section id="pdf-editions" className="reviewer-editions" aria-labelledby="reviewer-editions-title"><p className="eyebrow">DOWNLOADABLE EDITIONS</p><h2 id="reviewer-editions-title">PDF editions and your library.</h2><p>The online guides above are free to read and print. Separately released PDF editions and existing orders appear here when available.</p><Storefront /></section>
  </section>;
}
