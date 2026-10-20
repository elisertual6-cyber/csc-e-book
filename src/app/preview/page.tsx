import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { getDb } from "@/lib/db";
export const dynamic = "force-dynamic";
export const metadata = { title: "Free draft lesson" };
export default async function Preview() {
  let pdf: { id: string } | null = null;
  let pdfAvailable = true;
  try {
    pdf = await getDb().pdfEdition.findFirst({
      where: { kind: "PREVIEW", publishedAt: { not: null } },
      select: { id: true },
    });
  } catch {
    pdfAvailable = false;
  }
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
        is not a graded exam. Paid downloads and graded exams are not available.
      </div>
      <article className="prose">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </article>
      <div className="lesson-end">
        <h2>Reviewed PDF preview</h2>
        {pdf ? (
          <p>
            <Link
              className="text-link"
              prefetch={false}
              href="/api/preview.pdf"
              target="_blank"
            >
              Open the independently reviewed free PDF ↗
            </Link>
          </p>
        ) : (
          <p>
            {pdfAvailable
              ? "No independently reviewed PDF preview has been published yet. This sample remains an editorial draft."
              : "PDF preview availability could not be checked. Please try again later."}
          </p>
        )}
        <h2>Keep your momentum.</h2>
        <p>Try the ungraded arithmetic exercise next.</p>
        <Link className="button" href="/practice">
          Open practice studio →
        </Link>
      </div>
    </section>
  );
}
