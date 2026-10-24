import "server-only";
import { chromium, type Browser } from "playwright";
import MarkdownIt from "markdown-it";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import type { EditionKind, Prisma } from "@prisma/client";
import { getDb } from "@/lib/db";
import {
  audit,
  contentHash,
  independentlyApproved,
  loadContent,
  type Actor,
  type ContentRecord,
} from "@/lib/editorial";
import { digest } from "@/lib/security";
import { HttpError } from "@/lib/http";
import { disclaimer } from "@/lib/curriculum";
import { writePrivatePdf, readPrivatePdf, removePrivatePdf, pdfStorageMode } from "./pdf-storage";
const md = new MarkdownIt({ html: false, linkify: false }).disable("image");
md.validateLink = (href) => /^(https?:|mailto:|#)/i.test(href);
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
type Manifest = {
  lessons: { id: string; hash: string }[];
  questions: { id: string; hash: string }[];
};
let busy = false;
async function recordsFor(manifest: Manifest, reviewed: boolean) {
  const db = getDb();
  const lessons = await Promise.all(
    manifest.lessons.map((item) => loadContent(db, "lessons", item.id)),
  );
  const questions = await Promise.all(
    manifest.questions.map((item) => loadContent(db, "questions", item.id)),
  );
  if (reviewed)
    for (const [i, records] of [lessons, questions].entries()) {
      const entries = i === 0 ? manifest.lessons : manifest.questions;
      for (const [index, record] of records.entries())
        if (
          record.status !== "PUBLISHED" ||
          !independentlyApproved(record) ||
          contentHash(record) !== entries[index].hash
        )
          throw new HttpError(
            409,
            "Every included version must still be published with matching independent approval.",
          );
    }
  return { lessons, questions };
}
function bookHtml(
  title: string,
  version: string,
  kind: EditionKind,
  lessons: ContentRecord[],
  questions: ContentRecord[],
) {
  const draft = kind === "DRAFT";
  const label = draft
    ? "PRIVATE EDITORIAL DRAFT · NOT FOR SALE"
    : kind === "PREVIEW"
      ? "FREE REVIEWED PREVIEW"
      : "PRIVATE FULL EDITION";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(title)}</title><style>
  @page{size:A4;margin:21mm 18mm 23mm}*{box-sizing:border-box}body{font:11pt/1.65 Arial,sans-serif;color:#24384a;margin:0}h1,h2,h3{color:#132b43;line-height:1.2}h1{font:38pt Georgia,serif}h2{font:25pt Georgia,serif}h3{font-size:14pt}a{color:#6f4d17}a:visited{color:#6f4d17}p,li{orphans:3;widows:3}h2,h3{break-after:avoid}section.chapter{break-before:page}section.cover{min-height:235mm;background:#132b43;color:#fff6df;padding:22mm 15mm;break-after:page}.cover h1{color:#fff6df;margin-top:30mm}.cover .year{font:66pt Georgia,serif;color:#dbc38b}.eyebrow{font-size:9pt;letter-spacing:2px;color:#d4bc85}.box{border-left:3px solid #ac7b2a;background:#f3f0e7;padding:5mm;margin:8mm 0}.cover .box{background:#243e55}.toc li{margin:4mm 0}.question{break-inside:avoid;border-bottom:1px solid #ddd;padding-bottom:5mm;margin-bottom:5mm}.draft-mark{position:fixed;top:40%;left:15%;transform:rotate(-35deg);font-size:90pt;color:rgba(140,100,30,.08);z-index:-1}table{border-collapse:collapse;width:100%;font-size:9pt}td,th{border:1px solid #ccc;padding:2mm;text-align:left}code{white-space:pre-wrap}pre{white-space:pre-wrap;overflow-wrap:anywhere}img{display:none}blockquote{border-left:2px solid #ac7b2a;padding-left:4mm}li{margin-bottom:2mm}
  </style></head><body>${draft ? '<div class="draft-mark">DRAFT</div>' : ""}<section class="cover"><div class="eyebrow">CSC STUDY · INDEPENDENT LEARNING</div><div class="year">2027.</div><h1>${escape(title)}</h1><p>${escape(label)}</p><p>Professional &amp; Subprofessional learning tracks</p><div class="box">${escape(disclaimer)}</div><p>Publication version: ${escape(version)}</p></section>
  <section><h2>Copyright &amp; independence</h2><p>© ${new Date().getUTCFullYear()} CSC Study. Original educational material. All rights reserved, subject to applicable law.</p><p>${escape(disclaimer)}</p><p>${draft ? "This unreviewed editorial proof is restricted to staff. It is not a published reviewer or a paid product." : "Included educational versions have independent editorial approval. This is not proof of official CSC coverage, dates, scoring rules or examination questions."}</p><p>No actual or predicted CSC examination questions are supplied. Practice results are not official CSC scores.</p><p>Edition ${escape(version)} · ${escape(label)}</p></section>
  <section class="chapter toc"><h2>Contents</h2><ol>${lessons.map((l) => `<li><a href="#lesson-${l.id}">${escape("title" in l ? l.title : "Lesson")}</a></li>`).join("")}<li><a href="#exercises">Practice exercises</a></li><li><a href="#answers">Answers &amp; rationales</a></li><li><a href="#calendar">30-day study calendar</a></li><li><a href="#references">References &amp; version notes</a></li></ol></section>
  ${lessons.map((l) => ("markdown" in l ? `<section class="chapter" id="lesson-${l.id}"><p>${escape(label)} · Lesson version ${l.version}</p><h2>${escape(l.title)}</h2><p>In this chapter, you will:</p><ul>${l.objectives.map((o) => `<li>${escape(o)}</li>`).join("")}</ul>${md.render(l.markdown)}</section>` : "")).join("")}
  <section class="chapter" id="exercises"><h2>Practice exercises</h2><p>Original teaching exercises. No official score, time limit or predicted examination content is implied.</p>${
    questions.length
      ? questions
          .map((q, i) =>
            "prompt" in q
              ? `<div class="question"><h3>${i + 1}. ${escape(q.prompt)}</h3><ol type="A">${[
                  ...q.choices,
                ]
                  .sort((a, b) => a.label.localeCompare(b.label))
                  .map((c) => `<li>${escape(c.text)}</li>`)
                  .join("")}</ol></div>`
              : "",
          )
          .join("")
      : "<p>No question-bank exercises were selected for this edition. Use the worked practice in the included lessons.</p>"
  }</section>
  <section class="chapter" id="answers"><h2>Answers &amp; rationales</h2>${questions.map((q, i) => ("prompt" in q ? `<div class="question"><h3>${i + 1}. ${escape(q.choices.find((c) => c.isCorrect)?.label ?? "")}</h3><p>${escape(q.explanation?.rationale ?? "")}</p></div>` : "")).join("")}</section>
  <section class="chapter" id="calendar"><h2>30-day study calendar</h2><p>An adaptable study-planning template, not an official examination schedule. Choose topics from your learning track and adjust to your needs.</p><table><thead><tr><th>Days</th><th>Focus</th><th>Your notes</th></tr></thead><tbody>${[
    ["1–5", "Identify strengths and revisit language foundations"],
    ["6–10", "Work through numerical concepts and check units"],
    ["11–15", "Practice your analytical or clerical track"],
    [
      "16–20",
      "Revisit difficult topics and verify general-information sources",
    ],
    ["21–25", "Mix topics and explain each solution in your own words"],
    ["26–30", "Reflect, review mistakes and plan your next study cycle"],
  ]
    .map(
      (r) =>
        `<tr><td>${r[0]}</td><td>${r[1]}</td><td>________________</td></tr>`,
    )
    .join("")}</tbody></table></section>
  <section class="chapter" id="references"><h2>References &amp; version notes</h2><p>Publication version ${escape(version)}. Official 2027 examination specifications remain unverified; consult applicable notices at <a href="https://www.csc.gov.ph/">csc.gov.ph</a>.</p>${questions.map((q) => ("sourceNotes" in q ? `<p>${escape(q.key)} v${q.version}: ${escape(q.sourceNotes)}</p>` : "")).join("")}<p>Editorial approval records and immutable content hashes are retained privately in the publication manifest. No CSC endorsement or passing guarantee is made.</p></section></body></html>`;
}
export async function generateEdition(
  actor: Actor,
  input: {
    kind: EditionKind;
    version: string;
    title: string;
    lessonIds: string[];
    questionIds: string[];
  },
) {
  if (process.env.VERCEL)
    throw new HttpError(503, "PDF generation requires the separate browser worker.");
  pdfStorageMode();
  if (!["ADMIN", "EDITOR", "REVIEWER"].includes(actor.role))
    throw new HttpError(403, "Staff access is required.");
  if (!input.lessonIds.length)
    throw new HttpError(400, "Select at least one lesson.");
  if (input.kind !== "DRAFT" && actor.role !== "ADMIN")
    throw new HttpError(403, "Only an admin can generate release candidates.");
  if (
    new Set(input.lessonIds).size !== input.lessonIds.length ||
    new Set(input.questionIds).size !== input.questionIds.length
  )
    throw new HttpError(400, "Select each version once.");
  const initial = {
    lessons: input.lessonIds.map((id) => ({ id, hash: "" })),
    questions: input.questionIds.map((id) => ({ id, hash: "" })),
  };
  const records = await recordsFor(initial, false);
  const manifest: Manifest = {
    lessons: records.lessons.map((r) => ({ id: r.id, hash: contentHash(r) })),
    questions: records.questions.map((r) => ({
      id: r.id,
      hash: contentHash(r),
    })),
  };
  if (input.kind !== "DRAFT") await recordsFor(manifest, true);
  if (
    input.kind === "FULL" &&
    new Set(records.questions.map((q) => ("key" in q ? q.key : q.id))).size <
      500
  )
    throw new HttpError(
      409,
      "A full commercial edition requires at least 500 independently reviewed original questions.",
    );
  if (busy)
    throw new HttpError(409, "The PDF worker is busy. Try again shortly.");
  busy = true;
  let browser: Browser | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    });
    const context = await browser.newContext({
      javaScriptEnabled: false,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.setContent(
      bookHtml(
        input.title,
        input.version,
        input.kind,
        records.lessons,
        records.questions,
      ),
      { waitUntil: "load", timeout: 20_000 },
    );
    timer = setTimeout(() => {
      void browser?.close();
    }, 30_000);
    const bytes = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate:
        '<div style="font-size:8px;width:100%;text-align:center;color:#687078">CSC Study · Independent and unofficial reviewer</div>',
      footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#687078">${escape(input.version)} · ${input.kind === "DRAFT" ? "PRIVATE DRAFT · " : ""}<span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
    });
    clearTimeout(timer);
    const filename = await writePrivatePdf(`${randomUUID()}.pdf`, bytes);
    try {
      const edition = await getDb().$transaction(async (tx) => {
        const result = await tx.pdfEdition.create({
          data: {
            kind: input.kind,
            version: input.version,
            title: input.title,
            creatorId: actor.id,
            filename,
            sha256: digest(bytes),
            manifest: manifest as unknown as Prisma.InputJsonValue,
          },
        });
        await audit(tx, actor, "pdf.generate", result.id, {
          kind: input.kind,
          version: input.version,
        });
        return result;
      });
      return edition;
    } catch (error) {
      await removePrivatePdf(filename);
      throw error;
    }
  } finally {
    clearTimeout(timer);
    try {
      await browser?.close();
    } finally {
      busy = false;
    }
  }
}
export async function publishPreview(
  actor: Actor,
  id: string,
  confirmed: boolean,
) {
  if (actor.role !== "ADMIN")
    throw new HttpError(403, "An admin must publish previews.");
  if (!confirmed)
    throw new HttpError(
      400,
      "Confirm human review of the entire PDF, including template, references and notices.",
    );
  return getDb().$transaction(
    async (tx) => {
      const edition = await tx.pdfEdition.findUnique({ where: { id } });
      if (!edition || edition.kind !== "PREVIEW" || edition.publishedAt)
        throw new HttpError(
          409,
          "Choose an unpublished reviewed preview candidate.",
        );
      const manifest = edition.manifest as unknown as Manifest;
      for (const kind of ["lessons", "questions"] as const)
        for (const item of manifest[kind]) {
          const record = await loadContent(tx, kind, item.id);
          if (
            record.status !== "PUBLISHED" ||
            !independentlyApproved(record) ||
            contentHash(record) !== item.hash
          )
            throw new HttpError(
              409,
              "Preview content is no longer eligible for release.",
            );
        }
      await readEdition(edition);
      const result = await tx.pdfEdition.update({
        where: { id },
        data: { publishedAt: new Date() },
      });
      await audit(tx, actor, "pdf.preview.publish", id, {
        version: edition.version,
      });
      return result;
    },
    { isolationLevel: "Serializable" },
  );
}
export async function readEdition(edition: {
  filename: string;
  sha256: string;
}) {
  const bytes = await readPrivatePdf(edition.filename);
  if (digest(bytes) !== edition.sha256)
    throw new HttpError(409, "PDF integrity check failed.");
  return bytes;
}
export async function publicPreview() {
  const edition = await getDb().pdfEdition.findFirst({
    where: { kind: "PREVIEW", publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
  });
  if (!edition)
    throw new HttpError(
      404,
      "No independently reviewed PDF preview has been published yet.",
    );
  await recordsFor(edition.manifest as unknown as Manifest, true);
  return { edition, bytes: await readEdition(edition) };
}

// Revalidate every source version on release and delivery, including withdrawals.
export async function fullEdition(id: string) {
  const edition = await getDb().pdfEdition.findUnique({ where: { id } });
  if (!edition || edition.kind !== "FULL")
    throw new HttpError(409, "Select a reviewed full edition.");
  const records = await recordsFor(
    edition.manifest as unknown as Manifest,
    true,
  );
  if (
    !records.lessons.length ||
    new Set(records.questions.map((q) => ("key" in q ? q.key : q.id))).size <
      500
  )
    throw new HttpError(
      409,
      "A full edition requires lessons and 500 unique independently reviewed questions.",
    );
  return { edition, bytes: await readEdition(edition) };
}
