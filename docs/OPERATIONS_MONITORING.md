# Uptime, readiness and request diagnostics

`GET /api/live` returns 200 when the Node route can run. It has no database dependency and does not prove that accounts, exams or payments work. `GET /api/health` returns 200 with `database: connected` after a real `SELECT 1`, otherwise 503 with a generic unavailable result. Public demo hosting without PostgreSQL should therefore pass uptime and fail database readiness. Neither response exposes connection strings, exception details, customer data or payment credentials. Both are uncached.

Readiness uses a separate PostgreSQL pool with at most one connection per warm application process, a two-second connection/queue acquisition timeout, a two-second database statement timeout, a 2.5-second client query timeout and ten-second idle eviction. Queue acquisition plus query time can exceed either individual timeout. Idle connection failures are caught; later probes can reconnect. These diagnostic limits do not alter application/PDF/editorial transaction timeouts. This probe checks connectivity, not schema migrations, database capacity, remote storage, SMTP delivery or PayMongo availability. Use the existing deployment/database checks and provider smoke tests for those.

All handlers using the shared `api` wrapper return a fresh `X-Request-ID` header. Success, authorization failure, validation failure and internal failure use the same mechanism. Client-supplied IDs are not trusted or reused. References are random per request; they do not encode account, order or token identifiers. This coverage does not include framework-generated 404/405 responses, page rendering errors or hosting/proxy errors before the handler runs.

Set the server-only variable `OBSERVABILITY_LOGS=true` to emit one structured JSON completion event for each wrapped API request. Without it, responses with status 500 or higher still produce a minimal structured error event; other completions are silent. Expected unavailable features can also return 503, so interpret the operation/status and configured deployment capabilities before alerting. No external telemetry service, log shipping, dashboard, email alert or scheduler is provisioned by this milestone.

Events contain only `event`, `timestamp`, `requestId`, a fixed operation group (`auth`, `admin`, `commerce`, `exam`, `preview`, `health`, `live`), `status`, rounded `durationMs` and an optional fixed failure category. They exclude raw URLs/path parameters, query strings, request/response bodies, IP addresses, names/emails, cookies, authorization/signature headers, payment references and exception names/messages/stacks. Log sink exceptions cannot change a committed operation's HTTP outcome. The existing business audit trail remains separate; completion events are not proof of payment or a replacement for transaction audit events.

Hosting/CDN/framework access logs are separate and can still contain paths or queries. Configure those systems to redact download/account tokens and restrict collection before real users are admitted. Keep access and retention limited; do not add request/response payload logging to investigate a request reference. An operator should locate the reference in the private log sink and examine the corresponding controlled business workflow without exporting personal information.

For the eventual hosted service, provision an external monitor for `/api/live` and, once a database is expected, `/api/health`. Configure retry/window thresholds to avoid alert storms, an authorized notification destination, and a response owner. Monitor 5xx rate and latency by operation alongside database connections, mail retry/queue depth, payment reconciliation and storage failures. No account or inbox is assumed to be authorized for automated alerts. For Vercel, environment-variable changes need a redeployment; configure `APP_URL` as the final exact HTTPS origin and leave registration, mail and checkout off until their prerequisites pass.

## Local regression and bounded load checks

Build first, keep test ports 3100/3150/3151 free, and run suites sequentially through the disposable-database wrapper:

```sh
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm run test:load
npm run test:readiness
```

The main suite verifies generated references, uncached uptime/readiness and denied mutation responses. `test:load` accepts only the generated `csc_e2e_<hex>` database and loopback target. After warmup, it sends exactly 100 reads at concurrency five across public pages, uptime, database readiness and the inactive catalog, then 40 cross-origin login requests at concurrency five that must all be rejected before authentication. It checks unique API references, no unexpected errors, unchanged account/session/order/attempt counts, and final readiness. Requests have a ten-second timeout; the total test is bounded to two minutes. It reports p50/p95/max timings as a private test attachment, not a production SLO or capacity claim. It does not perform password hashing, purchases, provider calls or transfers.

`test:readiness` starts two production servers, one without a configured database and one with an intentionally unreachable loopback database. Both must report 503 readiness while uptime and the public home page remain available. These fixtures do not stop or reconfigure the development database. All generated test databases are cleaned up by the existing runner. Password hashing, authenticated exams, PDF workers, provider callbacks, distributed/serverless scaling and sustained staging load still need separately scoped tests before launch.
