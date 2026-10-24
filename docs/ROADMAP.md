# Implementation roadmap

The current priority is **Phase 5: launch hardening**. The application is a development preview. Implemented software and passing local tests do not establish commercial or production readiness. This roadmap separates code that exists, verified test evidence and work that still needs infrastructure, provider credentials or qualified human review.

## Phase status

| Phase | Software delivered | Remaining release work |
| --- | --- | --- |
| 1. Foundation | Next.js, responsive public shell, curriculum, draft readers, PostgreSQL/Prisma and controlled deployment workflows | Official scope/source verification and production operational review |
| 2. Editorial and PDF | Authenticated editorial roles, versioned drafts, independent-review workflow, imports/exports and protected PDF generation | Complete/proofread curriculum, actual independent review, deployed browser worker and durable private storage |
| 3. Exam engine | Server-owned attempts, deadlines, immutable snapshots, grading, reports/history and entitlement checks | Reviewed production bank/templates, real payment integration evidence, capacity and recovery checks |
| 4. Commerce | Server-priced development orders, atomic fulfillment, access/download checks, encrypted mail queue and GCash sandbox adapter | Real merchant sandbox proof/current API verification, private hosted artifacts, authorized SMTP delivery and separate live-payment implementation |
| 5. Launch hardening | Local recovery drill, rate limiting, safe logs, readiness/uptime probes, public accessibility and bounded local load tests | Authenticated accessibility work below, manual usability/security review, deployed monitoring/recovery, legal/support readiness and all content/provider gates |

Operator screenshots and reports have confirmed Vercel deployment, Supabase migration/connectivity, administrator login and manual draft imports. They do not verify paid delivery, real email, merchant GCash testing, hosted recovery or human content approval. Hosted connections and dashboard changes still require an available authenticated connector or the operator's secure setup steps.

## Current milestone: Phase 5F — authenticated accessibility

**Automated implementation verified locally.** Extended Phase 5C's public-page work to signed-in learners, administrators, editors and independent reviewers. Fixed keyboard focus lost during answer/flag autosaves, unnamed subject progress bars, ambiguous answer-key controls and missing editorial selection state. The dedicated suite scans 22 configured states per viewport on desktop and mobile. See [PHASE_5F_REPORT.md](PHASE_5F_REPORT.md) for exact scope and remaining manual/deployed work.

Acceptance criteria:

- Run automated WCAG A/AA checks on account/security, orders, practice lobby, active attempts, graded results and populated history.
- Check editorial lessons/questions/chapters, submitted-version review controls, PDF selection controls, product forms and exam-template administration under their real roles.
- Verify keyboard answer selection, flags, saving, submission and editorial view/answer-choice selection.
- Keep participant accounts, simulated review and test templates in generated disposable databases; no production fixtures, automatic approvals or product activation.
- Keep manual screen-reader, zoom/reflow and broader commerce/error-state review explicitly pending. Automated scans are not conformance certification.

## Next engineering priorities

1. Complete the remaining Phase 5F manual and deployed accessibility review, including screen readers, zoom/reflow and conditional payment/download/error states. Local automated coverage is delivered; it is not a conformance claim.
2. Implement and deploy durable private artifact storage and the separate browser/PDF worker needed by Phase 2/4. Preserve checksums, entitlement checks, immutable manifests, private delivery and recovery evidence. Default Vercel disk is insufficient.
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
