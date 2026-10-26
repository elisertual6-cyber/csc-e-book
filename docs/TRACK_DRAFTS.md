# Reasoning and clerical draft expansion

Current catalog update: [PRACTICE_EXPANSION.md](PRACTICE_EXPANSION.md) adds eight lessons and 160 questions, bringing totals to 23 draft lessons and 230 editorial questions. Counts below describe this earlier pack; its import scope remains unchanged.

Five original, ungraded teaching drafts add analogies, logic and data interpretation under the provisional Professional track, and filing and spelling under the provisional Subprofessional track. Every lesson includes objectives, explanation, worked example, practice, rationale and reflection. The library and reader now label each lesson's track; the curriculum continues to show shared lessons plus only the selected track's focus chapters. Track labels describe this product's provisional outline, not verified official CSC coverage.

The public catalog now has 15 lesson drafts: ten shared foundations, three Professional topics and two Subprofessional topics. Its Professional curriculum view links to 13 available lessons and its Subprofessional view links to 12. The other outline areas remain unfinished.

`content/editorial/track-foundations.json` contains 25 unapproved sample questions, five per new topic. The 15 reasoning/data items are marked PROFESSIONAL; the ten clerical items are SUBPROFESSIONAL. All have four distinct options, one proposed key, rationale and review notes. The full set of four review packs contains 70 questions. The unchanged one-question demo seed produces 71 records in local seeded environments, not an extra hosted import item.

## Import the new drafts

1. Open [Import track drafts](https://github.com/elisertual6-cyber/csc-e-book/actions/workflows/import-track-drafts.yml).
2. Select **Run workflow → main → Run workflow**.
3. After success, refresh [Admin](https://csc-e-book.vercel.app/admin) and inspect the five new lesson topics and their questions.

The workflow uses existing `DATABASE_MIGRATION_URL` and `ADMIN_BOOTSTRAP_EMAIL` secrets and the explicit command `npm run content:import-drafts -- --pack tracks --apply`. No administrator login password is needed. It preserves all existing keys, versions and edits, enforces the current ADMIN identity, writes audit events and rolls back conflicts within the pack transaction. Missing chapter headings may be created. It never creates reviews, publication, products or exam templates. The numerical, English and reading jobs retain their existing scopes.

After all four hosted imports into an otherwise empty content library, expect 25 headings, 15 lesson drafts and 70 question drafts. Source-based public previews deploy separately through Vercel; no database import is required to read them. New public addresses are `/lessons/analogies`, `/lessons/logic`, `/lessons/data`, `/lessons/filing` and `/lessons/spelling` after a successful deployment.

## Review priorities

Analogy questions specify the relationship and direction to limit ambiguity. Logical premises are invented exercise rules, not claims about actual offices. The data table uses invented separate-day counts; raw output alone does not establish staff efficiency or causation. Filing questions state their comparison rule and must not be mistaken for an official records-management standard. Spelling examples need verification against the chosen edited-English reference and must not reject valid regional alternatives without stating a convention. Exact copying preserves identifiers rather than silently correcting them.

The source packs are public educational samples, not exclusive or confidential paid banks. No new bank file is served as a public website JSON route or imported into public reader components. Independent human correctness, originality, ambiguity, reference and language review remains required. Preparing or importing drafts does not satisfy the 500-question release gate or enable payments, public registration, email or PDF release.

## Verification

Content checks validate normalized prompts, options, draft state, complete lessons and topic/track alignment against the curriculum. Numerical checks independently recalculate the data-table answers. The operator integration test verifies all four pack selections, rejects non-admin imports, preserves existing edits and confirms no reviews or commercial activation after repeats. The browser suite verifies track labels, track-specific curriculum links, all readers and public accessibility on desktop/mobile. These checks do not replace qualified human review or manual assistive-technology testing.
