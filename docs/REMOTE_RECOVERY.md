# Encrypted database and private PDF recovery drill

This manual workflow captures the application's hosted **public-schema database** and all database-referenced remote PDF objects, encrypts the bundle, then restores it into a generated PostgreSQL database inside a marked disposable Docker container and a new private Supabase bucket. It never restores over the original database/bucket, switches app settings, starts mail/payment workers, approves content or releases editions.

The software has passed local disposable integration tests. **The hosted recovery job has not run yet.** Prior operator screenshots establish successful storage verification, private draft rendering, signed-in retrieval and signed-out denial; they do not establish backup recovery. This tool is a bounded rehearsal and a seven-day encrypted archive, not managed PITR, an automated backup schedule or a production failover service.

## One new secure setting

Create an independent random **32-byte encryption key**, represented by 64 hexadecimal characters. Store a copy in your password manager separately from backup files; also save it in repository Actions secrets as **BACKUP_ENCRYPTION_KEY**. It is needed to recover these archives later. Never reuse a database password, Supabase service key or mail key. Never put the key in a workflow input, command argument, screenshot, repository file or chat. GitHub will not reveal the saved secret later; do not rely on its presence as your only recoverable copy.

On your own trusted Windows machine, this PowerShell command generates a cryptographic key and places it in the clipboard without displaying it:

```powershell
$recoveryBytes = New-Object byte[] 32
$recoveryGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$recoveryGenerator.GetBytes($recoveryBytes)
$recoveryGenerator.Dispose()
[System.BitConverter]::ToString($recoveryBytes).Replace('-', '').ToLowerInvariant() | Set-Clipboard
```

Paste it into a new secure password-manager entry and GitHub's **Secret** field, using **Name: BACKUP_ENCRYPTION_KEY**. Keep historical keys if rotating: a new key cannot decrypt old archives. The key is deliberately excluded from every archive and log. Separately recover MAIL_ENCRYPTION_KEY and other operator/provider credentials for any eventual full-service recovery; the archive contains encrypted mail payloads, not their decryption keys or environment settings.

The workflow reuses these existing repository secrets:

- DATABASE_MIGRATION_URL — hosted source only; a session/direct connection supporting exported snapshots and public-schema pg_dump, normally port 5432.
- PDF_SUPABASE_URL, PDF_SUPABASE_BUCKET, PDF_SUPABASE_SERVICE_KEY — source PDF reads and permission to create/delete a separate temporary private bucket.

No Vercel environment change or redeploy is needed for this operator workflow.

## Run the hosted rehearsal

1. Open GitHub **Actions → Verify encrypted database and PDF recovery → Run workflow** and choose `main`.
2. Confirm that source PDF objects will not be deleted/replaced and bucket privacy/settings will not change during the drill, then run. The checkbox is an operator assertion; the job does not stop administrators. Normal application writes may continue: the database dump and its PDF-record list share one exported repeatable-read, read-only snapshot. Existing UUID object contents are immutable and their recorded hashes are rechecked during download. New database writes after the snapshot are outside this backup. Do not perform manual database schema changes during capture.
3. Wait for **Success**. The fixed report gives table/migration/PDF counts, elapsed time and a generated recovery ID. Failures give only a safe stage and recovery ID; no provider body, SQL output, object key, identity or credential is logged.
4. Download the **encrypted-recovery-...** artifact to an authorized backup location. Only `private-recovery.cscbak` is uploaded. GitHub retains it for **seven days**. Keep it and its key separately; decide and implement actual retention/off-site/deletion policy before relying on this operationally. If the job fails after creating an archive, an artifact may still exist: it is **not a verified restore** unless the job succeeded.

The repository is public. Workflow artifacts must be treated as potentially accessible to other signed-in GitHub users; this is why encryption is mandatory before upload. Restrict who can modify workflows or use Actions secrets. No plaintext SQL/PDF backup artifact is uploaded.

## What gets checked

- All 29 known application/history table counts are compared with the read-only source snapshot. pg_dump captures the entire public schema, including the application's identities, audit events, encrypted queues, review/content records, commerce records and constraints. The public dump is transactionally consistent; additional schemas such as Supabase auth, storage, vault and provider configuration are excluded. Global database roles, ownership and ACLs are not captured/reinstated by this no-owner/no-acl dump; recreate reviewed role/grant configuration separately before any actual service cutover.
- All restored application/history tables retain row-level security. Applied migration names/checksums must match the checked-out source revision.
- Every PdfEdition row is compared in full, including creator, kind/version, hash, immutable source manifest and publication metadata. Every referenced object must exist, use a remote UUID PDF reference and match its recorded SHA-256. Unreferenced storage objects are not included.
- AES-256-GCM authenticates a compressed bundle with random nonces and a version-bound header. The archive is read back from disk, authenticated, decompressed with a size bound and validated before any restore target is created. Dump/file hashes and edition-to-file bindings must agree.
- Recovered PDFs are uploaded create-only into a newly created private `csc-restore-<recovery-id>` bucket, retrieved with credentials and hash checked. Credential-free public/authenticated endpoint access must be denied. No signed URL or public bucket is created.
- Only the generated `csc_restore_<recovery-id-without-hyphens>` database, exact owned temporary PDF names and generated bucket are deleted. Bucket removal is checked. If any cleanup fails the job fails. The source database is used only for reads; source storage objects are never deleted or overwritten.

The PostgreSQL 17 pg_dump/pg_restore utilities are supplied by the disposable service container. The source connection must be compatible with that dump client (a newer server may require a reviewed tooling update). Source passwords travel through a generated owner-only pgpass file inside the container and stdin, never a full credential URI/password argument. That temporary file is removed. Connection metadata is not printed. Restore commands require a container marked `csc.recovery=temporary` and a generated target name; no source/production restore URL is accepted.

Current bounds: at least one, at most 100 editions; each PDF at most 32 MiB; all PDFs together at most 64 MiB; dump at most 64 MiB; authenticated decompressed JSON at most 256 MiB. The bounded in-memory design is for the current development installation. It is not a large-dataset backup system. Exceeding a limit fails closed and requires a reviewed streaming/managed backup plan.

## Rehearse an existing archive independently

On a trusted isolated host, check out the **source commit recorded by the successful backup workflow**, recover its key securely, and provide the private storage settings and ID of a disposable PostgreSQL 17 Docker container labelled `csc.recovery=temporary`. RECOVERY_REVISION must equal that checked-out commit. Then:

```bash
npm run backup:remote:drill -- --restore-archive /private/path/private-recovery.cscbak --apply
```

This mode does not require or connect to RECOVERY_SOURCE_URL and does not recapture original data. It authenticates the saved archive before restoration into new generated targets and removes those targets afterward. It refuses symlinks/non-regular or oversized archive inputs, wrong keys, mismatched source revisions/migrations and inconsistent records/files. Use only trusted archives from this application's backup jobs: authenticated database dumps can execute SQL within the isolated restore container. Keep that environment isolated and never connect a restored service automatically. There is deliberately no production cutover command.

## Failure and recovery boundaries

An abrupt runner/process termination, an ambiguous create result or failed cleanup can leave resources requiring private operator inspection. Use only the exact recovery ID in the job report to identify its generated bucket/database. Never use wildcard deletes or empty the original bucket. Runner-local plaintext exists in process memory and the isolated restored database; credentials temporarily exist in the protected pgpass file. The hosted runner/service container is ephemeral; do not run on an untrusted/shared host. The encrypted artifact copy is removed from the runner after artifact upload.

A production restoration still requires a separately authorized plan: restore all required schemas/infrastructure/provider settings, recover independent secrets, verify access denial, reconcile payment/provider state, invalidate stale sessions/account/download credentials and inspect queued mail before reconnecting traffic or workers. This drill performs no such cutover. Actual managed backups/PITR, schedules, geographically separate retention, measured RPO/RTO targets and recurring hosted recovery evidence remain roadmap work.

## Local validation

```bash
npm run test:remote-recovery
```

This wrapper never reads .env. It creates its own PostgreSQL container/credentials/database, applies all migrations, inserts one synthetic private edition, and stubs only a fixed fake Storage origin inside a child process. Real provider HTTP is rejected. It tests a shared-snapshot capture and restore, an independent saved-archive restore with no source connection, a corrupt restored object rejected with cleanup, source record/object preservation, all table counts/RLS, migration checksums, metadata, encryption and removal of temporary databases/buckets. It removes only its own container/archives. It never targets the development/customer database. Unit tests cover wrong keys/tampering/truncation and malformed, unsafe, duplicate, missing or mismatched archive records/files.
