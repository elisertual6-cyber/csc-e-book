# Numerical lesson previews and editorial pack

Current catalog update: [PRACTICE_EXPANSION.md](PRACTICE_EXPANSION.md) adds eight lessons and 160 questions, bringing totals to 23 draft lessons and 230 editorial questions. Counts below describe this earlier pack; its import scope remains unchanged.

The latest reasoning/clerical expansion brings the catalog to 15 drafts and the four review packs to 70 sample questions. See [TRACK_DRAFTS.md](TRACK_DRAFTS.md). Each prior import job retains its original scope.

The current catalog also includes paragraph organization and reading comprehension, for ten public teaching drafts and three review packs totaling 45 questions. See [READING_DRAFTS.md](READING_DRAFTS.md). The numerical job still imports only its original five lessons and 20 questions.

The subsequent English expansion adds three more public drafts and a separate 15-question pack. The library now has eight teaching drafts; the numerical pack and its five-lesson import scope remain unchanged. See [ENGLISH_DRAFTS.md](ENGLISH_DRAFTS.md) for the additional content and manual import job.

The public library at `/lessons` contains five original teaching drafts: arithmetic; fractions/decimals/percentages; ratios/averages/proportions; sequences; and word-problem modelling. `/lessons/<catalog-slug>` renders the corresponding Markdown lesson with objectives, explanation, worked example, paper practice, rationale and reflection. The curriculum links to available lessons for both tracks. Each page explicitly labels the material unapproved and ungraded; worked solutions are included for learning. The existing `/preview` arithmetic/PDF-availability page remains available.

The catalog is a fixed allowlist, not a filesystem browser. Unknown slugs return 404 and cannot choose arbitrary files. The reader is a Server Component; raw HTML and images are disabled. Lesson pages are prerendered at build time and work without the database on a Vercel demo. These pages do not create accounts, store progress, grade attempts, publish editorial records or grant entitlements. Update the catalog and rebuild/redeploy when adding a public preview.

Four new Markdown files are under `content/lessons/`. Together with the existing arithmetic sample, these are five of the 25 provisional chapter areas, not a completed reviewer. The official 2027 scope and timing remain unverified. Legal, historical and Filipino material still needs authoritative sources and qualified review before release.

`content/editorial/numerical-foundations.json` contains 20 original draft multiple-choice questions, five each for the four new numerical topics. Every item has four distinct options, one answer key, a rationale, COMMON track metadata, difficulty and source/review notes. The seed remains unchanged: it inserts only the original arithmetic sample. The new pack is not automatically imported into any database, activated in exams, approved or included in a paid edition.

This repository is public, so the sample pack's source and answer keys are publicly readable. The app does not serve the pack through a public content route or bundle it into the lesson reader. These are public educational drafts, not confidential or exclusive assessment items. Do not store future private customer/paid banks or credentials in this repository. Live question DTOs must continue to omit answer keys until server grading.

## Validate and prepare an editorial import

For a deliberate hosted import of chapter headings, lesson drafts and the 20-question pack under your ADMIN identity, follow [NUMERICAL_IMPORT.md](NUMERICAL_IMPORT.md). Its manual job is separate from migrations and seeds; it preserves all existing keys and never creates reviews or publications.

```sh
npm run content:check
npm run content:export
```

Validation checks all five lesson sections/titles/draft labels, the seed and review pack together for duplicate prompts/versions, distinct options, one answer and complete fields. Unit checks independently calculate the numerical answers. These automated checks are not independent human approval or proof of originality/factual correctness.

Export creates a new owner-only `.local/editorial/numerical-foundations-<uuid>.import.json` and prints only its path/count. It strips lifecycle/version metadata to match the existing strict editorial API. No database write occurs. The original pack remains marked DRAFT with independent review pending. The generated copy is ignored by Git and Vercel uploads, but that does not make the public source pack confidential.

For a deliberate editorial workflow, sign in as an EDITOR or ADMIN, open the question studio and use JSON import with the generated file's contents. Import creates authored DRAFT records; it never imports approval. Review the 20 questions for correctness, clarity, originality, answer distractors and language. Submit each version, have a distinct qualified reviewer inspect it, and use the existing admin release workflow only after approval. A synthetic test-role change is not a real staff bootstrap procedure.

The new public lesson files are not database lesson records. To prepare an editorial/PDF version, an author should create a new lesson in the studio, choose its matching chapter, enter the title/objectives and copy the Markdown. Keep its draft label until independently reviewed; publication and PDF release are separate controlled steps. Do not seed approvals to make preview lessons appear published.

Commercial launch still requires at least 500 unique independently reviewed questions, a completed/proofread curriculum, verified official references and the remaining provider, storage, privacy and operational requirements. This milestone supplies more teaching material and verifies the import path; it does not meet that gate.
