# Implementation plan

1. **Foundation (current):** Next.js App Router, TypeScript, Tailwind, responsive public shell, curriculum browsing, Markdown sample lesson, interactive ungraded exercise, PostgreSQL/Prisma schema and migration, idempotent draft seed, validation and setup docs. No user accounts or purchases.
2. **Editorial and PDF:** secure authentication and role checks; chapter/question CRUD; validated import/export; independent reviewer approval; publication state machine; Playwright PDF worker; cover, linked contents, print layout, headers, footers, preview and private full editions. Validate PDF searchability, links, layout and access boundaries.
3. **Exam engine:** server-owned attempts, snapshot question versions, strip correct answers, persisted responses, deadline enforcement, idempotent submission/grading, subject reports and history. Test tampering, concurrency, expired attempts, and entitlement checks.
4. **Commerce:** product/price administration, authenticated orders, payment adapter and local mock, verified webhook state transitions, entitlements, private object storage, short-lived download links, email delivery and audit logs. Mock events must never grant production access.
5. **Launch hardening:** independently checked bank of at least 500 original questions, verified legal/CSC references, 2027 human review, provider sandbox proof, privacy/refund/support review, backups and restore drill, rate limiting, observability, accessibility, load and security tests.

Each milestone requires lint, typecheck, relevant tests, production build and a manual review. Later phases are not silently treated as completed by scaffolding tables. Prices, counts and simulated durations are configuration, never official promises.
