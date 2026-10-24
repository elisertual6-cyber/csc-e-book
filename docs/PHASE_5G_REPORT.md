# Phase 5G — private PDF storage and worker software

Delivered the roadmap's Phase 2/4 storage/worker implementation work. Hosted rollout remains pending; the development service is not commercially ready.

- Added a private Supabase Storage REST adapter with fixed hosted origins, server-only credentials, privacy checks on every operation, create-only UUID objects, redirect denial, request timeouts and bounded downloads.
- Added backend-tagged edition references without modifying migration history or moving existing files. The existing byte SHA-256, manifest eligibility, human release and entitlement gates remain in the shared PDF/delivery service.
- Added an explicit separate-process Chromium worker with shared validated inputs, current-role verification, role-row locking and cross-process advisory serialization. It does not publish editions or accept arbitrary HTML/URLs.
- Added a main-only manual GitHub Action for private DRAFT jobs, using secure secrets and a separately installed worker browser. No PDF is uploaded as a workflow artifact.
- Vercel explicitly rejects local browser rendering/disk delivery. Browser-test wrappers force local storage and erase inherited hosted credentials.

Validation: lint, TypeScript, 57 unit tests, content validation (15 public drafts, 71 source question records), production build and its 48 trace-manifest checks. All 31 production browser/security tests passed. The suite includes the separate worker process, staff-only generated proof retrieval and customer-operator denial, alongside the original review/release/checksum tests.

Protocol tests use mocked Storage responses, not a configured Supabase bucket. They cover privacy checks, immutable upload headers, authenticated retrieval, unsafe destinations/paths, upload failures, bounded reads, remote checksum mismatch, precise rollback deletion and Vercel disk denial. Synthetic review/worker fixtures use only generated disposable databases.

Remaining: secure operator configuration, real provider smoke tests/access denial, encrypted object plus database backups, isolated restore evidence, migration/orphan procedures, real independent content review, and all other roadmap launch gates. The CLI/Action is an explicit single-job worker, not an asynchronous web queue. Read [PDF_STORAGE.md](PDF_STORAGE.md) before configuration or operation.
