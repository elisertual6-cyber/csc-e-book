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

## Hosted verification tooling follow-up

Added `pdf:storage:check -- --apply` and the main-only **Verify private PDF storage** Action. This explicit diagnostic uses one synthetic PDF, authenticated byte/hash validation, credential-free public/authenticated endpoint denial probes and exact-object deletion/not-found confirmation. No database, edition, browser or publication is involved. It reports safe failure stages and rejects provider outages as proof of denial/removal. Failure still attempts cleanup of a confirmed upload; ambiguous uploads or failed cleanup can require operator reconciliation.

Validation for this follow-up: lint, type checking, all 68 unit tests (including 11 new stateful protocol cases), content validation and production build. The CLI was invoked locally in forced disk mode and correctly refused the remote check without storage writes. Existing 31 browser/security checks passed for the underlying storage/worker milestone; no UI/API behavior changed in this diagnostic follow-up. Hosted execution remains pending because the operator has not created/configured the private bucket/secrets, and no authenticated Supabase/GitHub connector is available in this session.

## PDF workspace handoff

Added **Copy worker job** to the staff PDF workspace, using the same validated schema as the CLI/Action. It copies only selected version IDs and edition settings for DRAFT jobs and provides a labelled read-only manual-copy fallback. Invalid settings are rejected, changing settings clears stale JSON, and PREVIEW/FULL jobs cannot be copied into the draft-only workflow. The UI links to the existing manual Action and explains the separate-worker requirement on Vercel. No server write, approval, edition or release is created by copying.

The authenticated desktop/mobile staff suite covers ADMIN/EDITOR/REVIEWER job preparation, keyboard activation/focus, exact allowlisted JSON, invalid versions, PREVIEW denial for administrators, blocked clipboard fallback, stale-output clearing, unchanged edition count and accessibility with the prepared JSON displayed.

Operator evidence: a screenshot shows hosted storage verification #2 succeeded; another shows Production redeployment `e379944` Ready after the operator reported saving web storage settings. These do not yet prove generated-edition retrieval, role denial on the deployed app or backup restoration.

Handoff validation passed: lint, TypeScript, 69 unit tests, content checks, production build/48 trace manifests, all 31 production browser/security tests, and four authenticated desktop/mobile workflows with 44 accessibility scans. Both browser suites ran through their disposable database wrappers; no hosted content or credentials were used.
