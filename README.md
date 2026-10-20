# Philippine Civil Service Exam Reviewer 2027

An independent, unofficial learning platform for Professional and Subprofessional preparation. **Not affiliated with, endorsed by, or approved by the CSC. No passing guarantee.** Official 2027 coverage, dates, durations and scoring remain unverified.

## Current development stage: reviewed practice and exam simulation

Next.js App Router + TypeScript + Tailwind, PostgreSQL + Prisma, Zod validation, Vitest and Playwright. Includes a responsive landing page, configurable illustrative PHP catalog, track-based curriculum, Markdown lesson preview, ungraded interactive arithmetic exercise, policy drafts and database health endpoint.

The 25-chapter curriculum is an outline, with **one original draft lesson and one draft bank question**. Content is not independently reviewed or approved for commercial publication. Phase 2 adds customer sign-in, an editorial dashboard, independent review and protected PDF generation. Phase 3 adds server-owned practice/mock attempts, saved responses, deadline enforcement, grading, explanations and history. Paid downloads and checkout remain unimplemented. No real gateway is integrated; `PAYMENT_PROVIDER=mock` reserves a later development setting, not an implemented payment flow.

## Accounts and editorial workflow

Open /register to create a synthetic development customer account, or /login to sign in. Customer accounts cannot access /admin. Staff bootstrap, review, import/export and PDF release procedures are documented in [docs/EDITORIAL_OPERATIONS.md](docs/EDITORIAL_OPERATIONS.md). There are no default staff passwords; operator-created authors and independent reviewers must use separate accounts. Public registration is disabled by default in production until explicitly enabled.

PDF generation uses Node and Chromium, stores files privately outside public/, and exposes only an explicitly released, independently reviewed free preview. No reviewer content is automatically approved during setup. Full commercial editions require 500 unique reviewed questions and remain inaccessible to customers pending the commerce phase.

## Practice sessions and reports

Signed-in learners use /practice and /practice/history. Admins configure inactive templates at /admin/exams, then activate them only after enough independently reviewed questions are published. Topic practice supports validated smaller counts and optional untimed sessions; mock exams use operator-defined fixed counts/timers. No official 2027 timing, coverage or scoring is implied.

Answer keys stay server-side until submission/expiry. Attempts retain immutable question/settings snapshots, progress is acknowledged after server saves, and row locks/revisions prevent stale writes or repeated grading. Premium content requires a current purchased entitlement and coherent paid/verified financial records; no checkout or entitlement fulfillment exists yet. No real templates, approvals or paid records are seeded. See [docs/EXAM_OPERATIONS.md](docs/EXAM_OPERATIONS.md).

## Local setup

Requires Node.js 24 (see .nvmrc), npm, Docker with Compose, and port 5432 available. Use this existing checkout; cloud tasks are already isolated.

**Phase 1 database setup is verified:** clean installation, matching Prisma client generation, migration deployment, repeatable seeding and ORM integration all pass. Engine downloads require `binaries.prisma.sh`, which is now reachable in this environment. See docs/PHASE_1_REPORT.md for validation details. Publication and restoration into a new cloud task are separate steps.

```bash
cd /workspace/csc-e-book
npm ci
npm run local:env
npm run db:up
npm run db:migrate
npm run db:seed
npm run test:db
npm run dev
```

On your own computer, replace the working directory with your clone's path. The app serves port 3000. Request `/api/health`: expect HTTP 200 with `database: connected`. An unavailable database yields HTTP 503; the static lesson and demo UI can still run.

`local:env` creates an ignored, mode-0600 `.env` with a random local PostgreSQL password and preserves any existing configuration. Never print or commit its contents. Compose binds PostgreSQL to loopback and retains data in a named Docker volume. `npm run db:down` stops the database without deleting that volume. Restart with `npm run db:up`. Docker volumes and processes may not survive a new cloud machine; replay setup when necessary. For hosted PostgreSQL, inject `DATABASE_URL` through environment settings and skip Compose; use the provider's verified TLS configuration.

Seed is transactional and repeatable: it never overwrites existing lessons, question versions or product prices. It creates inactive products and DRAFT material only. The public planned catalog reads `PRICE_BASIC_PHP`, `PRICE_COMPLETE_PHP`, and `PRICE_PREMIUM_PHP` (defaults 99/199/399). A later commerce implementation must use authoritative database prices and immutable order amounts, never client-supplied prices.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run content:check
npm run build
npm run test:db
# Install Playwright Chromium once, if no system Chromium is available:
npx playwright install chromium
npm run test:e2e
```

On this cloud machine, Chromium is already installed. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` instead of downloading a browser. The test wrapper creates a disposable PostgreSQL database, migrates/seeds it, starts a production server on port 3100, and removes that test database and its private PDF files afterward. Build first, keep that port free, and use a database role permitted to create/drop test databases. Simulated approvals in tests never touch the development content bank. PDF checks also require pdftotext (provided in this cloud). If your home cache is not writable, pass `--cache /workspace/.npm-cache` to npm and `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright` when installing/running bundled browsers.

To run the production server locally: `npm run build`, then `npm start`. Development uses `npm run dev`. Ctrl+C stops the app; use Compose separately to stop the database. No localhost web preview is published by cloud onboarding.

## Project map

- `src/app`: public pages, account/editorial UI, protected APIs, free preview route and `/api/health`.
- `src/lib`: database-backed sessions, password hashing, authorization, content workflow, PDF worker, exam snapshots/grading, curriculum and price validation.
- `content/`: editable original Markdown and a DRAFT question fixture. Not under `public/`.
- `prisma/`: relational schema, checked-in migration and idempotent draft seed.
- `tests/`, `e2e/`: content/configuration unit tests and desktop/mobile browser tests.
- `docs/ROADMAP.md`: small, testable milestones.
- `docs/ARCHITECTURE.md`: boundaries and future security requirements.
- `docs/CONTENT_STANDARDS.md`, `docs/CSC_VERIFICATION.md`: editorial gates and unverified source register.
- `docs/DEPLOYMENT.md`: release, backup and production prerequisites.

## Next phase

Phase 4: implement product/price administration, orders, a development mock payment adapter, verified fulfillment, customer entitlements and private paid downloads. Do not enable sales before the 500-question review target, authoritative source checks, legal policies, private file delivery and payment sandbox verification are complete.
