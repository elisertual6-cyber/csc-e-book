# Implementation roadmap

The current priority is **Phase 5: launch hardening**. The application is a development preview. Implemented software and passing local tests do not establish commercial or production readiness. This roadmap separates code that exists, verified test evidence and work that still needs infrastructure, provider credentials or qualified human review.

## Phase status

| Phase | Software delivered | Remaining release work |
| --- | --- | --- |
| 1. Foundation | Next.js, responsive public shell, curriculum, draft readers, PostgreSQL/Prisma and controlled deployment workflows | Official scope/source verification and production operational review |
| 2. Editorial and PDF | Authenticated editorial roles, versioned drafts, independent-review workflow, imports/exports and protected PDF generation | Complete/proofread curriculum, actual independent review and continuing private storage/worker operations |
| 3. Exam engine | Server-owned attempts, deadlines, immutable snapshots, grading, reports/history and entitlement checks | Reviewed production bank/templates, real payment integration evidence, capacity and recovery checks |
| 4. Commerce | Server-priced development orders, atomic fulfillment, access/download checks, encrypted mail queue and GCash sandbox adapter | Real merchant sandbox proof/current API verification, recurring artifact recovery/retention, authorized SMTP delivery and separate live-payment implementation |
| 5. Launch hardening | Local recovery drill, rate limiting, safe logs, readiness/uptime probes, public accessibility and bounded local load tests | Authenticated accessibility work below, manual usability/security review, deployed monitoring/recovery, legal/support readiness and all content/provider gates |

Operator screenshots and reports have confirmed Vercel deployment, Supabase migration/connectivity, administrator login and manual draft imports. They do not verify paid delivery, real email, merchant GCash testing or human content approval. A subsequent operator screenshot confirms hosted encrypted recovery run #3 succeeded with an encrypted artifact. Hosted connections and dashboard changes still require an available authenticated connector or the operator's secure setup steps.

## Phase 5F — authenticated accessibility

**Automated implementation verified locally.** Extended Phase 5C's public-page work to signed-in learners, administrators, editors and independent reviewers. Fixed keyboard focus lost during answer/flag autosaves, unnamed subject progress bars, ambiguous answer-key controls and missing editorial selection state. The dedicated suite scans 22 configured states per viewport on desktop and mobile. See [PHASE_5F_REPORT.md](PHASE_5F_REPORT.md) for exact scope and remaining manual/deployed work.

Acceptance criteria:

- Run automated WCAG A/AA checks on account/security, orders, practice lobby, active attempts, graded results and populated history.
- Check editorial lessons/questions/chapters, submitted-version review controls, PDF selection controls, product forms and exam-template administration under their real roles.
- Verify keyboard answer selection, flags, saving, submission and editorial view/answer-choice selection.
- Keep participant accounts, simulated review and test templates in generated disposable databases; no production fixtures, automatic approvals or product activation.
- Keep manual screen-reader, zoom/reflow and broader commerce/error-state review explicitly pending. Automated scans are not conformance certification.

## Next engineering priorities

1. Complete the remaining Phase 5F manual and deployed accessibility review, including screen readers, zoom/reflow and conditional payment/download/error states. Local automated coverage is delivered; it is not a conformance claim.
2. Continue recurring encrypted backups and protected long-term retention for the Phase 2/4 private artifacts. Hosted storage, manual rendering, signed-in retrieval/signed-out denial and one isolated encrypted restore rehearsal are operator-confirmed. Preserve checksums, entitlement checks, immutable manifests and repeatable recovery evidence; see [PDF_STORAGE.md](PDF_STORAGE.md) and [REMOTE_RECOVERY.md](REMOTE_RECOVERY.md).
3. Complete authorized SMTP sender/worker deployment and real verification/recovery delivery checks. An email address alone does not authorize sending.
4. Verify the current PayMongo Checkout contract and merchant sandbox, including authentic GCash events, retries, reconciliation and refunds. Local fixtures are not merchant proof. Live checkout needs a separate reviewed implementation/release.
5. Extend production-like capacity, authenticated security and recovery exercises, then configure external monitoring/alerts and verify the deployed configuration.

Content and operator work proceeds alongside these engineering tasks: finish the curriculum; independently review at least 500 original questions; check official 2027 sources and legal/historical/Filipino material; finalize privacy/refund/support information and monitored contacts. No software job may manufacture those attestations.

## Content and learner tools

The public catalog contains **15 unapproved teaching drafts** and four manually imported review packs contain **70 draft questions**. The unchanged one-question demo seed is separate. Chapter headings are a provisional 25-area outline, not 25 completed lessons. The existing samples are public-source educational drafts, not confidential/exclusive paid banks.

- Numerical: five lessons and 20 questions; see [DRAFT_LESSONS.md](DRAFT_LESSONS.md) and [NUMERICAL_IMPORT.md](NUMERICAL_IMPORT.md).
- English: three lessons and 15 questions; see [ENGLISH_DRAFTS.md](ENGLISH_DRAFTS.md).
- Paragraphs/reading: two lessons and ten questions; see [READING_DRAFTS.md](READING_DRAFTS.md).
- Professional reasoning/data and Subprofessional clerical: five lessons and 25 questions; see [TRACK_DRAFTS.md](TRACK_DRAFTS.md).
- Personal study planner: track-specific routines, optional browser-only progress and printing; see [STUDY_PLANNER.md](STUDY_PLANNER.md). This creates neither exam results nor additional approved content.

All import jobs preserve existing records and create only drafts under a current ADMIN identity. Publication, independently checked versions, paid editions and exam activation remain separate controlled operations.

## Delivered hardening and operational references

- **5A — Account verification/recovery:** hashed single-use credentials, session revocation, encrypted mail queue and strict-TLS SMTP adapter. Real provider authorization/delivery remains pending. [ACCOUNT_SECURITY.md](ACCOUNT_SECURITY.md).
- **5B — GCash sandbox software:** canonical payment/signature verification, reconciliation, idempotency and refund access handling. Production and live keys remain blocked. [GCASH_OPERATIONS.md](GCASH_OPERATIONS.md).
- **5C — Local recovery and public accessibility:** private local backups, isolated restore tests and public-page/keyboard scans. Hosted encrypted backups/PITR, real-file recovery and manual assistive-technology review remain pending. [PHASE_5C_REPORT.md](PHASE_5C_REPORT.md), [BACKUP_OPERATIONS.md](BACKUP_OPERATIONS.md).
- **5D — Operational diagnostics:** redacted request references/logs, separate uptime/connectivity probes and isolated short load checks. External alerting and production capacity proof remain pending. [PHASE_5D_REPORT.md](PHASE_5D_REPORT.md), [OPERATIONS_MONITORING.md](OPERATIONS_MONITORING.md).
- **5E — Draft content tools:** source checks, public readers and manual unapproved import packs. These do not satisfy human review or the 500-question gate. [PHASE_5E_REPORT.md](PHASE_5E_REPORT.md) and the expansion documents above.
- **Hosted setup:** [SUPABASE_SETUP.md](SUPABASE_SETUP.md), [ADMIN_SETUP.md](ADMIN_SETUP.md), [DEPLOYMENT.md](DEPLOYMENT.md). Builds never migrate, seed, create staff or activate products.

## Definition of a completed milestone

Run lint, type checking, relevant unit/content/database checks, production build and the applicable isolated browser/security suites. State what was verified and which external or manual work remains. Never describe simulated approvals, placeholder configurations or local provider fixtures as real-world release evidence. Prices, counts, durations and study schedules are practice configuration, not official CSC promises.

## Phase 5G — private storage/worker implementation

The Supabase private PDF adapter, backend-tagged immutable references, shared validated job schema, separate Node/Chromium CLI and main-only manual private-draft Action are implemented. Vercel fails closed for local rendering/disk, and isolated tests explicitly erase inherited remote storage credentials. This advances Phase 2/4 infrastructure without marking hosted infrastructure complete. See [PDF_STORAGE.md](PDF_STORAGE.md) for secure settings, rollout checks and object/database recovery requirements, and [PHASE_5G_REPORT.md](PHASE_5G_REPORT.md) for validation evidence. A manual **Verify private PDF storage** Action now prepares authenticated round-trip, credential-free denial and temporary-object cleanup checks without database writes; local protocol tests pass. The operator supplied a screenshot of successful hosted verification run #2 and a Ready Production redeployment at `e379944`; subsequent screenshots confirm private draft rendering, signed-in PDF retrieval and signed-out denial. An operator screenshot confirms hosted encrypted recovery run #3 succeeded at commit `4ac862a` with an encrypted artifact. Recurring backups/long-term retention remain pending. A manual encrypted source-snapshot/database/PDF recovery rehearsal is now implemented and locally tested; see [REMOTE_RECOVERY.md](REMOTE_RECOVERY.md). The PDF workspace now prepares validated DRAFT worker jobs with a copy/manual-copy handoff, without generating, approving or publishing content. No bucket or credential is provisioned automatically; no existing files are migrated or editions released.

## Phase 5H — encrypted recovery rehearsal

A manual source-snapshot, encrypted database/PDF capture and isolated restore workflow is implemented with local security/integration evidence. The operator supplied a screenshot of hosted recovery run #3 succeeding at commit `4ac862a`, with an encrypted artifact available. Independent key retention and protected long-term backup storage remain operator responsibilities. No production data is restored in place. Scheduling/PITR, durable off-site retention, full-service secret/provider reconciliation and cutover remain separate work. See [REMOTE_RECOVERY.md](REMOTE_RECOVERY.md) and [PHASE_5H_REPORT.md](PHASE_5H_REPORT.md).

## Current milestone: Phase 5I — account email readiness

Added offline SMTP configuration checks and a main-only connection-verification Action that sends no messages and accesses no database. The zero-extra-cost setup can use an owner-authorized existing Gmail account and App password, within provider/runner limits. Real sender authorization, provider configuration, dispatcher deployment and verification/reset inbox tests remain pending; mail and public registration stay disabled. See [MAIL_SETUP.md](MAIL_SETUP.md).

### Phase 5I delivery pilot

The operator supplied a successful no-send SMTP check #5 at cfe2e04 and reports saving web settings. Added an explicitly authorized, administrator-only manual dispatcher for controlled verification/reset inbox tests, preserving current-account scope, encrypted payloads and existing token/lease gates. Actual hosted message receipt/link consumption and a reliable unattended public dispatcher remain pending. Keep registration closed; use [MAIL_SETUP.md](MAIL_SETUP.md) for the pilot.
