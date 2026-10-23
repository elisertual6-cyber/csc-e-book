# Phase 5E: numerical teaching drafts

Expanded the public learning material from one arithmetic sample to five draft lessons. New chapters cover fractions/decimals/percentages; ratios/averages/proportions; explicitly stated sequence rules; and word-problem modelling with units. Each contains objectives, explanations, worked examples, paper practice, rationales and reflection. All are labelled unapproved editorial previews, with no official exam or 2027 coverage claim.

Added the `/lessons` library and five allowlisted `/lessons/<slug>` readers, with meaningful titles, previous/next navigation and links from the curriculum/home/legacy preview. Readers are prerendered without a database, ignore raw HTML/images and reject unknown filenames/slugs. They contain teaching solutions but never import the assessment question pack. They do not store progress or create grades. The existing arithmetic `/preview` and private reviewed-PDF controls remain.

Authored a 20-question numerical review pack with five questions per new topic, four distinct choices, answer rationales, level/difficulty metadata and review/source notes. Added combined seed/pack validation, numerical answer checks and a CLI export that strips lifecycle metadata for the strict editorial API. Export writes an ignored, owner-only import file and performs no database mutations. Actual seeding remains one lesson and one draft question. New public preview files are not automatically authored database lesson records.

The source repository is public, including draft answer keys. These examples are not a confidential or exclusive paid bank. Public app routes do not expose the pack, and unreviewed items cannot enter graded attempts. Independent human review remains required; automated calculation/schema checks are not approval.

Validation commands:

```sh
npm run content:check
npm run content:export
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=2
```

Browser checks exercise desktop/mobile reading order, all five lesson sections, unknown-route/file rejection, curriculum links and viewport fit. Automated WCAG A/AA scanning now includes the library and every lesson (20 public routes per device). The editorial test uses a disposable database to verify anonymous/customer denial, an authorized editor's 20-item import, DRAFT status with no review records, and atomic rejection of malformed choices. Simulated staff setup in that fixture does not create real staff or human approvals.

Results: all 36 unit tests and all 23 production browser/security cases passed. Lint, typecheck, content validation, database checks and the final production build passed. The export command successfully produced 20 strict editorial input rows without changing the application database. The five reader pages and library were prerendered. Development seeded content and release gates remain unchanged.

Remaining work: complete and independently review the broader curriculum and at least 500 original questions, proofread language/Filipino content, verify authoritative references, and complete provider/hosting/storage/privacy/operations readiness. No actual Vercel deployment URL or real GCash sandbox result is verified here. Payments, production registration and real mail availability are unchanged. See DRAFT_LESSONS.md for export/import and release procedures.
