# Private PDF storage and separate rendering

The remote adapter and operator-run worker are implemented. Operator screenshots now confirm hosted storage verification, a successful private render, signed-in PDF retrieval and signed-out denial. Hosted restore evidence remains pending; the encrypted recovery workflow is documented in [REMOTE_RECOVERY.md](REMOTE_RECOVERY.md). This is not a commerce launch or proof of real Supabase delivery.

## Boundaries

`PDF_STORAGE=disk` remains the local default. Vercel rejects disk writes/reads and browser generation. `PDF_STORAGE=supabase` writes UUID PDF objects through the hosted Supabase Storage REST API. Every operation checks that the configured bucket exists and explicitly reports `public: false`. Creates use `x-upsert: false`; stored edition filenames carry a `supabase:` backend marker. Existing disk editions keep their disk references and never silently resolve to remote files. No schema migration is needed.

Authenticated server reads stream at most 32 MiB, then the edition service verifies the existing SHA-256. No public object URL, browser credential or signed storage URL is returned. Existing staff roles, independent source approval, immutable manifests, full-edition 500-question gate, preview release attestation and owner/payment/entitlement/download-token checks still apply. A public preview becomes available only through its separately released application route. Generation does not publish anything.

The service accepts only `https://<20-character-project-ref>.supabase.co` endpoints, uses no-store requests, rejects redirects, and applies a 20-second request timeout. Provider response bodies and credentials never enter application errors. The server holds PDF bytes in memory; the 32 MiB bound is intentional. Public bucket configuration is rejected, but the adapter cannot undo exposure caused by an operator making a bucket public. Keep administrative access restricted.

## Secure operator setup

1. In the chosen Supabase project, create a **private**, dedicated bucket (for example `private-editions`). Configure PDF MIME type and a maximum file size no greater than 32 MiB. Do not add anonymous/authenticated read policies or mark it public.
2. Save the following only in secure worker/server settings. Use the same project and bucket on the web server and worker:

   - `PDF_STORAGE=supabase`
   - `PDF_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `PDF_SUPABASE_BUCKET=private-editions`
   - `PDF_SUPABASE_SERVICE_KEY=<server-only service-role credential>`

   The adapter currently uses a Supabase service-role JWT with Storage bucket-management/object access. This is a powerful credential: isolate it to trusted server/worker environments. Never use a publishable/anon key, any NEXT_PUBLIC variable, workflow input or chat message for it. Do not expose environment values in logs. Changing project/bucket configuration is a storage migration, not a harmless switch: existing remote references depend on it.
3. The web server retains its runtime DATABASE_URL. The worker needs its own server-side database connection and `PDF_OPERATOR_EMAIL` matching a current staff account. Do not supply a login password. Redeploy the web app after setting its environment.
4. For the supplied manual **Render private PDF draft** GitHub Action, reuse `DATABASE_MIGRATION_URL` and `ADMIN_BOOTSTRAP_EMAIL`; add `PDF_SUPABASE_URL`, `PDF_SUPABASE_BUCKET` and `PDF_SUPABASE_SERVICE_KEY` as repository Actions secrets. The workflow fixes PDF_STORAGE to supabase and installs Chromium on its separate runner. It never uploads PDFs as public workflow artifacts. Run only on trusted main; repository administrators/workflow editors can access job secrets.

In `/admin` → **PDF workspace**, choose **Private editorial draft**, enter the title/version and select at least one lesson (questions are optional). Click **Copy worker job**. The workspace validates the shared job schema and shows a read-only JSON fallback if clipboard access is blocked. Editing the selection/settings clears the prepared job. Copying does not generate/publish anything and includes only IDs/settings, never question bodies or answer keys.

Open **Render private PDF draft** using the workspace link, choose `main`, paste the copied JSON into the **job** field and run. After success, refresh `/admin` and use **Open protected PDF**. The manual Action accepts DRAFT only; candidate/release operations stay separate.

The job format is:

```json
{"kind":"DRAFT","version":"private-proof-001","title":"Private editorial proof","lessonIds":["replace-with-existing-lesson-version-id"],"questionIds":[]}
```

Workflow inputs are visible in workflow history: include only version IDs/title/version, never content or credentials. The workflow permits DRAFT only. Choose a clear version label for each proof; repeating a job creates another edition rather than overwriting its bytes. On success, open `/admin`, refresh the PDF workspace and open the private proof. Anonymous and customer requests must remain denied. The application generation button on Vercel returns an explicit separate-worker requirement; it does not pretend to queue a job.

## Verify the hosted bucket before rendering

After saving the three repository secrets above, open GitHub **Actions → Verify private PDF storage → Run workflow**, choose `main`, and run it. This workflow needs no database connection, staff password or Chromium. It creates one synthetic private PDF, checks authenticated byte integrity and credential-free denial on both public/authenticated object endpoints, deletes only that temporary object, then confirms object-not-found through authenticated storage. It does not create editions, import content, publish files or activate products.

A green run emits only fixed check names/statuses. Provider outages, redirects, successful anonymous responses, corrupted bytes and failed cleanup make the job fail. Failures report a safe stage (`configuration`, `upload`, `integrity`, `anonymous-denial`, `cleanup`); they never print response bodies, object keys or secrets. If cleanup fails, inspect recent objects privately and remove only the synthetic probe after identifying it; never bulk-delete editions. An ambiguous failed upload can also leave a probe object requiring operator reconciliation.

Equivalent trusted-host command:

```bash
npm run pdf:storage:check -- --apply
```

The explicit flag is required because this diagnostic temporarily writes to remote storage. It rejects local/disk mode. A passing run verifies only that configured bucket and service credential at that time. It does not verify logged-in customer RLS policies, application roles/entitlements, Vercel settings, backup restoration or paid delivery. Keep those separate rollout gates pending. After this check passes, run **Render private PDF draft** with real selected version IDs and verify staff-only application retrieval as described above.

## Worker command

On a trusted Node 24 host with installed Playwright Chromium, use a private JSON job file:

```bash
npm ci
npx playwright install --with-deps chromium
npm run pdf:render -- /path/to/private-job.json
```

The CLI shares the web input schema and editorial/PDF service. It checks the current staff role, holds a staff-row share lock, serializes worker processes with a PostgreSQL advisory transaction lock, and emits only edition ID/kind/version. ADMIN alone can create PREVIEW/FULL candidates; release remains a separate human action. The supplied Action deliberately supports only private drafts. No job accepts arbitrary HTML, render URLs or destination paths. The browser disables JavaScript/service workers/raw HTML/images and aborts network requests. Each process runs one explicit job and exits; this is not an asynchronous queue or scheduled service.

## Recovery and rollout gates

Before release, verify a synthetic private proof in the real bucket, authenticated app retrieval/checksum, anonymous/provider public-URL denial, role denial, missing-object/public-bucket failures, and absence of credentials in client bundles/logs. Never simulate approval of real content. Test candidate/release flows only after actual independent review.

Back up object bytes **and** database edition/manifests together using a provider-appropriate encrypted backup policy. Database backup alone does not include Storage object bytes. Restore into an isolated private project/bucket, preserving object names and hashes, and verify byte integrity and access denial. Existing local editions require an explicit audited migration procedure; none is performed automatically. Do not delete local files or switch existing remote project/bucket settings before a tested migration/restore plan. Routine operator deletion/rotation and orphan reconciliation remain operational work: a crash between upload and DB commit, or failed rollback deletion, can leave an unreferenced private object. Never treat bucket listing as entitlement evidence.

Automated evidence: storage protocol mocks cover private bucket checks, create-only requests, backend references, destination/path denial, failed requests, bounded reads, checksum failure and rollback deletion. The isolated production browser suite also invokes the worker as a separate process, verifies a staff-only DRAFT and rejects a customer operator. Local tests do not prove hosted Storage configuration or provider compatibility.
