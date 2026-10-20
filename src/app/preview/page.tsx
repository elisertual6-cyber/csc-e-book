import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
export const metadata = { title: "Free draft lesson" };
export default async function Preview() {
  const markdown = await readFile(
    path.join(process.cwd(), "content/lessons/arithmetic.md"),
    "utf8",
  );
  return (
    <section className="shell section page-content">
      <div className="lesson-header">
        <Link className="text-link" href="/curriculum">
          ← Back to curriculum
        </Link>
        <span className="status-pill">DRAFT · NOT EDITORIALLY APPROVED</span>
      </div>
      <div className="notice">
        Free editorial preview. This teaching sample includes its solution; it
        is not a graded exam. Paid PDFs and published exam questions are not
        available in this phase.
      </div>
      <article className="prose">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </article>
      <div className="lesson-end">
        <h2>Keep your momentum.</h2>
        <p>Try the ungraded arithmetic exercise next.</p>
        <Link className="button" href="/practice">
          Open practice studio →
        </Link>
      </div>
    </section>
  );
}
