# Paragraph and reading draft expansion

Two original teaching drafts cover paragraph organization and passage-based reading. Each includes objectives, explanation, worked example, paper practice, rationale and reflection. Their public URLs are `/lessons/paragraphs` and `/lessons/reading`, available after the pushed Vercel deployment is Ready. The public library now has ten ungraded lesson previews across ten provisional chapter areas; the 25 chapter headings still do not represent a finished curriculum.

`content/editorial/reading-foundations.json` adds ten original DRAFT questions: five about paragraph organization and five about reading comprehension. Reading passages are included in each question prompt and explicitly labeled invented examples. They do not describe actual government programs. Source notes identify the reasoning target and pending independent checks. The three packs together contain 45 sample questions; the unchanged one-question demo seed gives local seeded environments 46. No automatic review, publication, examination activation or seed change occurs.

## Import the additional material

1. Open [Import reading drafts](https://github.com/elisertual6-cyber/csc-e-book/actions/workflows/import-reading-drafts.yml).
2. Choose **Run workflow → main → Run workflow**.
3. Wait for success, then refresh [Admin](https://csc-e-book.vercel.app/admin) and inspect Lessons and Questions.

The job uses the existing `DATABASE_MIGRATION_URL` and `ADMIN_BOOTSTRAP_EMAIL` repository secrets. It does not need the deleted login-password secret. Its explicit command is `npm run content:import-drafts -- --pack reading --apply`. The fixed manifest selects only the two reading lessons and ten questions, while the other jobs retain their existing scopes. Missing curriculum headings may be created; existing slugs, question keys, edits, authors and versions are preserved. The transaction, current-ADMIN check, audit attribution, conflict rollback and bounded timeout described in NUMERICAL_IMPORT.md also apply.

After all three imports on an otherwise empty content library, expect 25 chapter headings, ten lesson drafts and 45 question drafts. A successful job is not independent review and does not publish database lessons. Refreshing the public previews and importing administrative drafts are separate operations. The public-source review packs are not confidential paid banks; their JSON files are not served as public website routes or included in learner attempt responses.

## Review focus

For ordering items, a qualified reviewer should test every offered sequence against reference and time dependencies. For reading items, confirm the entire answer is supported by the included passage and that no option requires outside facts. Examine the difference between an explicit detail, a limited inference and an unsupported universal or causal conclusion. Questions with multiple defensible answers must be revised before approval.

All new material remains unapproved. The 500 independently reviewed question gate, remaining curriculum, official coverage/source checks, Filipino proofreading and provider/storage/mail requirements remain outstanding. No sales or account-registration setting is changed.

## Verification

`npm run content:check` validates all three packs together for complete metadata, unique normalized prompts, distinct choices, one proposed key and DRAFT lifecycle. The isolated `npm run test:content-import` covers role rejection, rollback, all three explicit pack selections, repeat safety, record preservation, audit counts and the absence of reviews or activated products/exams. The browser suite visits all ten readers on desktop/mobile and scans public pages for automated accessibility violations. These automated checks do not establish independent content correctness or accessibility conformance.
