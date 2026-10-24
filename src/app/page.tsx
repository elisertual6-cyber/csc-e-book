import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Compass,
  GraduationCap,
  Layers,
  Sparkles,
} from "lucide-react";
import { getCatalog, formatPHP } from "@/lib/catalog";
import { disclaimer } from "@/lib/curriculum";
import { draftLessons } from "@/lib/lesson-catalog";
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <>
      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="gold-line" /> YOUR NEXT CHAPTER STARTS HERE
          </div>
          <h1>
            A purposeful path
            <br />
            to public <em>service.</em>
          </h1>
          <p className="hero-description">
            Build your confidence, one concept at a time. A thoughtfully
            structured reviewer for your Philippine Civil Service Exam
            preparation.
          </p>
          <div className="actions">
            <Link href="/curriculum" className="button">
              Find your starting point <ArrowRight size={18} />
            </Link>
            <Link href="/preview" className="text-link">
              Read a free lesson <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="hero-note">
            <span className="tiny-avatars">
              <span>En</span>
              <span>Fil</span>
            </span>
            <p>
              Made for Filipino learners.
              <br />
              <strong>Both Professional & Subprofessional tracks.</strong>
            </p>
          </div>
        </div>
        <div
          className="book-stage"
          aria-label="Illustration of the planned reviewer cover"
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <span className="stage-star">✧</span>
          <div className="book">
            <div className="book-top">
              <BookOpen size={20} />
              <span>THE INDEPENDENT REVIEWER</span>
            </div>
            <div className="book-rule" />
            <span className="book-year">
              20
              <br />
              27<span className="book-period">.</span>
            </span>
            <h2>
              Your future.
              <br />
              Your service.
              <br />
              <i>Your next chapter.</i>
            </h2>
            <div className="book-bottom">
              PHILIPPINE CIVIL SERVICE
              <br />
              EXAM REVIEWER <span>PROFESSIONAL + SUBPROFESSIONAL</span>
            </div>
          </div>
          <div className="floating-note">
            <Sparkles size={20} />
            <div>
              A clearer way to prepare<span>Understand. Practice. Grow.</span>
            </div>
          </div>
          <p className="cover-caption">
            Concept cover · Full reviewer in development
          </p>
        </div>
      </section>
      <div className="trust-strip">
        <div className="shell trust-inner">
          <span>
            <Layers size={19} /> Two learning tracks
          </span>
          <span>
            <BookOpen size={19} /> Original learning materials
          </span>
          <span>
            <Compass size={19} /> Study at your own pace
          </span>
          <span>
            <GraduationCap size={19} /> Understanding comes first
          </span>
        </div>
      </div>
      <section className="shell section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              A LITTLE STRUCTURE. A LOT OF POSSIBILITY.
            </div>
            <h2>Make room for your ambition.</h2>
          </div>
          <p>
            Start with the foundations you share.
            <br />
            Then follow the track that fits your goal.
          </p>
        </div>
        <div className="track-grid">
          {[
            {
              n: "01",
              title: "Professional",
              label: "THE ANALYTICAL TRACK",
              text: "Connect ideas, work through numerical problems, and develop a more deliberate approach to reasoning.",
              tags: ["Language", "Numerical", "Analytical"],
              type: "PROFESSIONAL",
            },
            {
              n: "02",
              title: "Subprofessional",
              label: "THE CLERICAL TRACK",
              text: "Strengthen your language and number skills, with a focused path through filing and clerical accuracy.",
              tags: ["Language", "Numerical", "Clerical"],
              type: "SUBPROFESSIONAL",
            },
          ].map((t) => (
            <article className="track-card" key={t.n}>
              <div className="track-top">
                <span>{t.label}</span>
                <span className="track-number">{t.n}</span>
              </div>
              <h3>{t.title}</h3>
              <p>{t.text}</p>
              <div className="tags">
                {t.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <Link className="text-link" href={`/curriculum?track=${t.type}`}>
                Explore this track <ArrowRight size={17} />
              </Link>
            </article>
          ))}
        </div>
        <p className="fine-print">
          Provisional editorial curriculum. Official 2027 coverage and exam
          details require verification.
        </p>
      </section>
      <section className="sample-banner shell">
        <div className="sample-icon">
          <BookOpen size={38} />
        </div>
        <div>
          <div className="eyebrow">TRY A SMALL STEP TODAY</div>
          <h2>Good preparation starts with understanding.</h2>
          <p>
            Explore {draftLessons.length} original draft lessons on English language and numerical skills. No account needed.
          </p>
        </div>
        <Link className="button button-light" href="/lessons">
          Browse draft lessons <ArrowUpRight size={17} />
        </Link>
      </section>
      <section className="shell section" id="reviewers">
        <div className="center-heading">
          <div className="eyebrow">YOUR STUDY COMPANIONS</div>
          <h2>Choose the way you learn.</h2>
          <p>
            Planned editions. Illustrative prices in Philippine pesos.
            <br />
            Products are in development and unavailable for purchase.
          </p>
        </div>
        <div className="product-grid">
          {getCatalog().map((p, i) => (
            <article
              className={`product-card ${i === 1 ? "featured" : ""}`}
              key={p.slug}
            >
              {i === 1 && (
                <span className="product-ribbon">THE FULL PICTURE</span>
              )}
              <span className="eyebrow">{p.label}</span>
              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <div className="price">
                {formatPHP(p.priceMinor)}
                <span>planned one-time price</span>
              </div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>
                    <Check size={16} />
                    {f}
                  </li>
                ))}
              </ul>
              <span className="status-pill">In development</span>
            </article>
          ))}
        </div>
      </section>
      <aside className="shell disclaimer">
        <strong>A note on independence</strong>
        <p>
          {disclaimer} Sample lessons are drafts awaiting independent review. No
          actual or predicted 2027 examination questions are provided.
        </p>
      </aside>
    </>
  );
}
