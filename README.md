# Philippine Civil Service Exam Reviewer 2027

An independent, unofficial learning platform for Professional and Subprofessional preparation. **Not affiliated with, endorsed by, or approved by the CSC. No passing guarantee.** Official 2027 coverage, dates, durations and scoring remain unverified.

## Phase 1: a working foundation

Next.js App Router + TypeScript + Tailwind, PostgreSQL + Prisma, Zod validation, Vitest and Playwright. Includes a responsive landing page, configurable illustrative PHP catalog, track-based curriculum, Markdown lesson preview, ungraded interactive arithmetic exercise, policy drafts and database health endpoint.

The 25-chapter curriculum is an outline, with **one original draft lesson and one draft bank question**. Content is not independently reviewed or approved for commercial publication. No login, admin dashboard, PDF generation, paid downloads, checkout or server-graded exams are exposed yet. No real gateway is integrated; `PAYMENT_PROVIDER=mock` reserves a later development setting, not an implemented payment flow.

## Local setup

Requires Node.js 24 (see .nvmrc), npm, Docker with Compose, and port 5432 available. Use this existing checkout; cloud tasks are already isolated.

**Current cloud blocker:** allow `binaries.prisma.sh` in environment network settings before a clean install or database setup. That change is saved in the environment draft but has not been applied or published. The public demo runs; ORM regeneration, migration deployment and seeding remain unverified. See docs/PHASE_1_REPORT.md for exact results.

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

On this cloud machine, Chromium is already installed. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` instead of downloading a browser. Playwright starts a production server on port 3100, so build first and keep that port free. If your home cache is not writable, pass `--cache /workspace/.npm-cache` to npm and `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright` when installing/running bundled browsers.

To run the production server locally: `npm run build`, then `npm start`. Development uses `npm run dev`. Ctrl+C stops the app; use Compose separately to stop the database. No localhost web preview is published by cloud onboarding.

## Project map

- `src/app`: public routes, ungraded practice, draft policies and `/api/health`.
- `src/lib`: track metadata, price validation, content integrity checks and server-only database client.
- `content/`: editable original Markdown and a DRAFT question fixture. Not under `public/`.
- `prisma/`: relational schema, checked-in migration and idempotent draft seed.
- `tests/`, `e2e/`: content/configuration unit tests and desktop/mobile browser tests.
- `docs/ROADMAP.md`: small, testable milestones.
- `docs/ARCHITECTURE.md`: boundaries and future security requirements.
- `docs/CONTENT_STANDARDS.md`, `docs/CSC_VERIFICATION.md`: editorial gates and unverified source register.
- `docs/DEPLOYMENT.md`: release, backup and production prerequisites.

## Next phase

Implement authentication and role-protected editorial workflows, independent content approval, and PDF generation. Do not enable sales before the 500-question review target, authoritative source checks, legal policies, private file delivery and payment sandbox verification are complete.
