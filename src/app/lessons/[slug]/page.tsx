import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { draftLessons, findDraftLesson } from "@/lib/lesson-catalog";
import { readDraftLesson } from "@/lib/lesson-content";
type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return draftLessons.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: Props) {
  const lesson = findDraftLesson((await params).slug);
  if (!lesson) notFound();
  return { title: `${lesson.title} — draft lesson`, description: lesson.summary };
}
export default async function Lesson({ params }: Props) {
  const lesson = await readDraftLesson((await params).slug);
  if (!lesson) notFound();
  const index = draftLessons.findIndex(item => item.slug === lesson.slug);
  const previous = draftLessons[index - 1];
  const next = draftLessons[index + 1];
  return (
    <section className="shell section page-content">
      <div className="lesson-header">
        <Link className="text-link" href="/reviewers">← All reviewers</Link>
        <span className="status-pill">DRAFT · NOT EDITORIALLY APPROVED</span>
      </div>
      <div className="notice">Free editorial preview with worked solutions. This lesson is awaiting independent review and is not part of a graded exam or a released paid edition.</div>
      <p className="eyebrow">{lesson.track === "COMMON" ? "SHARED FOUNDATION" : `${lesson.track} TRACK`} · PROVISIONAL CURRICULUM</p>
      <article className="prose"><ReactMarkdown skipHtml components={{ img: () => null }}>{lesson.markdown}</ReactMarkdown></article>
      <div className="lesson-end">
        <h2>Choose your next step.</h2>
        <nav className="lesson-navigation" aria-label="Lesson navigation">
          {previous && <Link className="text-link" href={`/lessons/${previous.slug}`}>← Previous: {previous.title}</Link>}
          {next && <Link className="text-link" href={`/lessons/${next.slug}`}>Next: {next.title} →</Link>}
        </nav>
        <p>Try the ungraded arithmetic exercise or return to the lesson library. Worked examples do not create an exam score or saved progress.</p>
        <div className="actions"><Link className="button" href="/practice">Open practice studio →</Link><Link className="text-link" href="/reviewers">All reviewers</Link></div>
      </div>
    </section>
  );
}
