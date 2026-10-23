import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { chaptersFor, type Track } from "@/lib/curriculum";
import { draftLessons, findDraftLesson } from "@/lib/lesson-catalog";
export const metadata = { title: "The curriculum" };
export default async function Curriculum({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const query = await searchParams;
  const track: Track =
    query.track === "SUBPROFESSIONAL" ? "SUBPROFESSIONAL" : "PROFESSIONAL";
  const chapters = chaptersFor(track);
  return (
    <section className="shell section page-content">
      <div className="eyebrow">A MAP FOR YOUR LEARNING</div>
      <h1>
        The curriculum<span className="gold-text">.</span>
      </h1>
      <p className="lead">
        Shared foundations. A focused path. Choose your track and see what lies
        ahead.
      </p>
      <div className="notice">
        Provisional outline · 25 planned chapters across both tracks · {draftLessons.length} draft
        lessons available. Official 2027 coverage remains unverified.
      </div>
      <nav className="tabs" aria-label="Learning track">
        {(["PROFESSIONAL", "SUBPROFESSIONAL"] as const).map((t) => (
          <Link
            key={t}
            href={`/curriculum?track=${t}`}
            aria-current={track === t ? "page" : undefined}
          >
            {t === "PROFESSIONAL" ? "Professional" : "Subprofessional"}
          </Link>
        ))}
      </nav>
      <div className="chapter-list">
        {chapters.map((c, i) => (
          <article key={c.slug} className="chapter">
            <span className="chapter-index">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <span className="eyebrow">
                {c.group} ·{" "}
                {c.track === "COMMON" ? "Shared foundation" : "Track focus"}
              </span>
              <h2>{c.title}</h2>
            </div>
            {findDraftLesson(c.slug) ? (
              <Link className="text-link" href={`/lessons/${c.slug}`} aria-label={`Read draft: ${c.title}`}>
                <BookOpen size={16} /> Read draft <ArrowUpRight size={16} />
              </Link>
            ) : (
              <span className="draft-label">Outline only</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
