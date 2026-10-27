# Free subject-reviewer library

The Reviewers navigation now opens `/reviewers`, a free study library arranged into six subject guides. The existing `/shop` URL serves the same library and retains the original product catalog, checkout restrictions and order/download link in a separate PDF-editions section. This replaces the previous empty-storefront experience with immediately usable study material.

| Guide | Lessons | Route |
| --- | ---: | --- |
| Numerical Ability | Arithmetic, fractions/decimals/percentages, ratios/averages, sequences, word problems | `/reviewers/numerical-ability` |
| Verbal Ability | Vocabulary, grammar, sentences, paragraphs, reading, Filipino | `/reviewers/verbal-ability` |
| Analytical Ability | Analogies, logic, data interpretation | `/reviewers/analytical-ability` |
| Clerical Ability | Filing, spelling/transcription | `/reviewers/clerical-ability` |
| General Information | Constitution, RA 6713 ethics, rights, environment | `/reviewers/general-information` |
| Study Toolkit | Study methods, checking solutions, study planning | `/reviewers/study-toolkit` |

The six guides arrange the existing **23 public lesson drafts**, each exactly once; they do not claim 23 newly authored or independently approved lessons. The underlying lesson files and their source limitations are preserved. All pages explicitly identify the material and proposed solutions as unreviewed, unofficial teaching drafts. Official 2027 coverage remains unverified. Track labels follow the existing provisional curriculum, not a newly verified examination blueprint.

## Learner features

The library supports searching subject/topic names, Professional/Subprofessional filtering with COMMON guides retained, result counts, an empty state and filter reset with focus returned to search. All default guide links are present in server-rendered HTML. Reading needs no account, database record, purchase or new import.

Each guide includes a table of contents with chapter anchors, full original lesson explanations, worked examples, paper exercises/rationales, a short subject checklist, individual lesson links, next-guide navigation, study-planner links and the account practice sets. Existing individual `/lessons/<slug>` routes remain available. Reading a guide does not create a grade, saved completion or unlock any set. The five-set practice service continues to own saved answers, complete submission, sequential access and post-submission answer keys.

Print / Save as PDF uses the reader's own browser print dialog. Print CSS includes the draft notice, contents, all chapters and checkpoints; it hides site navigation and action buttons and begins later chapters on a new page. A reader may choose Save as PDF if their browser offers it. No Chromium runs on Vercel, no server PDF is created, and nothing becomes a PdfEdition, protected download or paid/released publication. Existing private PDF generation, content-review and payment/entitlement controls are unchanged.

## Content and rendering boundaries

`src/lib/reviewer-catalog.ts` is a fixed allowlist of metadata and lesson slugs. Routes accept only those six guide slugs and use the existing fixed lesson loader. Unknown slugs return 404. The reader is prerendered from public teaching Markdown at build time; arbitrary filesystem paths and assessment packs are never accepted. Raw HTML and images remain disabled. Chapter hierarchy uses one page H1, chapter H2s and lesson-section H3s; the Filipino chapter carries a language attribute.

The only client guide code filters public metadata and opens the print dialog. No assessment JSON, correct-answer flags, private source snapshots, credentials or learner responses are bundled or placed in localStorage. Existing commerce services and storefront controls are reused without activation or payment changes. No database migration, seed/import, account email or new environment variable is needed.

## Validation

The required lint, TypeScript, unit/content/build and isolated browser/accessibility checks are recorded in [REVIEWER_LIBRARY_REPORT.md](REVIEWER_LIBRARY_REPORT.md). New desktop/mobile behavior coverage includes search, track filtering, empty/reset focus, full six-guide/23-chapter content, contents navigation, real print-PDF creation, print visibility, next guide, responsive layout, the old shop URL and unknown-guide/JSON rejection. Public automated WCAG scans include both library URLs and all six guide pages. Use only the existing disposable test wrappers; generated fixtures and synthetic reviews are not human editorial evidence.
