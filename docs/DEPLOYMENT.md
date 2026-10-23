# Deployment and operations

Phase 3 is a development service and is not cleared for commercial launch. Do not collect customer data or accept payments.

## Web deployment

For Supabase connection settings and the manually triggered GitHub migration job, follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md). This repository setup does not itself create hosted tables or install Vercel secrets.

Read [OPERATIONS_MONITORING.md](OPERATIONS_MONITORING.md) for `/api/live` versus database readiness, request references and safe operational logging. Optional `OBSERVABILITY_LOGS=true` enables completion events; no external monitoring service is configured.

Use Node 24 on Vercel or equivalent Node hosting. Install with npm ci; build with npm run build. Server hosting can use npm start. No secrets are required to build public demo pages. Inject DATABASE_URL for authentication, editorial data and health checks using a managed PostgreSQL database's supported TLS/pool settings. Never disable certificate verification. Do not upload .env.

Run npm run db:migrate in a controlled release job with a migration-capable database role, then npm run db:seed only for a deliberate draft/demo environment. The app runtime should use a separate least-privilege role. Do not run migration commands in request handlers. Verify /api/health returns 200; tests of a public landing page alone are insufficient.

Review each schema migration on a staging copy, back up first, and test application compatibility. Prisma migration history and application audit events serve different purposes; neither replaces database backups. Never reset a production database to resolve migration drift.

## Backup and restore

The local Compose backup and isolated restore drill are implemented. Read [BACKUP_OPERATIONS.md](BACKUP_OPERATIONS.md) for `backup:local`, `backup:verify` and `test:backup`, including write-pause, private-file, separate-key and production recovery requirements. Local archives are unencrypted and are not off-site backups.

For development, Compose volumes retain data on container restarts; they are not backups or portable cloud snapshots. Use managed PostgreSQL automated encrypted backups/PITR for production. Maintain separate encrypted off-site copies, retention and access controls. Periodically restore into an isolated database and verify migrations, counts and representative records. Treat dumps as personal-data-bearing secrets. Do not commit dumps, tokens or customer records. Include private artifact storage and publication manifests in the recovery plan.

## Before production commerce

- The current database-session implementation and role checks are in place; validate the implemented email verification/recovery with an authorized SMTP provider, complete operator support and perform a dedicated authentication/security review before enabling real customer registration.
- Editorial writes, independent review and immutable versions are implemented; create and independently verify 500+ original questions and complete the curriculum.
- Complete Philippine privacy assessment, operator identity, monitored support contact, legal/refund review and data subject request handling.
- Choose a Philippine-compatible provider; store credentials securely, verify sandbox flows and signature validation, and test idempotent payment/entitlement changes.
- Provision durable private object storage/volume and the implemented PDF/download worker. Configure and schedule the implemented SMTP queue with provider delivery evidence.
- Current auth/editorial/PDF routes use PostgreSQL rate counters and sanitized errors. Add operational alerts, request identifiers, retention scheduling and capacity tuning without logging credentials or unnecessary personal information.
- The server-side exam engine has deadline/concurrency/ownership/entitlement tests. Extend these through the real payment/webhook flow, then load-test and review production operations.
- Re-run accessibility, browser, security and restore tests. Review CSP/nonces and HSTS for the deployment host before enabling them.

Server-side PDF routes are implemented for a Node/container worker with installed Chromium and a durable private PDF_PRIVATE_DIR. They are not supported on edge runtime or a default Vercel web deployment without an appropriate browser/worker/storage integration. The development private-disk adapter is not provisioned object storage. No email or payment service is configured. See EDITORIAL_OPERATIONS.md.

Set APP_URL to the exact HTTPS deployment origin. Production session cookies are Secure and host-only. Registration defaults off in production; REGISTRATION_ENABLED=true is an explicit operator choice after privacy/recovery readiness. Maintain backups of both PostgreSQL and private edition files. Schedule npm run maintenance to remove expired sessions and rate counters. Never use a production/customer database for browser tests: the test runner needs a separate database-creation-capable role and provisions its own disposable database.

Exam details and graded results must use authenticated no-store routes. Schedule/monitoring decisions for unattended expiration are still operational work: the current service finalizes overdue attempts on read/write/history/start cleanup, using the database clock. Do not add a client-controlled grade endpoint or cache private snapshots at a CDN. See EXAM_OPERATIONS.md.

## Commerce is development-only

Read COMMERCE_OPERATIONS.md. The production build refuses mock checkout even with PAYMENT_PROVIDER=mock. Real webhooks return 503 until a selected provider adapter verifies signatures and canonical payment state and passes sandbox tests. Development proof artifacts and mock-backed entitlements cannot deliver production files or premium exam access. DeliveryNotice rows begin as an unsent outbox; the Phase 5A worker can submit eligible verified-address messages through an authorized SMTP provider. Do not advertise payment/email/remote storage integration as complete. Private PDF volumes, database backups and restore drills, mail and payment reconciliation, reviewed commercial content, real-provider recovery testing and operational/legal review are required before enabling sales. Redact download-token paths from request logs.

## Verification/recovery and SMTP worker

See ACCOUNT_SECURITY.md. Configure APP_URL as the actual HTTPS origin, MAIL_TRANSPORT=smtp, a verified MAIL_FROM and provider SMTP settings plus a secure MAIL_ENCRYPTION_KEY. Preserve TLS/certificate validation. Schedule npm run mail:work for due deliveries and npm run maintenance for expiry cleanup. File mail delivery is development-only. Do not claim provider delivery based on the loopback SMTP tests. Track queue depth, generic failure/retry rates, provider acceptance/bounces and password-recovery smoke checks. Back up the mail encryption key separately in the secret manager; a database restore alone cannot decrypt the pending queue. Authorization, sender/domain verification and real mailbox delivery evidence remain operator prerequisites.

## GCash sandbox setup

GCash is implemented through a PayMongo hosted-checkout sandbox adapter. Read GCASH_OPERATIONS.md before configuring secrets. The merchant must activate GCash and supply a test secret key and webhook signing secret through secure runtime settings, with a reachable HTTPS callback and current provider contract/sandbox evidence. On the Node 24 cloud, external fetch calls need NODE_USE_ENV_PROXY=1 to honor the injected proxy; preserve NO_PROXY and TLS verification. developers.paymongo.com/api.paymongo.com additions are saved but not yet applied/published. No real sandbox calls have been verified. Live keys/mode, production checkout and sandbox-backed production access remain blocked.
