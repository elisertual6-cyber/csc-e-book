# Implementation plan

1. **Foundation (complete):** Next.js App Router, TypeScript, Tailwind, responsive public shell, curriculum browsing, Markdown sample lesson, interactive ungraded exercise, PostgreSQL/Prisma schema and migration, idempotent draft seed, validation and setup docs. No user accounts or purchases.
2. **Editorial and PDF (implemented):** secure authentication and role checks; chapter/question CRUD; validated import/export; independent reviewer approval; publication state machine; Playwright PDF worker; cover, linked contents, print layout, headers, footers, preview and private full editions. Validate PDF searchability, links, layout and access boundaries.
3. **Exam engine (implemented):** server-owned attempts, snapshot question versions, strip correct answers, persisted responses, deadline enforcement, idempotent submission/grading, subject reports and history. Test tampering, concurrency, expired attempts, and entitlement checks.
4. **Commerce (development milestone implemented):** product/price administration, authenticated orders, server-side mock payment boundary, atomic fulfillment, entitlements, private-disk artifacts, short-lived downloads, development notification outbox and audit logs. Real signed webhook/refund processing, remote private object storage and actual email delivery remain production integration work. Mock events must never grant production access.
5. **Launch hardening:** independently checked bank of at least 500 original questions, verified legal/CSC references, 2027 human review, provider sandbox proof, privacy/refund/support review, backups and restore drill, rate limiting, observability, accessibility, load and security tests.

Each milestone requires lint, typecheck, relevant tests, production build and a manual review. Later phases are not silently treated as completed by scaffolding tables. Prices, counts and simulated durations are configuration, never official promises.

Phase 2 implements the editorial/PDF software; it does not complete human review of the curriculum. The full edition content gate remains unmet. See EDITORIAL_OPERATIONS.md for bootstrap and release procedures.

Phase 3 implements server-owned reviewed sessions, grade/history reports and entitlement checks. No exam templates are automatically activated, and commerce/gateway fulfillment is still Phase 4. Read EXAM_OPERATIONS.md for access and timing semantics.

Phase 4 supplies server-priced mock checkout, idempotent transactional fulfillment, purchase entitlements, admin order/access controls, owner-bound short-lived downloads and a development notification outbox. A real signed payment/refund adapter, actual mail delivery and remote storage remain explicit integration work; no production gateway is claimed. See COMMERCE_OPERATIONS.md.
