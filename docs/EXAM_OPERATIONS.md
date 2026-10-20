# Exam simulator operations

The Phase 3 simulator provides authenticated topic practice, timed mock sessions, safe progress persistence, server-side grading and private history. It does not supply official CSC scores, passing predictions or verified 2027 question counts/durations. The actual development question bank remains DRAFT. No exam templates or paid entitlements are automatically seeded.

## Prepare reviewed sessions

1. Start the existing development checkout using README.md. Apply all migrations and regenerate Prisma after schema changes.
2. Use the separate author/admin and reviewer accounts described in EDITORIAL_OPERATIONS.md. Create, independently review and publish original questions first. The seed draft has no approval; copying it creates an authored draft that needs its own substantive review.
3. As ADMIN open /admin/exams. Configure the title/key, Professional or Subprofessional track, mode, access, topic keys, count and duration. New templates default to PREMIUM and inactive.
4. Explicitly activate the template. Activation requires enough independently approved PUBLISHED questions matching its topics and track. Shared COMMON questions can participate in either track. Starts recheck eligibility and choose the latest eligible version per question key, without duplicate keys.
5. Saving a template creates a new configuration version and deactivates it. Reactivate after checking content/access. Existing attempts retain their original settings and question snapshots. Deactivation stops new starts without discarding existing progress.

FREE means a signed-in customer may use that reviewed session. PREMIUM requires purchased access, except for staff QA using their own accounts. There is no checkout or public entitlement-grant API in this phase. Do not fabricate paid records to make a production demo pass.

PRACTICE accepts a smaller count up to the template maximum and an optional topic within its configured list. Set durationSeconds=0 for untimed practice. MOCK uses the exact template count/topics/timer; client overrides are rejected. Nonzero durations range from 60 to 14400 seconds and counts from 1 to 200. These are configurable application limits, never assertions about official examinations.

## Student workflow

Sign in, open /practice, choose Professional/Subprofessional and topic practice/timed mock, then select an available session. Premium choices explain that purchased access is required. If reviewed content is unavailable, no empty or unreviewed attempt is created; the existing ungraded teaching exercise remains available.

Each accepted answer/flag change is persisted to PostgreSQL. The browser shows confirmation only after the server acknowledges it. Unknown outcomes or conflicting edits require reloading before further writes. No question content/answers are persisted in localStorage. Reload, navigate questions, flag items and resume through /practice/history. A maximum of three active sessions per learner prevents accidental duplicate starts; all active sessions remain visible even when older than recent completed history.

Start requests use a UUID idempotency key bound to their exact selection. Retrying that selection/key returns the same attempt, including under concurrent requests. Changing the selection requires a new key. The UI preserves its key across a failed start request; check history if uncertain whether a different session already started.

Submit uses stored responses only. Unanswered questions receive zero credit within the original denominator. Server grading returns explanations and correct answers after submission or expiry. Repeated/concurrent submissions return the same finalized grade and timestamp, and create no second grading event. Completed responses cannot be changed.

## Timing and concurrency

The database clock sets startedAt/deadlineAt and evaluates saves after acquiring the attempt row lock. Client timestamps, counters, score fields and deadline overrides are not trusted or accepted. A save accepted before the server cutoff counts; a request waiting for the lock until after cutoff is late. The late payload is ignored and only previously saved responses are graded.

The UI synchronizes its display from serverNow, polls idle active sessions and refreshes after returning to the tab. At expiry it disables further answer changes and synchronizes the result. With no browser/request running, an overdue row can remain IN_PROGRESS in storage until its next attempt read, save, submit, history read or start cleanup. That lazy finalization never extends the acceptance deadline; no background timer/cron grading service is claimed.

Question and template snapshots are immutable for an attempt. Later question versions or template edits cannot alter its result. PostgreSQL row locks serialize writes/submission; revision checks reject stale saves. A per-user advisory transaction lock serializes starts and enforces the active-session cap. Unknown question keys, invalid labels, duplicate responses or any invalid member of a batch reject the whole write.

## Paid-access boundary

Premium question content is checked at every start, detail read, response write and submission. It requires an unrevoked, unexpired entitlement for an exam-granting product, belonging to the same customer as a PAID order. The order must contain the entitled product, have coherent positive-quantity/nonnegative-price line items and matching price products/currencies, and total exactly the saved line-item sum. A VERIFIED payment with verifiedAt must match that order's amount and currency. Mock-provider payments cannot unlock production customer access.

These are checks against trusted database records, not a verified gateway integration. Only isolated tests create synthetic paid/payment records. Phase 4 must establish those states through authenticated administration or verified provider events and idempotent fulfillment; no provider credentials or sandbox connection is configured here.

Revocation, expiry, refund or inconsistent financial data blocks premium question reads/writes even for an existing attempt. A learner can still see their own summary scores and subject statistics without recovering protected question text. FREE attempts remain free according to the access selected when they began; changing a template does not retroactively charge them.

## Reports and privacy

/practice/history lists every active session plus the most recent 50 completed attempts. Subject reports and the average are computed only from those completed attempts, explicitly labelled as recent practice results. They are not lifetime metrics or CSC outcomes. Before submission, attempt DTOs include public question text/options and the learner's responses only; no correct flags, explanations, source keys, full snapshots or bank IDs are sent.

All APIs require authenticated ownership; another customer's ID returns 404. Responses use private/no-store caching. Protected mutations additionally enforce configured APP_URL Origin and the custom action header. Paid content, expired sessions and revoked roles retain the Phase 2 authentication rules.

## API and tests

- GET /api/exams/templates: active configuration metadata and whether the current learner has access.
- POST /api/exams/attempts: templateId, startKey and optional practice topic/questionCount.
- GET /api/exams/attempts/:id: own attempt, lazily finalizing expired sessions.
- PATCH /api/exams/attempts/:id: revision and responses [{questionKey, choiceLabel, flagged}].
- POST /api/exams/attempts/:id: {action:"submit"}; no client score or response payload.
- GET /api/exams/history: own summaries, active sessions and recent subject statistics.
- GET/POST /api/admin/exam-templates: ADMIN-only configuration and activation.

Use npm run test:e2e, never bare Playwright against live data. The wrapper creates/migrates/seeds a disposable database and drops it afterward. Simulated independent approvals and payment records exist only there. Browser tests cover desktop/mobile persistence, flags, reports and a device clock set to the past; API tests cover private keys, ownership, atomic invalid writes, concurrent starts/saves/submissions, immutable versions, late answers, access revocation/expiry/refunds, financial mismatches, mock payments and session quotas.

Migration 202610200003_exam_engine is additive except making deadlines nullable for untimed practice. Existing records are preserved. A manually created legacy attempt without a recognized version snapshot fails closed with an operator-review response; it is not reset or silently assigned an invented grade.

Before commercial launch, finish the 500-question independent review target, verified coverage/source work, commerce fulfillment, deployment/privacy/security review, monitoring and load/restore testing from ROADMAP.md.
