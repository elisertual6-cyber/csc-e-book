# English language draft expansion

Current catalog update: [PRACTICE_EXPANSION.md](PRACTICE_EXPANSION.md) adds eight lessons and 160 questions, bringing totals to 23 draft lessons and 230 editorial questions. Counts below describe this earlier pack; its import scope remains unchanged.

The subsequent paragraph/reading expansion brings the catalog to ten lessons and the three review packs to 45 questions. Its separate job is documented in [READING_DRAFTS.md](READING_DRAFTS.md); this English job keeps its original three-lesson/15-question scope.

Three original teaching drafts add vocabulary in context, formal English grammar and sentence construction to the public library. Each has objectives, explanation, worked example, paper practice, rationale and reflection. The reader remains ungraded and requires no account. The catalog now has eight lessons: five numerical and three English. These are eight of the 25 provisional chapter areas, not a complete reviewer or verified official coverage.

`content/editorial/english-foundations.json` contains 15 original DRAFT multiple-choice items, five per English topic. Each includes four distinct options, one proposed key, a rationale and specific rule-focus notes. Their correctness, originality, distractor quality, language and external references still need independent human review. Formal edited English is the target convention, not a claim that all dialects follow one rule. Grammar/context checks do not establish official examination content.

## Add English drafts to the administrator library

1. Open [Import English drafts](https://github.com/elisertual6-cyber/csc-e-book/actions/workflows/import-language-drafts.yml).
2. Click **Run workflow**, select **main**, and confirm.
3. After success, refresh [Admin](https://csc-e-book.vercel.app/admin) and inspect the Lessons and Questions tabs.

The existing `DATABASE_MIGRATION_URL` and `ADMIN_BOOTSTRAP_EMAIL` secrets suffice. No login password is required. A current matching ADMIN identity is required. The workflow calls `npm run content:import-drafts -- --pack language --apply`, using a fixed manifest rather than an operator-supplied file path. It creates only missing chapter headings and English drafts. All existing chapter slugs, lesson slugs and question keys are preserved; revisions are not silently added. The same transaction, duplicate-prompt, author-attribution and audit rules as the numerical import apply. See [NUMERICAL_IMPORT.md](NUMERICAL_IMPORT.md).

After both hosted imports on an otherwise empty library, expect 25 headings, eight lesson drafts and 35 question drafts. A deliberately seeded demo also has its original sample question, bringing that environment to 36. The numerical workflow keeps its original five-lesson/20-question scope; rerunning it never silently imports the English pack.

New public lesson URLs become available after Vercel successfully deploys the pushed commit:

- `/lessons/vocabulary`
- `/lessons/grammar`
- `/lessons/sentences`

The public file-based previews do not depend on a database import. Conversely, running a database import does not publish editorial records or change the public previews. Source review packs are public repository samples, not confidential paid questions; the website does not expose them as public JSON routes or use them as pre-submission assessment answers.

No products, paid access, exam templates, reviews, publications or PDF releases are activated. No real recovery email or GCash setup is completed by this content expansion. The 500 independently reviewed question target remains outstanding. Keep an author and an independent qualified reviewer distinct when submitting this material through the editorial workflow.

## Verification

`npm run content:check` validates all allowlisted files, required sections, draft markers, metadata, options and normalized prompts across both review packs and the unchanged seed. Unit checks verify pack boundaries and lesson coverage. `npm run test:content-import` checks role rejection, conflicts/rollback, repeat safety, both pack selections and unchanged editorial status. `npm run test:e2e` exercises every public reader on desktop/mobile and runs automated accessibility checks; these do not replace human content review or manual assistive-technology testing.
