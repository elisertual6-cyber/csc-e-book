import Link from "next/link";
import { draftLessons } from "@/lib/lesson-catalog";
export const metadata = { title: "Free draft lessons" };
export default function Lessons() {
  return (
    <section className="shell section page-content">
      <div className="eyebrow">LEARN ONE IDEA AT A TIME</div>
      <h1>Free draft lessons.</h1>
      <p className="lead">Build English language and numerical skills with explanations, worked examples and paper practice. No account needed.</p>
      <div className="notice">All {draftLessons.length} lessons are original editorial drafts awaiting independent review. Solutions are included for learning. These are ungraded previews, not official CSC questions or a complete reviewer; official 2027 coverage remains unverified.</div>
      <div className="commerce-grid">
        {draftLessons.map((lesson, index) => (
          <article className="panel lesson-card" key={lesson.slug}>
            <span className="eyebrow">LESSON {index + 1} · DRAFT · COMMON FOUNDATION</span>
            <h2>{lesson.title}</h2>
            <p>{lesson.summary}</p>
            <Link className="text-link" href={`/lessons/${lesson.slug}`}>Read lesson: {lesson.title} →</Link>
          </article>
        ))}
      </div>
      <Link className="text-link" href="/curriculum">View the full provisional curriculum →</Link>
    </section>
  );
}
