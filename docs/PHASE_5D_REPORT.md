# Phase 5D: operational diagnostics and bounded local load

The shared API wrapper now attaches a server-generated request reference and emits structured completion diagnostics when enabled. Error responses at status 500 or higher emit minimal structured events even when general completion logging is off. Auth, editorial, exam, commerce, webhook, protected file and preview handlers retain their existing authorization, cache and transaction behavior. Logs contain fixed operation/failure categories, status and timing; they never receive raw request data or exceptions. Unit tests check concurrency, redaction, preserved error/retry semantics and a throwing log sink.

Added `/api/live` for database-independent Node uptime. `/api/health` still performs a real database query and returns 503 on failure, using a separate one-connection diagnostic pool with bounded acquisition and query timeouts. This avoids changing business transaction limits or occupying application pool slots. Idle diagnostic connection errors are handled. The stale `phase: foundation` health field was removed; documented status/database fields remain. Neither probe claims the database schema, content, mail, storage or provider integrations are ready.

New checks cover generated references on success and denied actions, a missing/unreachable database with a working public demo, concurrent local reads and rejected cross-origin login requests. The load fixture accepts only the disposable database and loopback app, checks unchanged accounts/orders/attempts/sessions, and makes no external provider calls or transfers. All real content remains draft and products/templates remain inactive.

Validation commands:

```sh
npm run lint
npm run typecheck
npm test
npm run content:check
npm run test:db
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=2
npm run test:load
npm run test:readiness
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:commerce
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:gcash
```

Results: lint, typecheck, content/database validation and the production build passed. All 31 unit tests passed. The browser/security/provider suites passed: 20 main production cases, four development commerce/recovery cases, two local GCash emulator cases, two database-unavailability cases and one bounded load case (29 total).

The final single-project load run completed 100 reads and 40 rejected mutations at concurrency five. Read latency was p50 43 ms, p95 123 ms and maximum 152 ms on this local machine. API references were unique, account/session/order/attempt counts were unchanged, and final database readiness passed. An inherited Playwright project merge initially duplicated the load case; the configuration was corrected to run exactly one project and verified with the final run.

The load run is a short local regression check, not a sustained or production capacity assessment. Password hashing, authenticated exam throughput, PDF workers, real callbacks, staging/serverless scaling, external monitors/alerts and response ownership remain work before launch. Hosting/framework access-log redaction remains an operator responsibility; sanitized application events cannot redact upstream logs.

No Vercel deployment URL has been supplied or verified in this milestone. No monitoring provider, SMTP provider, managed backup/storage or real GCash merchant test was activated. Real sales remain blocked pending provider evidence/live implementation, reviewed legal/support/privacy information, production infrastructure and at least 500 independently reviewed original questions. See OPERATIONS_MONITORING.md and VERCEL_DEPLOYMENT.md.
