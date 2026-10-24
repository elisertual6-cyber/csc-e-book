# Philippine Civil Service Exam Reviewer 2027

An independent, unofficial learning platform for Professional and Subprofessional preparation. **Not affiliated with, endorsed by, or approved by the CSC. No passing guarantee.** Official 2027 coverage, dates, durations and scoring remain unverified.

## Current development stage: reviewed sessions, development commerce and account recovery

Next.js App Router + TypeScript + Tailwind, PostgreSQL + Prisma, Zod validation, Vitest and Playwright. Includes a responsive landing page, configurable illustrative PHP catalog, track-based curriculum, Markdown lesson preview, ungraded interactive arithmetic exercise, policy drafts and database health endpoint.

The 25-chapter provisional curriculum now links to **five public draft lessons** at `/lessons`. There is one seeded draft question plus a **20-question numerical editorial review pack** for manual import; the pack is not automatically placed in the database or graded exams. None of this content is independently approved for commercial publication. Phase 2 adds customer sign-in, an editorial dashboard, independent review and protected PDF generation. Phase 3 adds server-owned practice/mock attempts, saved responses, deadline enforcement, grading, explanations and history. Phase 4 adds development commerce and protected downloads; GCash has a sandbox-only adapter without real merchant test evidence. `PAYMENT_PROVIDER=mock` enables simulations only outside production. Read [DRAFT_LESSONS.md](docs/DRAFT_LESSONS.md) for content/review boundaries and export steps.

## Accounts and editorial workflow

Open /register to create a synthetic development customer account, or /login to sign in. Customer accounts cannot access /admin. Staff bootstrap, review, import/export and PDF release procedures are documented in [docs/EDITORIAL_OPERATIONS.md](docs/EDITORIAL_OPERATIONS.md). There are no default staff passwords; operator-created authors and independent reviewers must use separate accounts. Public registration is disabled by default in production until explicitly enabled.

PDF generation uses Node and Chromium, stores files privately outside public/, and exposes only an explicitly released, independently reviewed free preview. No reviewer content is automatically approved during setup. Full commercial editions require 500 unique reviewed questions and are delivered only to entitled purchasers after separate admin release. Draft proofs may be attached to mock products solely in development.

## Practice sessions and reports

Signed-in learners use /practice and /practice/history. Admins configure inactive templates at /admin/exams, then activate them only after enough independently reviewed questions are published. Topic practice supports validated smaller counts and optional untimed sessions; mock exams use operator-defined fixed counts/timers. No official 2027 timing, coverage or scoring is implied.

Answer keys stay server-side until submission/expiry. Attempts retain immutable question/settings snapshots, progress is acknowledged after server saves, and row locks/revisions prevent stale writes or repeated grading. Premium content requires a current purchased entitlement and coherent paid/verified financial records; development mock checkout now creates those records transactionally, while mock-backed access remains blocked in production. No real templates, approvals or paid records are seeded. See [docs/EXAM_OPERATIONS.md](docs/EXAM_OPERATIONS.md).

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

Seed is transactional and repeatable: it never overwrites existing lessons, question versions or product prices. It creates inactive products and DRAFT material only. The public planned catalog reads `PRICE_BASIC_PHP`, `PRICE_COMPLETE_PHP`, and `PRICE_PREMIUM_PHP` (defaults 99/199/399). The storefront uses authoritative database prices and immutable order amounts; these planned landing-page examples are not checkout authority.

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
- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md): private connection configuration and the manual GitHub migration workflow.
- [docs/ADMIN_SETUP.md](docs/ADMIN_SETUP.md): manual administrator creation using private repository secrets.
- [docs/NUMERICAL_IMPORT.md](docs/NUMERICAL_IMPORT.md): manual import of unapproved numerical content with existing-record preservation.
- `docs/BACKUP_OPERATIONS.md`: local backups, isolated restore verification and recovery limitations.
- `docs/OPERATIONS_MONITORING.md`: uptime/readiness, private request diagnostics and bounded local load tests.

Run `npm run test:a11y` after building for automated public-page WCAG AA and keyboard checks; it uses the same disposable database/browser runner as the full suite. Chromium can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` on this cloud. These checks do not replace manual screen-reader, zoom, authenticated-state or WCAG conformance review.

## Next phase

Phase 5 and production integrations: verified provider sandbox/signatures/refunds, real SMTP authorization/delivery evidence, durable shared private storage, production recovery smoke tests, backups/restore, accessibility and operational hardening. Do not enable sales before the 500-question review target, authoritative source checks, legal policies, private file delivery and payment sandbox verification are complete.

## Development storefront

The storefront at `/shop`, customer library at `/account/purchases` and admin products/orders at `/admin/products` implement development mock commerce. Production checkout remains disabled. Prices are server-owned, simulated fulfillment is atomic, and private download links require live purchase access and expire after five minutes. No real payment or email service is integrated. Read [COMMERCE_OPERATIONS.md](docs/COMMERCE_OPERATIONS.md) before operating or deploying this workflow. `npm run test:commerce` runs isolated development purchase tests; stop the checkout's other development server first.

## Account verification and recovery

Account email verification, `/forgot-password` and `/reset-password` are implemented with expiring single-use credentials and session revocation. The encrypted mail queue has a Node SMTP adapter and a private development inbox. Run `npm run mail:work` to process due mail; no external provider is configured by default. Production mail stays disabled until securely configured, and local inbox files do not send email. See [ACCOUNT_SECURITY.md](docs/ACCOUNT_SECURITY.md) for worker scheduling, configuration, TLS and remaining provider authorization.

## GCash customer payments

GCash is the chosen customer payment method through PayMongo-hosted checkout. A sandbox-only adapter, signed-event verification, canonical payment checks, reconciliation and refund/access handling are implemented and tested locally. Actual merchant sandbox calls and live payments are **not verified or enabled**. PayMongo credentials, merchant GCash activation, current API contract verification and the other launch gates remain required. See [GCASH_OPERATIONS.md](docs/GCASH_OPERATIONS.md). `npm run test:gcash` exercises only disposable local protocol fixtures on desktop/mobile.
