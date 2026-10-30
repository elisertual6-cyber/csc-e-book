# Reviewer bookmark delivery

Implemented optional bookmarking across the six free reviewer guides and all 29 public chapters. The library and each guide offer exact-chapter resume links. One chapter per guide is saved in this browser only, with explicit shared-device wording, removal controls and a matching privacy-notice paragraph. The account dashboard remains minimal. See [REVIEWER_BOOKMARKS.md](REVIEWER_BOOKMARKS.md) for storage, validation, concurrency and access boundaries.

Local verification:

- ESLint and TypeScript passed.
- All 130 unit tests passed, including all 29 bookmark destinations and malformed/extra/private reference rejection.
- Content validation passed: 23 existing public drafts, six supplements and 871 editorial question records remain unchanged and unreviewed.
- Production build passed; 53 traced manifests and 918 existing runtime files verified.
- Six focused desktop/mobile bookmark tests passed. The subsequent complete browser/security suite passed all 45 tests, including the same six cases and the existing public automated WCAG scans, reviewer printing, dashboard and exam flows.
- All four signed-in learner/staff accessibility workflows passed on desktop and mobile after the final build.
- Saved-chapter shelf screenshots were inspected at desktop and mobile widths. Print tests confirm that bookmarks stay out of printed teaching content.

All browser checks used the existing disposable-database wrapper, generated synthetic identities/data and local Chromium. Tests did not target hosted learners or send mail. No database/schema migration, new setting, assessment approval, set activation or commerce change is required. These checks are local automated evidence, not a manual screen-reader conformance claim.
