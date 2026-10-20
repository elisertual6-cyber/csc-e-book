# Account verification, recovery and transactional mail

This milestone adds functioning verification/recovery software and a Node SMTP submission adapter. No real provider has been authorized in this environment. Local SMTP acceptance in automated tests does not establish Gmail/domain authentication or production mailbox delivery. Production mail defaults disabled and rejects file delivery. Checkout remains disabled pending a real signed payment adapter and the other launch gates.

## Customer flow

The account page shows whether its email is verified and offers an explicit verification request. The registration flow still signs in a development customer; it does not silently mark the address verified. The user requests a message and must confirm its link with a POST form. The sign-in screen links to `/forgot-password`. Reset messages go only to the existing account address. Known/unknown-account requests return the same 202 status and text; when mail is disabled both receive the same 503. Responses never contain credentials or recovery links. This is not a claim of identical request timing.

Verification credentials last 24 hours; password-reset credentials last 30 minutes. Both use 256 random bits, database-stored SHA-256 hashes, purpose/address/auth-generation binding and a single consumption. Requests have a global rate limit, per-address/user limits and a one-minute locked-user cooldown. A fresh request invalidates earlier credentials of that purpose and erases pending mail payloads. Email links place credentials in the URL fragment so they do not reach the web server, access logs or HTTP Referer. GET/opening a link changes nothing; an explicit form submission is necessary. The fragment is removed from browser history on successful submission. Never add analytics or screenshot capture to these credential forms.

Password reset validates again under a user row lock after scrypt derivation, increments the user's authentication generation, removes all sessions, cancels outstanding account credentials/messages, and queues a password-change notification in one transaction. It does not automatically sign the user in or change role/email. A simultaneous old-password login can create a session only if its originally verified generation still matches under the same lock. Session reads check the generation too. Operator role changes increment the generation and remove sessions. There is no operator bypass that mails a known/default password.

## Private outbox and worker

MailMessage is a durable encrypted queue. Recipient, subject, message text and embedded account credential are encrypted with AES-256-GCM, random nonces and authenticated version metadata. Payloads are erased after successful submission, cancellation, terminal failure or expiry cleanup. Delivery metadata remains for operational review under a future operator-approved retention policy. A message's SENT state means a private development copy was written or SMTP accepted it, not guaranteed inbox delivery.

Run `npm run mail:work` from the project root. One run materializes at most 100 eligible purchase notices, then processes at most 25 due messages and exits. Schedule it regularly using the deployment's job runner; no scheduler is installed by this task. Multiple workers claim rows using FOR UPDATE SKIP LOCKED and database-clock two-minute leases. Expired leases are reclaimable. Failures retry with exponential backoff and a five-attempt cap, storing a generic error code instead of recipient/provider response text. A stable Message-ID supports downstream deduplication. Delivery is at least once: an SMTP acceptance followed by process/DB failure can cause a duplicate on retry. There is no exactly-once SMTP guarantee.

The worker rechecks credential purpose/state/expiry/auth generation and current address before sending an account message. An already-in-flight SMTP request cannot be recalled after cancellation; any delivered invalidated credential remains unusable. Purchase notices require a verified email, coherent same-owner PAID order, matching verified payment and live purchased entitlements. Revoked/refunded or inconsistent state cancels delivery. Mock-backed purchase email is prohibited in production. Notices link to the account, not private object keys or ephemeral download credentials.

In development, MAIL_TRANSPORT defaults to file. Rendered messages are written only beneath MAIL_PRIVATE_DIR (default `.local/mail`, directory 0700 and files 0600). This is a sensitive private inbox, not an HTTP endpoint. No mailbox receives these copies. The development encryption key is generated once in that private directory if MAIL_ENCRYPTION_KEY is absent. Preserve it to read pending encrypted mail; never commit or print it. `npm run maintenance` clears expired account tokens/mail payloads and private inbox copies older than 24 hours, while preserving the encryption key.

## Real SMTP setup

Use secure environment settings for:

- MAIL_TRANSPORT=smtp
- SMTP_HOST and SMTP_PORT (465 for implicit TLS, or a provider's STARTTLS port)
- SMTP_USER and SMTP_PASSWORD when required by the chosen provider
- MAIL_FROM: a verified plain email address accepted by that provider
- MAIL_ENCRYPTION_KEY: a unique random 32-byte key encoded as 64 hex characters
- APP_URL: the application's real HTTPS origin, matching mutation-origin checks
- OPERATOR_EMAIL: private operator contact metadata

Credentials and encryption keys belong in secure environment settings, never source, command arguments, screenshots or chat. Production enforces certificate verification, TLS 1.2 or later, and STARTTLS when not using implicit TLS. SMTP_ALLOW_INSECURE can be true only for local development receivers on loopback; it is rejected in production and for remote hosts. Nodemailer debug logging, arbitrary URL fetching and file attachments are disabled.

If using Gmail, the account owner must authorize the selected Gmail/Workspace SMTP mechanism and verify the sender; this project does not claim that simply supplying an email address authorizes sending. Configure the credentials securely and run provider-specific send/receive and recovery smoke tests before enabling public registration. No Gmail password or app password was requested or stored by this implementation. Provider credentials, DNS/sender setup and bounce/delivery monitoring remain operator prerequisites.

Back up the production encryption key through the secret-management system separately from database backups. Rotate after draining the queue or implement a versioned keyring; replacing the key blindly makes pending payloads unreadable. Do not carry development inboxes, identities or mock order data into production. Account verification is recorded, but existing practice/login behavior is unchanged; a future real checkout must explicitly require verified email as part of its release policy.

## Evidence and remaining work

Unit checks cover authenticated encryption/tampering, safe defaults, private-directory validation and strict SMTP TLS settings. Disposable browser/security tests exercise verification, wrong-purpose/expired/superseded/replayed tokens, reset confirmation, generation/session revocation, simultaneous resets/logins, uniform responses, SMTP acceptance/rejection/retries, worker concurrency and unique eligible purchase notifications on desktop/mobile. Only loopback SMTP test receivers accept synthetic email.

Remaining launch work includes real SMTP account authorization and inbox/bounce testing, real payment signatures/sandbox/refunds, content/source review, durable storage and backup/restore validation, public monitored support details and legal policies, accessibility/load/security/observability checks. This milestone does not certify production readiness.
