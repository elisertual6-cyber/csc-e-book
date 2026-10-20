# Deployment and operations

Phase 1 is a demo foundation and is not cleared for commercial launch. Do not collect customer data or accept payments.

## Web deployment

Use Node 24 on Vercel or equivalent Node hosting. Install with npm ci; build with npm run build. Server hosting can use npm start. No secrets are required to build public demo pages. Inject DATABASE_URL for the server-only health route using a managed PostgreSQL database's supported TLS/pool settings. Never disable certificate verification. Do not upload .env.

Run npm run db:migrate in a controlled release job with a migration-capable database role, then npm run db:seed only for a deliberate draft/demo environment. The app runtime should use a separate least-privilege role. Do not run migration commands in request handlers. Verify /api/health returns 200; tests of a public landing page alone are insufficient.

Review each schema migration on a staging copy, back up first, and test application compatibility. Prisma migration history and application audit events serve different purposes; neither replaces database backups. Never reset a production database to resolve migration drift.

## Backup and restore

For development, Compose volumes retain data on container restarts; they are not backups or portable cloud snapshots. Use managed PostgreSQL automated encrypted backups/PITR for production. Maintain separate encrypted off-site copies, retention and access controls. Periodically restore into an isolated database and verify migrations, counts and representative records. Treat dumps as personal-data-bearing secrets. Do not commit dumps, tokens or customer records. Include private artifact storage and publication manifests in the recovery plan.

## Before production commerce

- Configure secure Auth.js sessions and test role/ownership checks and account recovery.
- Implement protected editorial writes, independent review, immutable publication versions and 500+ verified original questions.
- Complete Philippine privacy assessment, operator identity, monitored support contact, legal/refund review and data subject request handling.
- Choose a Philippine-compatible provider; store credentials securely, verify sandbox flows and signature validation, and test idempotent payment/entitlement changes.
- Add private object storage, signed short-lived downloads, a PDF worker and email delivery with retry handling.
- Add distributed rate limiting, sanitized structured logs, request identifiers, alerts and error reporting without answers, credentials or unnecessary personal data.
- Test server-side grading, deadlines, concurrency, unauthorized access and stale/revoked entitlements.
- Re-run accessibility, browser, security and restore tests. Review CSP/nonces and HSTS for the deployment host before enabling them.

Server-side browser PDF generation needs a dedicated Node/container worker; it is not part of the current Vercel web build. No storage, email or payment service is provisioned in this phase.
