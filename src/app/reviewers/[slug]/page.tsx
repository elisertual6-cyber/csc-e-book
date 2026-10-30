import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import ReviewerPrint from "@/components/reviewer-print";
import { ReviewerBookmarkButton, ReviewerBookmarks } from "@/components/reviewer-bookmarks";
import { reviewerGuides, findReviewerGuide, reviewerLessonTitle, reviewerTrackLabel } from "@/lib/reviewer-catalog";
import { readDraftLesson } from "@/lib/lesson-content";
import { readReviewerSupplement } from "@/lib/reviewer-supplement-content";
type Props = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export function generateStaticParams() { return reviewerGuides.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: Props) {
  const guide = findReviewerGuide((await params).slug);
  if (!guide) notFound();
  return { title: `${guide.title} — free reviewer`, description: guide.summary };
}
export default async function Reviewer({ params }: Props) {
  const guide = findReviewerGuide((await params).slug);
  if (!guide) notFound();
  const lessons = await Promise.all(guide.lessons.map(slug => readDraftLesson(slug)));
  if (lessons.some(lesson => !lesson)) notFound();
  const supplement = await readReviewerSupplement(guide.slug);
  const chapterCount = lessons.length + (supplement ? 1 : 0);
  const position = reviewerGuides.findIndex(item => item.slug === guide.slug);
  const next = reviewerGuides[position + 1];
  return <section className="shell section page-content reviewer-reader">
    <div className="lesson-header reviewer-screen-only"><Link className="text-link" href="/reviewers">← All reviewers</Link><ReviewerPrint /></div>
    <header className="reviewer-reader-header"><p className="eyebrow">CSC STUDY · {reviewerTrackLabel(guide.track)} · {chapterCount} LESSONS</p><h1>{guide.title}</h1><p className="lead">{guide.summary}</p><p className="notice">UNREVIEWED TEACHING DRAFT · Free, independent and unofficial. These explanations and proposed solutions may contain errors and have not received independent editorial approval. Official 2027 coverage remains unverified.</p></header>
    <div className="reviewer-reading-layout"><aside className="reviewer-toc"><nav aria-label="Reviewer contents"><h2>In this reviewer</h2><ol>{guide.lessons.map(slug => <li key={slug}><a href={`#${slug}`}>{reviewerLessonTitle(slug)}</a></li>)}{supplement && <li><a href="#extra-practice">Extra lesson: {supplement.title}</a></li>}</ol></nav><Link className="text-link reviewer-screen-only" href="/practice/sets">Try the practice sets →</Link><ReviewerBookmarks guide={guide.slug} /></aside>
      <div className="reviewer-chapters">{lessons.map((lesson, index) => lesson && <section className="reviewer-chapter" id={lesson.slug} key={lesson.slug} aria-labelledby={`title-${lesson.slug}`} lang={lesson.slug === "filipino" ? "fil" : "en"}>
        <p className="eyebrow">CHAPTER {index + 1} OF {chapterCount}</p><h2 id={`title-${lesson.slug}`}>{reviewerLessonTitle(lesson.slug)}</h2><p className="reviewer-chapter-subtitle">{lesson.title}</p>
        <ReviewerBookmarkButton guide={guide.slug} chapter={lesson.slug} />
        <article className="prose reviewer-prose"><ReactMarkdown skipHtml components={{ img: () => null, h2: ({ children }) => <h3>{children}</h3>, h3: ({ children }) => <h4>{children}</h4> }}>{lesson.markdown.split("\n").slice(1).join("\n").trim()}</ReactMarkdown></article>
        <p className="reviewer-screen-only"><Link className="text-link" href={`/lessons/${lesson.slug}`}>Open this lesson on its own →</Link></p>
      </section>)}
      {supplement && <section className="reviewer-chapter reviewer-supplement" id="extra-practice" aria-labelledby="supplement-title">
        <p className="eyebrow">CHAPTER {chapterCount} OF {chapterCount} · EXTRA PRACTICE</p><h2 id="supplement-title">{supplement.title}</h2>
        <ReviewerBookmarkButton guide={guide.slug} chapter="extra-practice" />
        <article className="prose reviewer-prose"><ReactMarkdown skipHtml components={{ img: () => null, h2: ({ children }) => <h3>{children}</h3>, h3: ({ children }) => <h4>{children}</h4> }}>{supplement.markdown.split("\n").slice(1).join("\n").trim()}</ReactMarkdown></article>
      </section>}
      <section className="reviewer-checkpoints" aria-labelledby="reviewer-checkpoint-title"><p className="eyebrow">BEFORE YOU MOVE ON</p><h2 id="reviewer-checkpoint-title">Keep these ideas with you.</h2><ul>{guide.keyIdeas.map(idea => <li key={idea}>{idea}</li>)}</ul><p>Try explaining one method in your own words, then check your reasoning against the worked example.</p></section>
      <section className="reviewer-reader-end reviewer-screen-only"><h2>Turn reading into practice.</h2><p>Your reading does not create a score or complete a practice set. Sign in to the practice studio to save answers and review your results.</p><div className="actions"><Link className="button" href="/practice/sets">Open the five practice sets →</Link><Link className="text-link" href="/study-plan">Plan your next study session →</Link></div><nav className="lesson-navigation" aria-label="Reviewer navigation"><Link className="text-link" href="/reviewers">← All reviewers</Link>{next && <Link className="text-link" href={`/reviewers/${next.slug}`}>Next reviewer: {next.title} →</Link>}</nav></section>
      </div>
    </div>
  </section>;
}
