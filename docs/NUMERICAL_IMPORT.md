# Add the prepared numerical drafts to the hosted library

The public lesson pages and the administrator's database library are separate. This manual operation imports existing teaching drafts; it does not generate new reviewed content. It uses the same editorial validation, author attribution, duplicate-prompt checks and creation audit events as the API.

## Run the import

1. Keep `DATABASE_MIGRATION_URL` and `ADMIN_BOOTSTRAP_EMAIL` in [repository Actions secrets](https://github.com/elisertual6-cyber/csc-e-book/settings/secrets/actions). The email must match your existing ADMIN account. No administrator login password is needed; keep the removed password secret deleted.
2. Open [Import numerical drafts](https://github.com/elisertual6-cyber/csc-e-book/actions/workflows/import-numerical-drafts.yml).
3. Choose **Run workflow → main → Run workflow** and wait for success.
4. Refresh [the admin workspace](https://csc-e-book.vercel.app/admin). Inspect **Chapters**, **Lessons**, and **Questions**. No redeployment is required for database content.

On an empty content database the job creates 25 provisional curriculum headings, five numerical lesson drafts and 20 numerical question drafts. Chapter headings do not represent 25 completed lessons. The job never inserts prices, products or templates. It also never approves, submits, publishes, releases PDFs or enables checkout.

All new lessons/questions are DRAFT and attributed to the selected administrator as the importing editor, not as an attestation of original authorship or independent correctness. The source remains marked unapproved. These are public educational samples; their answer keys are already readable in the public repository. They must not be marketed as a confidential or exclusive paid bank.

## Existing data and retries

The entire import runs in one transaction, with a current ADMIN role check and a lock shared by repeated CLI imports. The transaction is bounded to three minutes to accommodate hosted database round trips. The GitHub workflow also shares the migration-job concurrency group. Every existing chapter slug, lesson slug or question key is skipped, regardless of version, author, edits or lifecycle state. No existing material is overwritten and no new version is silently added. An earlier demo seed may therefore yield fewer new records; notably its existing arithmetic-intro lesson is preserved.

A conflicting normalized question prompt under a different key causes rollback, not a partial import. Safe errors omit email, answer keys and database exception details. Correct the conflict deliberately before trying again; never delete editorial records merely to make the job pass. Repeating a successful import skips existing keys and adds only a summary audit event. A source change is not automatically an instruction to replace existing content; use the editorial version workflow for revisions.

Only the five numerical lesson areas have prepared text. The other chapter areas, complete curriculum, independent review, official reference checks and 500-question commercial gate still need work. A distinct qualified reviewer must inspect submitted content before admin publication. PDF/mail workers and payment provider readiness are separate deployment tasks.

## Local operator command

For an authorized local operation, supply the intended connection and importing administrator identity through private environment configuration, then run `npm run content:import-drafts -- --apply`. Without `--apply` the command refuses to write. The React server condition is limited to this operator process so it can reuse server-only editorial services; do not remove server-only boundaries from application modules.

The isolated `operator-draft-import.spec.ts` test verifies role rejection, complete rollback on conflict, preservation of edited content, repeat safety, audit attribution and the absence of approvals or activated commerce. Run with `npm run test:content-import`; it uses the disposable database wrapper and a separate configuration without starting a web server. Its conflict/count fixtures must not share the concurrent browser suite's database.
