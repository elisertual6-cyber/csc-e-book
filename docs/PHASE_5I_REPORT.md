# Phase 5I — account email delivery

The operator's zero-extra-cost preference is met using the existing owner-authorized Gmail SMTP account, Vercel application and GitHub Actions. No paid provider, domain, subscription or persistent server is introduced. Provider/runner eligibility and usage limits still apply. Public registration and real checkout remain closed.

## Hosted evidence

The operator supplied successful no-send SMTP check #5 at cfe2e04, configured matching SMTP/mail-key settings on Vercel and enabled MAIL_TRANSPORT=smtp. The administrator-only manual dispatcher at 91827c0 reported sent:1. The operator then confirmed verification message receipt and successful link consumption, followed by working password recovery and sign-in. This is operator-confirmed controlled manual evidence; it does not prove general Inbox placement, bounce handling or automatic delivery.

The no-send checker remains available: offline configuration validation or an explicit SMTP/TLS/login negotiation. It never submits email, accesses the queue or exposes provider errors/credentials. Allowlisted setting names/fixed format hints help diagnose preflight errors. The manual main-only administrator dispatcher remains limited to five due account messages and requires explicit send authorization.

## Automatic implementation

After a committed verification/reset request or password change, the Node auth handler can schedule its exact message through Next.js after-response work. ACCOUNT_MAIL_AUTOMATION defaults off. Responses stay unchanged and never expose IDs or credential links; unknown/cooldown requests schedule no database work. Delivery failures preserve the durable queue and produce only fixed/aggregate events. The callback attempts one account-purpose message and cannot drain another user's pending messages or purchase notices.

The separate **Retry queued account email** workflow runs on main only when its repository variable ACCOUNT_MAIL_AUTOMATION=true. Its CLI also requires the flag and --send. Each run handles at most ten due account messages across users. It never materializes or dispatches purchase mail. Existing SKIP LOCKED claims, two-minute lease recovery, token/address/generation/expiry rechecks, encrypted payload cleanup, exponential backoff and five-attempt cap remain intact. Database TLS retains hostname/certificate verification using the existing validated public provider CA; SMTP retains strict TLS.

The five-minute GitHub schedule is best effort and may be delayed/disabled by platform behavior or usage limits. Vercel execution can terminate before completion; the encrypted queue/lease survives for retry. SMTP is at least once, and a provider acceptance followed by process/DB failure can cause a duplicate. SMTP acceptance is not Inbox placement. A 30-minute reset token can expire before a delayed retry. This is closed-preview automation, not a guaranteed public delivery service.

## Validation and rollout

Validation passed: lint, TypeScript, 114 unit tests, content checks and production build with 48 verified trace manifests. Four isolated automatic-mail workflows passed on the configured desktop/mobile projects. They invoke real API after-response callbacks and the retry CLI subprocesses against generated disposable databases, a private synthetic inbox and loopback SMTP. Coverage includes exact-message isolation, verification/reset/password-change submission, uniform known/unknown responses, session revocation, replay rejection, due messages, expired leases/messages, future availability, rejection/backoff, concurrent claims, aggregate redaction and purchase exclusion. Unit checks also cover feature-off behavior, deferred callbacks and redacted failure isolation. No hosted recipient or SMTP credential was used in these tests.

Four existing desktop/mobile account-security/manual-operator regression workflows also passed, including token expiry/purpose/supersession, concurrent reset/login, session revocation, operator authorization, other-user/purchase exclusion and wrong-key retry failure. No schema or application UI changes are needed. See [MAIL_SETUP.md](MAIL_SETUP.md) for the two activation settings and redeployment. Preserve the already working identical mail key; do not regenerate it.

Hosted automatic receipt/latency, retry observation, provider-limit review, bounce/complaint monitoring and dependable alerting remain pending. Keep registration closed until these and the other launch gates are satisfied. Nothing in this milestone approves content, activates paid editions or enables commerce.
