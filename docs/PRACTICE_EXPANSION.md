# Eight lessons and 160 additional practice questions

This describes the Phase 5J expansion. It is now Set 1 of the [five-set series](PRACTICE_SERIES.md), which adds 640 more drafts and an admin set selector showing all 160 keys per set. Counts and validation results below are the historical 5J totals.

This expansion adds **eight original draft lessons and 160 new multiple-choice questions**, each with four distinct choices, one proposed answer and an explanation. It does not replace the earlier 70 editorial questions or the one-question demo seed. Current totals are **23 public lesson drafts, 230 questions in six manual editorial packs, and 231 question records when the unchanged demo seed is included**. These counts describe authored drafts, not independent approvals.

## What was added

The public lesson library gains study methods, Filipino language, constitutional principles, RA 6713 ethics, human-rights principles, environmental literacy, checking solutions and flexible study planning. Their addresses are `/lessons/study-methods`, `/lessons/filipino`, `/lessons/constitution`, `/lessons/ethics`, `/lessons/rights`, `/lessons/environment`, `/lessons/solutions` and `/lessons/study-plan`. They appear after Vercel deploys the source commit; no database import is needed for these ungraded public readers. The two provisional mock-examination headings still have no completed mock lesson or activated exam.

The new questions are split into two fixed 80-item manifests to preserve the existing 100-item pack limit:

| Pack | Topics | New questions | New lessons imported |
| --- | --- | ---: | ---: |
| practice-core | Arithmetic, fractions, ratios, sequences, word problems, data, vocabulary, grammar, sentences, paragraphs | 80 | 2 |
| practice-extended | Reading, Filipino, analogies, logic, filing, spelling, Constitution, ethics, rights, environment | 80 | 6 |

Each of the 20 topics has eight new items. Of the 160, 120 are COMMON, 24 PROFESSIONAL and 16 SUBPROFESSIONAL under the provisional product outline. This is a mixed-track practice collection, not an official full-length mock or a validated examination blueprint. The preceding four import jobs keep their original scopes. All new keys begin with `practice160-`; each key/version stays linked to its choice order and explanation.

## Add the questions and keys to your admin library

1. Open [Import 160 practice drafts](https://github.com/elisertual6-cyber/csc-e-book/actions/workflows/import-practice-drafts.yml).
2. Choose **Run workflow → main → Run workflow**.
3. After success, refresh [Admin](https://csc-e-book.vercel.app/admin). The Questions tab contains each item, proposed key and rationale; the Lessons tab contains the additional eight lesson drafts.

The existing DATABASE_MIGRATION_URL and ADMIN_BOOTSTRAP_EMAIL repository secrets are sufficient. No login password, new provider or payment is required. A current matching ADMIN is required; the import attributes drafts and audit events to that editor without making a claim of independent authorship/review.

The workflow imports core and extended in two separate transactions, each bounded to five minutes for hosted round trips. If the second transaction fails, the first can remain committed; rerun after resolving the reported issue. Existing chapter slugs, lesson slugs, keys, edits, versions, authors and lifecycle states are always preserved. A repeat skips existing keys. A conflicting normalised prompt under another key rolls back that entire pack. Nothing seeds, submits, approves, publishes, activates templates/products, releases PDFs or changes registration/payment settings. No schema migration is added.

After all six imports into an otherwise empty content library, expect 25 chapter headings, 23 lesson drafts and 230 questions; an existing deliberate demo seed can give 231 questions. The admin content list currently displays its latest 200 records, so older records may not all appear in that list even though the import preserves them in the database. Do not delete older content to fit the display. These draft items require independent editorial review before use in a released scored assessment.

## Question booklet and separate answer key

Run `npm run content:export-practice`. It validates the two fixed manifests and creates a new private `.local/editorial/practice-160-<uuid>/` directory containing:

- `questions.md`: all 160 prompts/options, numbered in stable pack order, without the answer explanations.
- `answer-key.md`: the matching number, item key, proposed answer letter/text and explanation for every item.
- `answer-key.csv`: the same proposed key in spreadsheet form, including topic and track.

This export makes no database changes and accepts no arbitrary paths. Files are generated from the same JSON used by the import, avoiding a separately hand-maintained key. Copying or reordering choices requires regenerating the key. Do not treat these documents as an official, timed or released examination.

The repository is public: these source questions and answer keys are public educational drafts, not exclusive or confidential paid material. The website does not serve the JSON packs through public routes or import them into learner question DTOs. Do not put future private paid banks in this source repository.

## Review and verification

Independent correctness, originality, ambiguity, distractor and language review is pending for every new item. Filipino needs qualified proofreading. Constitutional, ethics, rights and waste-law items identify primary texts/articles/sections for checking. This environment could not retrieve the referenced legal websites (HTTP 403), so no current source retrieval, legal applicability or official 2027 coverage is claimed. Human-rights questions identify the UDHR instrument rather than equating it with a Philippine criminal statute. General-information explanations avoid unsupported absolute legal or environmental claims.

Automated checks validate all 231 records across the seed and packs for unique normalised prompts, unique keys/versions, distinct choices, one key and complete draft metadata. Numerical tests independently recompute the 48 new numerical/data answers. Additional checks cover filing rules, exact copies, a logical implication and alignment of all 160 exported keys. The isolated import suite exercises both 80-item transactions, conflicting-prompt rollback, role rejection, answer/explanation preservation, repeat safety and the absence of reviews, publications and commercial activation. Browser checks cover all 23 readers, track links, unavailable bank routes, responsive layout, accessibility and the planner.

The planner retains 16 topic sessions, weekly review/practice/rest and days 29–30. Additional drafts share later topic sessions so all eligible lessons remain represented. A session with two drafts explicitly permits spreading the work over more days; no fixed daily budget guarantees completion. Existing browser-saving fields and privacy boundaries stay unchanged.

These checks do not satisfy the independent 500-question release gate or establish production readiness.

Validation outcome: lint, TypeScript, all 118 unit tests, content validation and the production build/48 trace checks passed. The isolated operator-import test, all 31 main browser cases and all four authenticated accessibility workflows passed. Local printable review copies contain all 160 items in a 41-page question document and separate 21-page key; these were not uploaded or released as application editions.
