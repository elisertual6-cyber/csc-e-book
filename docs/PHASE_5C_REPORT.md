# Phase 5C: local recovery and public accessibility

Implemented local Compose PostgreSQL custom-format backups with private PDF copies, a SHA-256 manifest and restrictive file permissions. Restores run in a generated temporary database, verify schema/content presence and PDF metadata/bytes, and remove that temporary database. Existing application data is never overwritten. Backup creation requires an explicit assertion that application and worker writes are paused. Automated safety checks cover successful recovery, corrupted dump rejection and unsafe path rejection.

Added axe WCAG 2/2.1 A/AA scans across 14 public learning, shop, account entry and policy pages on desktop and mobile. Keyboard tests verify skip-link focus and entry into the practice content. Fixed insufficient contrast for curriculum card numbers and muted text, aligned the logo's accessible name with its visible wording, and made the main landmark a programmatic skip-link focus target.

Validation commands:

```sh
npm run lint
npm run typecheck
npm test
npm run content:check
npm run test:db
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e -- --workers=2
npm run test:backup -- --writes-paused
```

Results: lint, typecheck, production build, content validation and database integration checks passed; all 24 unit tests and all 18 production browser/security tests passed. The browser suite includes the new desktop/mobile accessibility scans and keyboard checks. The backup safety check passed, including corruption/path rejection and temporary-database cleanup.

The local restore drill recovered seven migrations and 25 chapter outlines. There are currently zero database PDF editions, so this drill does not establish recovery evidence for actual published PDFs. No content was approved and no products or exam templates were activated. The development bank still contains one draft lesson and one draft question.

Limitations: local archives are unencrypted and on the same machine. This is neither managed PITR nor an off-site backup service. Encryption keys and provider/deployment credentials must be recovered separately. Real production recovery/cutover, payment reconciliation and stale-token/mail handling need an operator rehearsal. Automated public-page scans do not establish WCAG conformance; authenticated states, zoom/reflow, screen readers and human usability checks remain.

GCash remains PayMongo sandbox-only, without actual merchant sandbox evidence or live activation. Authorized SMTP delivery, durable remote storage, production backup/monitoring/load/security work, verified legal/support information and 500 independently reviewed original questions remain launch requirements. See BACKUP_OPERATIONS.md for commands and recovery procedures.
