# Zero-extra-cost mail readiness

Paid-reviewer update: GCASH_PURCHASE_DELIVERY.md documents the separate PURCHASE_MAIL_AUTOMATION request callback and purchase-only retry job. Account automation remains independently scoped. Both purchase settings default off, and real GCash/paid-edition rollout is still pending.

The operator has confirmed manual verification email receipt, successful verification and password recovery on the hosted preview. The encrypted queue and strict-TLS SMTP adapter are implemented. Automatic request dispatch and a bounded retry sweep are now available behind separate settings; hosted automatic delivery still needs activation and observation. This step adds **Verify SMTP setup without sending**, a manual main-only GitHub Action that checks configuration and negotiates SMTP/TLS/login. It does not send a message, access the application database, process queued mail, enable registration or change Vercel mail settings. SMTP verification alone does not prove sender permission, inbox placement, bounce handling or reliable job scheduling.

## Existing free Gmail account

For a small development preview, use an existing Gmail account whose owner authorizes SMTP access. This requires no paid domain or SMTP subscription. Google account limits/policies and GitHub runner eligibility/usage limits still apply; this is not unlimited sending or a production delivery guarantee. No paid plan, billing account or subscription is configured by this change. For a public commercial service, review provider policy, reliable delivery scheduling and sender/deliverability requirements before launch.

1. Sign in to the Google account you intend to send from. The owner must enable **2-Step Verification** and create an **App password** for this application at https://myaccount.google.com/apppasswords. Some managed, restricted or protected accounts do not support this method. A regular Google sign-in password is not the SMTP credential for this setup. If App passwords is unavailable, stop and choose another free provider or a reviewed OAuth implementation; do not weaken Google security or purchase a plan automatically.
2. Save the SMTP app password only in secure settings. Never put it in chat, screenshots, source or workflow inputs. The sender address must be the authorized account address (or a separately authorized Gmail sending identity); initially use the same address for SMTP_USER and MAIL_FROM.
3. Generate a **new, independent** 32-byte/64-hex MAIL_ENCRYPTION_KEY and retain it in your password manager. Do not reuse BACKUP_ENCRYPTION_KEY, database passwords or provider credentials. The web app and eventual mail worker must use the identical mail key. Keep it through queue processing/recovery; changing it blindly makes pending payloads unreadable.

Create these **repository Actions secrets**:

| Name | Value |
| --- | --- |
| SMTP_HOST | smtp.gmail.com |
| SMTP_PORT | 465 |
| SMTP_USER | The authorized Gmail address |
| SMTP_PASSWORD | That account's SMTP App password |
| MAIL_FROM | The same authorized Gmail address |
| MAIL_ENCRYPTION_KEY | The separate random 64-hex mail key |

For any alternative authorized SMTP provider, use its supplied hostname, port and credentials instead. Port 465 uses implicit TLS; other supported provider ports require STARTTLS. The check preserves certificate verification and TLS 1.2 or newer. Production cannot use the local insecure receiver override.

## Run the connection check

Open **GitHub Actions → Verify SMTP setup without sending → Run workflow**, choose `main`, then run. It uses production-safe settings and the application's known HTTPS origin. A green result reports only:

```json
{"configuration":"ready","smtpConnection":"verified","delivery":"not_tested"}
```

A failure reports fixed configuration/SMTP-connection stage and configuration/authentication/connection/unknown reason. Provider bodies, addresses, SMTP responses, passwords and account credentials are not logged. No artifacts are produced. No external recipient receives an email in this check. The workflow deliberately has no database secret or queue-dispatch permission/configuration.

Equivalent trusted-host commands:

```bash
npm run mail:check
npm run mail:check -- --connect
```

The first validates settings offline, including a correctly configured key and application origin; it opens no SMTP connection. Only the explicit --connect form negotiates the SMTP connection. Both reject disabled mail, invalid/missing mail keys and unsafe configuration before contacting a server. The checker never generates local encryption-key files or calls sendMail.

## Original delivery gate (completed manual pilot)

After configuration/login succeeds, the operator must explicitly authorize a controlled account email test, configure the same key/provider settings on the web app and worker, deploy/verify the dispatcher, then confirm real verification/reset receipt and link consumption. SMTP login acceptance does not establish any of those outcomes. The operator subsequently enabled MAIL_TRANSPORT=smtp, ran the authorized administrator dispatcher and confirmed both verification and password recovery. Keep registration closed. The manual pilot alone does not provide unattended delivery; use the automatic setup below.

Use [ACCOUNT_SECURITY.md](ACCOUNT_SECURITY.md) for queue leases/retries, token binding, session revocation and delivery limits. Actual sender/account authorization is an owner action; an email address shown in an earlier screenshot alone is not authorization.

Local evidence: lint/type checking, 108 unit tests, content checks and production build passed for the readiness tooling. A loopback SMTP negotiation test received no messages; mocked transport checks also assert sendMail is never invoked. No hosted provider login or delivery was attempted by this task.

Configuration failures now include an `issues` array containing only allowlisted setting names and fixed format hints (for example MAIL_ENCRYPTION_KEY / expected_64_hex_characters, or MAIL_FROM / expected_plain_email_address). No actual values, value lengths, addresses or credentials are printed. Gmail requires both SMTP_USER and SMTP_PASSWORD before verification. If a run fails during configuration, start a new run on main to get these diagnostics; do not regenerate or replace keys merely because a generic configuration check failed. Preserve any key already used to encrypt queued mail.

## Controlled operator delivery pilot

Operator evidence now shows **Verify SMTP setup without sending #5** succeeded at commit `cfe2e04`. This proves the configured connection/login check, not inbox delivery. The operator subsequently copied the same SMTP/mail-key settings into Vercel Production, enabled MAIL_TRANSPORT=smtp and redeployed. Manual dispatch reported sent:1; the operator confirmed receipt and link consumption for verification and then confirmed password recovery worked. This does not establish automatic delivery or general Inbox placement.

A separate manual **Process operator account email** Action now provides a bounded, zero-extra-infrastructure pilot. It uses existing GitHub secrets, strict SMTP TLS and the public Supabase CA for the database connection. No new paid provider, persistent server, recurring schedule or extra secret is installed. The workflow requires an explicit checkbox authorizing delivery to the configured administrator account the operator controls.

Scope is deliberately limited: the current ADMIN matching ADMIN_BOOTSTRAP_EMAIL, at most five due VERIFY_EMAIL, RESET_PASSWORD or PASSWORD_CHANGED messages. The claim SQL filters by that user and those purposes before acquiring leases. Other users and purchase notifications are never claimed/materialized by this job. Existing token expiry, purpose/address/auth-generation, cancellation, encryption and lease checks still apply. A non-admin/missing operator or missing --send authorization fails before dispatch. SMTP retry/terminal failure makes the job fail; a green run with sent:0 is not proof of a delivered email. It may mean no due message, cooldown, cancellation, expiry or an already-verified account.

### Run the verification test

1. Confirm the administrator account email is an inbox you control and matches the configured ADMIN_BOOTSTRAP_EMAIL. Keep public registration closed.
2. In Vercel Production, after saving the SAME SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, MAIL_FROM and MAIL_ENCRYPTION_KEY that passed the GitHub check, change **MAIL_TRANSPORT to smtp** and redeploy the latest main commit. APP_URL remains the existing HTTPS application origin. Do not regenerate the mail key.
3. Open `/account`, sign in as that administrator, then click **Send verification email** (wording may vary). This explicitly queues your account message. It does not automatically send through this pilot.
4. Immediately open GitHub **Actions → Process operator account email → Run workflow → main**, tick the authorization checkbox and run. The job may send legitimate queued account messages only for that configured administrator. It never returns a credential link in logs.
5. Check the job aggregate counts and your inbox/spam folder. Open the verification link and explicitly confirm it. Verify the account page shows email verified. Report the result without posting credential URLs, fragments, message bodies or passwords.

If the address is already verified, no verification message is queued. A later controlled password-reset test can use `/forgot-password` for the same operator; dispatch within the 30-minute token expiry, confirm a chosen new password and verify old sessions are signed out. Keep the new credential in your password manager. Do not run recovery tests on another person's account.

The pilot is **manual**, not an unattended mail service. GitHub job delays/failures can outlast a reset token; it is not suitable as the advertised public password-recovery dispatcher. Other users' queued mail remains untouched. After inbox and link tests, continue to deploy/validate a reliable event-driven or scheduled dispatcher, retry monitoring and bounce handling before public registration/commercial launch. The original `mail:work` general worker remains separately available for a reviewed full deployment; this pilot does not start it.

Logs show fixed stages/reasons and aggregate counts only. No recipient, credential, provider response or SMTP body is printed; there are no mail artifacts. A `retried`/`failed` result can indicate provider rejection, a different web/worker encryption key or transport mismatch; inspect secure settings without exposing them. Preserve keys needed to decrypt pending messages.

## Automatic account email for the closed preview

The request handler now returns its usual response, then uses Next.js `after` to attempt only the exact committed account message created by that request. The Node route has a 60-second maximum duration; SMTP connection/greeting/socket timeouts remain bounded. Unknown-account and cooldown requests return the same response and schedule no queue lookup. No token, message ID or recipient is exposed by the response or logs. Verification, reset and password-change messages retain the encrypted queue, token rechecks, expiry, cancellation and lease rules. The request path does not drain another user's queue or any purchase mail.

Enable using the already working provider settings and **the same existing MAIL_ENCRYPTION_KEY**:

1. In **Vercel → csc-e-book → Environment Variables**, add **ACCOUNT_MAIL_AUTOMATION=true** for **Production**. Keep MAIL_TRANSPORT=smtp and all existing SMTP settings. Redeploy the latest main commit so the new code and setting take effect.
2. In **GitHub → repository Settings → Secrets and variables → Actions → Variables**, add a **repository variable** named **ACCOUNT_MAIL_AUTOMATION** with value **true**. This is a feature flag, not a secret. The new **Retry queued account email** workflow uses the existing DATABASE_MIGRATION_URL, SMTP/mail secrets and validated provider CA. It does not need a new key or provider account.
3. Keep **REGISTRATION_ENABLED=false**. Request a password reset for your own administrator account using the website. Without running the old manual operator dispatcher, confirm prompt receipt, usable link and successful reset/sign-in. Confirm the subsequent password-change notification too. Never share credentials or links as evidence.
4. Check Vercel's fixed `account_mail_dispatch` aggregates and the GitHub **Retry queued account email** run counts. A successful run with sent:0 means no eligible due mail; it is not a delivery receipt. Run that retry workflow manually on main if you need to inspect a due retry. No message body or credential artifact is produced.

Both settings default off and must be enabled separately. Disable the Vercel flag to stop new automatic first attempts; disable the GitHub variable to stop retry sweeps. Queued encrypted messages remain subject to expiry/cancellation and can be handled by the reviewed manual pilot. Do not replace the encryption key when toggling flags.

The retry job runs on a five-minute cron (minutes 3, 8, …, 58), claims at most ten due account messages per run across users, and includes expired leases. It has no recipient input and never materializes or dispatches purchase notices. Explicit --send and ACCOUNT_MAIL_AUTOMATION=true are required by its CLI; GitHub additionally checks the main branch and repository variable. Existing five-attempt exponential retries and terminal cleanup apply. Multiple workers safely contend through row locks, but SMTP remains at least once: a provider acceptance followed by process/DB failure may produce a duplicate.

This uses existing free services with no added paid infrastructure. GitHub schedules are **best effort**: congestion, disabled/inactive schedules, runner eligibility/limits and provider quotas can delay or prevent a run. Vercel invocation limits also apply; a terminated first attempt leaves a lease recoverable by the retry sweep. A reset credential still expires after 30 minutes. Check and retain failure evidence, and request a fresh reset if it expires. This is an improvement for the closed development preview, not a guaranteed public recovery service. Bounce/complaint monitoring, capacity and a dependable delivery/alerting service remain launch gates. SMTP acceptance never proves Inbox placement.

Local validation of automation uses generated disposable databases, synthetic private-file mail and a loopback SMTP receiver. It covers real request callbacks, exact-message isolation, verification/reset/password-change delivery, unknown-account responses, session revocation, replay rejection, due/expired leases, future-message exclusion, provider rejection/backoff, concurrent workers and purchase exclusion. Hosted automatic delivery is not yet verified by this change.
