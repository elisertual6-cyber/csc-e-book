# Free timed mock sessions

The practice lobby originally offered a MOCK selector but had no released templates or eligible independently reviewed bank, so selecting it displayed an empty-session notice. The operator requested working timed mock examinations after authorizing free unreviewed practice.

Two specifically scoped FREE mocks now use fixed, balanced selections from the existing draft practice sources: Professional and Subprofessional, each 160 questions and 150 minutes. These are application practice settings, not verified official CSC counts, timing or subject weights. Questions repeat material from the five sets; these are not 320 additional original questions. Analytical/data questions appear only in Professional; filing/spelling only in Subprofessional. Each configured topic receives eight to ten items. Question order is shuffled per attempt.

## Release and deployment

No migration or new secret is needed. The main-only `Activate free timed mock examinations` workflow uses the existing database/admin secrets and starts on changes to `content/releases/timed-mocks.json`, or explicit manual dispatch. It shares the existing database-operation concurrency group. The CLI is `npm run practice:activate-timed-mocks -- --apply` under a current ADMIN. Ordinary pushes do not silently release new draft versions.

Activation validates all members of both mocks before committing, checks exact configurations and preserves existing templates if an operator changed their settings. It pins IDs, versions and content hashes in private `timed-mock.activate-unreviewed` audit events. Missing, incomplete, archived or wrong-track questions roll back the entire release. Repeating an unchanged release is idempotent. It never modifies Question status, creates Review rows, changes the five sequential sets or relaxes unrelated topic/mock/PDF/payment gates.

The two fixed slug/configuration combinations alone can read these audited drafts. Changing mode/access/track/topics/count/duration invalidates the exception. Editing pinned question content blocks new starts until explicitly released again. Started attempts keep their immutable content and draft notice. The lobby and player say unreviewed, never independently approved. Existing independently reviewed publication remains supported.

## Learner path

Sign in, open `/practice`, choose a learning track and **Timed mock examination**, select the draft mock, then **Start this session**. No completion of the untimed sequence is required. Use question-number selection, answer/flag controls and saved history as usual. Browser reloads do not restart the timer. The deadline is set and enforced by the database clock; reopening/returning to a tab resynchronizes it. Time continues while away. At expiry only answers previously saved before the deadline count. With no browser/request running, finalization occurs on the next attempt/history read, not a background scheduler. Early submission is permitted, and unanswered items count as zero. Keys and explanations are returned only after submission/expiry. Counts, scores and drafts do not imply official readiness.

## Verification

`npm run test:timed-mocks` uses the normal disposable database wrapper and synthetic questions. It checks both tracks, atomic release failures, role checks, idempotency, truthful DRAFT/Review states, count/topic override rejection, hidden pre-submission keys, saved answers after reload, countdown movement, deadline preservation, owner isolation, automatic browser expiry, late-write rejection, immutable results and configuration/hash invalidation. Desktop/mobile axe scans cover the selected lobby and 160-item player. Tests never activate or approve real content.
