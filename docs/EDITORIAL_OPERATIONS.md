# Editorial and account operations

Phase 2 implements local password authentication, an editorial review workflow and a Node/Chromium PDF worker. No email provider, external identity provider, paid download storage or payment gateway is configured. Use synthetic development accounts until the operator completes privacy, support, email verification and recovery work.

## Start and bootstrap staff

For the hosted Supabase/Vercel installation, use the manual secret-backed job in [ADMIN_SETUP.md](ADMIN_SETUP.md). It calls the same account CLI described below and does not open public registration or overwrite existing identities.

Use Node 24 in /workspace/csc-e-book. Run npm ci, npm run local:env, npm run db:up, npm run db:migrate, npm run db:seed and npm run dev. APP_URL must equal the exact trusted browser origin (scheme, host and port); its local default is http://localhost:3000. Production requires HTTPS. Authenticated JSON mutations reject any other Origin and require the browser client's X-CSC-Action header. Do not weaken this check to accommodate a misconfigured host.

Public registration creates CUSTOMER accounts only. It defaults to enabled in development and disabled in production. REGISTRATION_ENABLED can override that default; enable production registration only after operator/privacy/recovery readiness. Staff roles can only be set by an operator with local database access, never via public registration.

Create a private password file outside the repository using your local password manager or a secure prompt, with owner-only file permissions and a unique password of 12–128 characters. Never pass passwords as command arguments, commit the file, or paste its contents into chat. Create separate author/admin and reviewer accounts:

```bash
npm run user:create -- --email author@example.test --role ADMIN < /path/to/private-author-password.txt
npm run user:create -- --email reviewer@example.test --role REVIEWER < /path/to/private-reviewer-password.txt
```

These addresses are illustrative. Replace them with operator-selected account identities. Commands preserve existing accounts by refusing duplicate emails. Safely remove temporary password files after storing credentials in your password manager. No default staff account or shared password is seeded.

To change a role and revoke that user's current sessions:

```bash
npm run user:role -- --email editor@example.test --role EDITOR
```

Run npm run maintenance on a schedule to delete expired session and rate-limit rows. This does not delete customer accounts or editorial records. Set actual retention/deletion policy before collecting real personal information.

## Write, review and publish

Sign in at /login and open /admin from the account dashboard. EDITOR and ADMIN can create chapters, lessons and questions. REVIEWER can inspect and approve or reject submitted versions. ADMIN releases approved content and PDF previews. Chapter metadata has create/update/delete actions; deletion is allowed only for an empty chapter.

Only the author can edit or submit a DRAFT. All other editorial states are immutable; use Copy into next version to revise existing material. Legacy seed samples have no author and remain drafts; copying them creates an authored version with no approval inherited. The server supplies version numbers and uses revision checks plus serializable transactions to reject stale/concurrent writes. Questions require A–D options with exactly one correct answer and distinct option text, a rationale and source notes. Lessons require objectives, explanation, worked example, practice and rationale sections.

Workflow: DRAFT → IN_REVIEW → APPROVED → PUBLISHED. Rejection returns a submitted version to DRAFT with reviewer notes. The approving reviewer must differ from the author and attest to checking correctness, originality and authoritative sources where needed. Notes and a hash of reviewed content are retained. An admin cannot approve their own work. Admin publication requires an independent approval matching the current content hash. Archive removes a version from release eligibility; deleting an authored version is implemented as archival to retain review/audit history.

Approval is a human responsibility. A checked box is an attestation, not automatic fact verification. Neither the application nor automated tests certify original/legal/historical correctness. Official 2027 facts and the 500-question commercial launch target remain outstanding.

## Imports and exports

The question studio supports JSON and CSV export and atomic imports of 1–100 questions, under the request-size limit. Export contains the latest version for each question key. JSON is the lossless interchange format; CSV exports escape spreadsheet formula prefixes. CSV columns are key, prompt, topic, level, difficulty, sourceNotes, explanation, optionA, optionB, optionC, optionD and correctLabel. correctLabel must be A, B, C or D. A malformed row rejects the whole import. Imported content is always a new DRAFT version; source status, reviews and approval are never imported.

Editors can create the next version of their own key. Admins can create new versions of other keys. Duplicate normalized prompts across different question keys are rejected. Import limits and editorial/PDF throttles are enforced using shared PostgreSQL counters.

## Generate and release PDFs

The PDF workspace selects exact lesson/question versions. DRAFT creates a private staff proof with a draft watermark, cover, disclaimer/copyright, linked contents, page numbers, lessons, exercises, answer rationales, study calendar, references and publication version. It is never exposed through the public preview route.

PREVIEW candidates require published versions with matching independent approval. Generation creates a private candidate. An admin must inspect the entire PDF, including its template and references, and explicitly release it. Only that release makes /api/preview.pdf available. The public route rechecks content eligibility and file SHA-256 on every request; archiving included content or changing the file makes it fail closed. No sample is automatically approved or released by setup.

FULL generation requires at least 500 unique independently reviewed question keys, plus approved/published lessons. That gate remains unmet: the seed contains one draft question, and the additional 20-question numerical review pack is unapproved and awaits manual import. Customer download routes exist but require coherent verified payment, current entitlement and eligible immutable files; mock/test records cannot grant production access. Page design/generation can be reviewed using private drafts. The complete commercial e-book still needs the reviewed curriculum and bank. See DRAFT_LESSONS.md for public preview and editorial import boundaries.

PDF_PRIVATE_DIR defaults to .local/editions outside public/. Use an owner-only durable private volume on the Node worker. PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH can point to installed Chromium; this cloud uses /usr/bin/chromium. Markdown raw HTML and images are disabled, links are restricted, JavaScript is disabled and all browser network requests are aborted during rendering. Staff access is required for generated-file routes. A worker permits one local render at a time and uses shared global/per-user rate limits; scale through a dedicated job queue before high-volume use.

Private local disk is a development/Node-worker storage adapter, not provisioned S3 storage. Vercel edge/runtime alone does not supply the browser or durable volume. Deploy the current PDF routes on equivalent Node/container hosting with Chromium and durable private storage, or build the separate authenticated worker/object-storage integration before enabling them on Vercel. Back up the private directory together with database manifests. Do not move generated files under public/.

## Tests and account boundaries

Build first, then run PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e. The wrapper provisions a unique disposable database, applies both migrations, seeds drafts and starts its own production server on port 3100. It drops only that generated database and its private test-PDF directory afterward. The connection role must be allowed to create/drop test databases; E2E_DATABASE_ADMIN_URL may identify a separate test-only database administrator. Never point browser tests at a live server or run bare playwright test against customer data.

Test approval events are simulated only in this isolated disposable database. They do not mark development content as human-reviewed or publish any material on the development server. The retained .local/phase2-test-proof.pdf is a synthetic test artifact, not a customer edition. pdftotext is used to verify searchable text; PDF parsing checks page count, internal links and file integrity.
