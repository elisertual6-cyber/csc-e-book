# Local backup and restore drill

These commands operate **only on this checkout's Compose `db` service**, using the PostgreSQL 17 utilities inside that container. They do not use `DATABASE_URL` and are unsuitable for a managed or customer database. The local database user must be allowed to create and drop a temporary database. No passwords appear in command arguments or output.

Pause the application and all editorial, PDF and mail workers before taking a backup. Keep writers paused until the backup finishes: PostgreSQL's dump is transactionally consistent, but the PDF directory is a separate filesystem. The flag below records your assertion; it does not stop processes for you. Browser tests write to separate databases.

```sh
npm run backup:local -- --writes-paused
npm run backup:verify -- <uuid-printed-by-backup>
```

The generated `.local/backups/<uuid>/` contains a PostgreSQL custom-format dump, copies from `PDF_PRIVATE_DIR` (default `.local/editions`) and a SHA-256 manifest. The dump includes editorial manifests, migration history, accounts, hashed credentials/tokens, encrypted pending mail and payment records. Files are mode 0600 and generated directories 0700; the directory is ignored by Git. Backups contain sensitive **unencrypted** database data. Keep them outside public storage and encrypt before transferring to an authorized off-site location. This local tool reads files into memory to hash them; use managed backup tooling for large datasets.

Verification rejects unsafe paths, symlinks, invalid manifests and checksum mismatches, creates a random `csc_restore_<hex>` database, restores all schema/data/constraints, checks the migration count and chapter presence, and verifies every restored PDF record against backed-up file bytes. It always attempts to delete only its generated temporary database. It never restores over the application database or switches application configuration. On an abrupt process/container termination, inspect and remove the exact generated leftover restore database manually; do not use wildcard deletion. Restore privileges are necessary because trusted PostgreSQL dumps can execute SQL. Checksums detect accidental corruption; they do not authenticate a backup from an untrusted party.

For a repeatable safety check, with writers paused:

```sh
npm run test:backup -- --writes-paused
```

This creates its own backup, completes the restore drill, corrupts that generated copy and checks rejection, checks path traversal rejection, then removes only that test backup. Existing archives remain intact. A backup with no PDF records cannot establish PDF recovery evidence; repeat the drill after creating legitimate editions. A wrong separately configured PDF directory will fail verification when database editions exist.

Mail inbox file copies and encryption keys are deliberately excluded. Keep `MAIL_ENCRYPTION_KEY` (or the development `.local/mail/encryption.key`), database credentials, provider secrets and deployment configuration in a separate secure secret-manager recovery plan. Without the matching mail key, an encrypted restored queue cannot be recovered. No `.env` is copied.

Production still requires encrypted managed PostgreSQL backups/PITR, durable private artifact storage with versioning, retention and deletion policies, encrypted off-site copies, restricted backup access, a measured recovery-point/recovery-time objective, and a staging recovery rehearsal with the matching application revision and separately recovered keys. Before reconnecting a restored service, reconcile external payment state, invalidate old sessions/account/download tokens, and review pending mail to avoid stale messages or duplicate submissions. This command is a verification drill, not an automated production cutover or an off-site backup service.

## Remote PDF adapter

The optional Supabase private PDF adapter is documented in [PDF_STORAGE.md](PDF_STORAGE.md). The existing local Compose archive/restore commands do **not** back up Supabase Storage bytes. Do not treat their success as remote object recovery evidence. Remote rollout needs a separately tested encrypted object backup plus the corresponding database manifests and isolated checksum/access-denial restore checks.

Hosted PDF/database recovery now has a separate encrypted snapshot/rehearsal workflow: see [REMOTE_RECOVERY.md](REMOTE_RECOVERY.md). It uses a source read-only snapshot, disposable database and separate private bucket; it does not change the local-only commands above or establish hosted success until the operator runs it.
