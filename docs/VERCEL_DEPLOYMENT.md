# First Vercel deployment

The first deployment is a public development demonstration. Public curriculum, sample lesson and ungraded exercise pages can run without PostgreSQL. Accounts, reviewed exams, database-backed catalog/orders and database health require a separately provisioned managed PostgreSQL service. Without that service, `/api/health` correctly returns 503; a successful public page is not full-service readiness.

Use the repository root, Next.js framework preset, Node.js 24.x, `npm ci` and `npm run build`. Keep the output directory at the Next.js default. `vercel.json` records framework/build settings. `.vercelignore` excludes local environment files, private backups/PDFs/mail, dependencies and build/test output from CLI uploads. Never upload `.env` or the development database.

The build also runs `scripts/check-build-traces.mjs` after Next exits. Runtime manifests must reference existing files and must not include temporary `.next` locks, caches, development output, diagnostics or generated types. `next.config.ts` excludes those artifacts from route traces. This fixes the observed deployment error `ENOENT ... lstat '/vercel/path0/.next/lock'`: the completed compiler removes its lock before Vercel packages the traced files. Do not create a fake lock or disable Next's locking to work around it. Use `npm run build:check` to validate an existing production build; it intentionally fails stale builds until they are rebuilt.

The fix was checked with a fresh frozen dependency install and production build without local environment files, plus a rebuild with existing caches: 47 manifests referenced 881 existing runtime files and no temporary artifacts. Lint, typecheck, 39 unit tests and all 23 production browser/security cases passed. The fixed-window throttling fixture was made deterministic across minute rollover while preserving the 429 assertion and production limiter. After pushing a fix, verify that the Vercel deployment's Source points to that latest commit on `main`; a local build check does not establish a successful hosted deployment.

Sign in to Vercel with the operator's account. For CLI deployment, authenticate using the CLI's official interactive/device flow; never paste credentials or tokens into chat. Run `vercel --prod` from this checkout and choose the intended account/team and project. For Git-based deployment, import `elisertual6-cyber/csc-e-book` only after the tested local commits have been pushed to that repository; the original remote README alone cannot deploy this app. An account login/import step does not itself establish a successful deployment. Record the actual URL only after Vercel reports a successful build/deployment.

Set these server environment variables in the Vercel project settings and redeploy after changes:

| Variable | Initial value |
| --- | --- |
| `APP_URL` | Exact final HTTPS site origin, without a trailing slash |
| `REGISTRATION_ENABLED` | `false` |
| `GCASH_CHECKOUT_ENABLED` | `false` |
| `PAYMENT_PROVIDER` | `paymongo` |
| `PAYMONGO_MODE` | `test` |
| `MAIL_TRANSPORT` | `disabled` |

Do not set `NODE_ENV=development` on Vercel to bypass production payment safeguards. No PayMongo secret is necessary merely to display the demo. The existing adapter rejects production checkout/webhooks even with test credentials; this deployment does not complete GCash sandbox testing or enable real sales. Configure the PayMongo webhook only after preparing and verifying an appropriate reachable sandbox service. Never use example URLs or infer a Vercel domain from the project name.

For database-backed functionality, provision a separate managed PostgreSQL database and inject its supported TLS/pool connection string as `DATABASE_URL`. Use the provider's trusted certificates; do not disable verification. Apply migrations in a controlled release job, not on every web build. Seed only a deliberate draft/demo database. No migration or seed is automatic in this Vercel configuration. Preserve separate least-privilege runtime/migration roles and encrypted backups.

Vercel's ephemeral filesystem cannot hold the current private PDF/mail storage durably. PDF generation also requires a separate Chromium-capable Node worker. Provision and integrate durable private object storage and authorized SMTP/queue processing before offering those features. Do not treat a `/tmp` workaround as durable storage.

After deployment, check `/`, `/curriculum`, `/preview`, `/practice`, `/shop` and `/login`. Verify that registration and payment remain closed. With a database configured and migrated, require `/api/health` to return 200 with connected database status. Confirm the final `APP_URL` and redeploy before testing authenticated mutations. Human content review and the remaining production launch gates still apply.

Use `/api/live` for uptime of the demo without a database. It must not replace `/api/health` when database-backed functionality is expected. Shared API responses include generated `X-Request-ID` references; optional `OBSERVABILITY_LOGS=true` enables private structured completion logs. See OPERATIONS_MONITORING.md for limits and external-monitor setup still required.
