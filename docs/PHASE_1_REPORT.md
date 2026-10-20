# Phase 1 report

Recorded 2026-10-20. Foundation source is implemented; complete cloud/database onboarding remains blocked by the engine-download network rule.

## Implemented

- Next.js 16 App Router, TypeScript, Tailwind 4, navy/ivory/gold responsive design and keyboard focus/skip navigation.
- Landing page, planned product catalog with validated configurable PHP prices, track-filtered curriculum, original Markdown draft lesson and ungraded retryable arithmetic exercise.
- Independence and provisional-coverage notices, honest development labels, policy/support drafts; no fabricated account or progress statistics.
- Prisma 7 schema and SQL migration with 21 PostgreSQL tables including relations for identity, content/review, questions, exam attempts, products/prices, orders/payments, entitlements, downloads and audit events.
- Local PostgreSQL Compose, random-password ignored local environment setup, repeatable non-overwriting draft seed and ORM integration-check script.
- Required README, AGENTS, architecture, roadmap, content standards, CSC verification register, environment example and deployment/backup guidance.

## Commands and evidence

| Command/check | Result |
| --- | --- |
| npm run lint | Passed, zero warnings |
| npm run typecheck | Passed |
| npm test | 8 tests passed |
| npm run content:check | 1 DRAFT question and 1 DRAFT lesson validated structurally; not human-approved |
| npm run build | Public production build passed using current installed files; this does not establish a clean ORM install |
| PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e | 6 tests passed: desktop/mobile navigation and track selection, lesson rendering, ungraded exercise retry/explanation and invalid-policy 404 |
| npm run local:env; npm run db:up | Local .env created securely; PostgreSQL 17 container healthy |
| npm run test:db | Failed before queries: older cached generated client is incompatible with Prisma 7 runtime; regeneration is blocked by the engine-host rule |
| Generated migration executed through psql in BEGIN/ROLLBACK | All 21 tables and constraints created successfully, then rolled back; no migration deployed or data seeded |
| npm run dev -- --port 3000 | Started; home rendered and title verified; desktop screenshot inspected |
| GET /api/health | HTTP 503 with sanitized unavailable-database response; full readiness is not established |
| npm audit --omit=dev --audit-level=high | Zero reported production dependency vulnerabilities at check time |

## Diagnosed failures and remaining prerequisite

Initial Prisma 6 engine generation was blocked by HTTP 403 from binaries.prisma.sh. Its JavaScript migration alternative could generate a client but failed on PostgreSQL's native name type. The project now pins Prisma/Client/adapter 7.10.1 and uses standard migration configuration. Regenerating the matching Prisma 7 client requires the blocked engine host; the locally cached older generated client is not a verified Prisma 7 installation. Database-dependent operations remain unavailable. No TLS or checksum checks were disabled, and the old experimental migration configuration is not retained.

The first desktop browser run timed out waiting for a link to settle while smooth scrolling was active. Removing smooth scrolling resolved the failure; the final run passed all six tests. A Playwright browser download was denied by network policy; existing system Chromium was used successfully instead.

Saved environment draft fields: network.allowed_domains adds binaries.prisma.sh; install_script; start_skill. Saving these does not apply runtime settings or publish. Review/save the network change in environment settings; publish the environment only after the outstanding database checks succeed. No secrets were requested or saved.

After network access is applied, rerun npm ci, npm run db:generate, npm run db:migrate, npm run db:seed twice, and npm run test:db. Rebuild and repeat /api/health; require HTTP 200. This regeneration and the full migration/seed workflow have not passed yet. npm ci must preserve package-lock.json. Existing .env and user-edited database records must be preserved.

## Limits and next phase

Only one sample lesson and one question-bank fixture exist; the 25 chapters are outlines. There are no accounts, authenticated dashboards, admin writes, actual exams, PDFs, entitlements, downloads, email or payments. Official 2027 information, legal/historical source claims and draft commercial policies await human review. No gateway is connected. No production deployment, environment publication, fresh-task restoration or GitHub push has been performed.

Finish database validation, then proceed to Phase 2: authentication, role-protected editorial review and PDF generation. The commercial launch gate remains at least 500 independently checked original questions and the remaining security/integration/legal checks in ROADMAP.md.
