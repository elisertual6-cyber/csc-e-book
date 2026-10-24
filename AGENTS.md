Read docs/REMOTE_RECOVERY.md before remote backups. Source DB access is read-only; restore only to generated databases in marked disposable containers and generated private buckets. Never upload unencrypted archives, reuse provider credentials as encryption keys, log source output or restore over customer data. Run test:remote-recovery for capture/restore changes; its fixture must never inherit hosted credentials.

Read docs/PDF_STORAGE.md before PDF/storage changes. Preserve backend references, private bucket checks, create-only writes, checksums and all release/access gates. Never inherit remote storage credentials into isolated test runs. Vercel must not render Chromium or silently use local disk.

# Working on this project

Read docs/PHASE_5F_REPORT.md for signed-in accessibility coverage. Run test:a11y:authenticated through its disposable database wrapper for learner/staff UI changes. Preserve answer-save locks and focus after acknowledged saves without stealing focus after navigation. Automated scans never count as manual conformance review.

Read docs/STUDY_PLANNER.md before changing planner progress. Browser saving is optional, limited to planner settings/day numbers and separate from accounts or graded attempts. Never place question content, answers, credentials or tokens in planner storage. Completing a plan is not exam readiness or editorial review.

Read docs/SUPABASE_SETUP.md before hosted database setup. Preserve Prisma migration history, server-only connections and RLS on private tables. Hosted migrations use the manual main-branch workflow; builds must not migrate or seed. Disposable test setup must override both DATABASE_URL and DIRECT_URL.

Use the existing checkout: cloud tasks are isolated; do not create worktrees unless asked.
Read docs/ROADMAP.md and docs/ARCHITECTURE.md before changing scope.
Run npm run lint, npm run typecheck, npm test, npm run content:check, and npm run build for major changes. Run npm run test:e2e for UI changes and npm run test:db for database changes.
Keep content marked DRAFT until independently reviewed. Never describe demo progress, prices, questions, or timing as official CSC information. Never expose answer keys in attempt responses before server-side submission.
Every admin endpoint must enforce and test authentication and role authorization. Keep production checkout and paid delivery disabled until entitlement checks and provider signature verification are implemented and tested. Never commit .env or secrets.
Phase 2 adds custom database sessions, editorial review and a private-disk PDF worker; read docs/EDITORIAL_OPERATIONS.md before operating them. The product is still a development service, not a production commerce launch. Public registration defaults off in production. Browser/security tests must use npm run test:e2e, which provisions a disposable database; never run bare playwright test against development/customer data. Simulated test approvals do not count as human review.

Phase 3 exam operations are documented in docs/EXAM_OPERATIONS.md. Preserve database-clock deadlines, immutable snapshots, owner/entitlement checks, idempotent start/submit and revision-controlled saves. Keep client question DTOs separate from private grading snapshots. No real questions or templates may be auto-approved/activated by setup or tests.

Read docs/COMMERCE_OPERATIONS.md for development checkout. Never enable mock purchase actions or mock-backed paid access in production. Download tokens must remain hashed, owner-bound, short-lived and revalidated on consumption. Real payments remain disabled; hosted private storage and manual Gmail account email are operator-confirmed. Automatic hosted delivery remains a separate rollout check. Account mail can use the tested Node SMTP adapter only after secure operator configuration; private file copies are not sent email. Read docs/ACCOUNT_SECURITY.md and docs/MAIL_SETUP.md. Run test:mail:automatic through its disposable database wrapper for automatic dispatch/retry changes; use loopback SMTP and synthetic accounts, never hosted recipients. Preserve single-use hashed account tokens, encrypted mail payloads, strict TLS, session generation checks and reset/login row locks. Do not expose credential links through APIs or logs.

Read docs/GCASH_OPERATIONS.md before payment changes. GCash uses a sandbox-only PayMongo adapter. Live keys/mode and production checkout are rejected. Keep raw-body signature verification, canonical amount/currency/method/intent/order binding, monotonic refunds and idempotent fulfillment. Never treat redirect queries, screenshots or unsigned events as payment proof. paymongo_test records must never grant production customer access. The local fixture is not actual merchant sandbox evidence.

Read docs/BACKUP_OPERATIONS.md before recovery operations. Backup commands target only the local Compose service and require paused application/worker writes; never point restore commands at customer data. Local archives are sensitive and unencrypted. Verify only trusted archives and preserve separately managed encryption keys. Accessibility checks use npm run test:a11y through the disposable database wrapper; never disable failing axe rules to make a scan pass or claim automated scans establish conformance.

Read docs/OPERATIONS_MONITORING.md for request references, structured logs and health probes. Never log raw requests, paths/tokens, identity, credentials or exception details. Uptime alone is not database readiness. Run test:load/test:readiness only through their isolated npm wrappers and never aim load tests at customer/production data. The short local load run is not production capacity evidence; no external alerting service is configured.

Read docs/DRAFT_LESSONS.md, docs/ENGLISH_DRAFTS.md, docs/READING_DRAFTS.md and docs/TRACK_DRAFTS.md for the current public previews and manually imported review packs. Public previews are ungraded drafts with teaching solutions, not published editorial versions. The source repository is public; do not put private paid banks there. No new questions/lessons are automatically seeded, reviewed or activated. content:export prepares inputs only; real imports and independent approval remain separate. Preserve the fixed lesson and pack allowlists, match track labels to the curriculum and do not import assessment packs into public/client routes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
