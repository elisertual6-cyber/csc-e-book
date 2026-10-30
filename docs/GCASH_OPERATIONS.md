# GCash checkout through PayMongo

Current update: [GCASH_PURCHASE_DELIVERY.md](GCASH_PURCHASE_DELIVERY.md) documents the separately gated live-mode implementation and automatic purchase-email handoff. Real merchant/paid-edition rollout remains unverified and defaults closed. The original sandbox sections below retain their verification prerequisites.

GCash is the selected customer payment method. The application uses PayMongo-hosted checkout rather than collecting GCash PINs, OTPs, wallet credentials, card details, QR screenshots or customer-submitted payment claims. No live payment service is activated by this milestone.

## What is implemented and verified

Server-priced PHP orders, a GCash-only hosted checkout request, verified-email requirement, authenticated resume/status checks, strict hosted-link validation, signed raw-body webhook handling, canonical checkout/payment retrieval, atomic purchase fulfillment, event/payment idempotency, explicit operator reconciliation and confirmed-refund access revocation are implemented. The checkout return URL is only navigation; even a `status=paid` query grants nothing.

Automated tests use a local protocol emulator and intercepted hosted-page fixture. They do not send requests to PayMongo or transfer money through GCash. This is local implementation evidence, not proof that a merchant account or current PayMongo sandbox contract is working. Sandbox mode remains rejected in production. The separately gated live implementation requires all matching live settings, configured email and eligible released material; it has not been activated or verified with a merchant. Sandbox records use provider `paymongo_test`; they cannot grant production downloads, premium customer sessions or purchase email.

The cloud currently blocks developers.paymongo.com and api.paymongo.com. Their additions were saved in the environment draft, preserving the existing Prisma domain; saving did not apply or publish them. Current Checkout API documentation and actual merchant sandbox calls remain unverified until network access and credentials are supplied. The official PayMongo Node SDK at commit b541fa0fa20838b81ee03fa61a3f4807f48f3169 was read for Basic authentication, payment/refund fields and webhook signing. That SDK does not implement Checkout Sessions, so the checkout-session request/response assumptions below must still be confirmed against the current provider reference. The application fails closed on incompatible responses.

Official references to check before merchant testing:

- https://developers.paymongo.com/docs/checkout-api
- https://developers.paymongo.com/reference/create-a-checkout
- https://developers.paymongo.com/docs/webhooks
- https://github.com/paymongo/paymongo-node/tree/b541fa0fa20838b81ee03fa61a3f4807f48f3169

No fees, eligibility or account approval promises are made; confirm those with the provider.

## Merchant setup still required

1. Create/use the operator's PayMongo merchant account and complete its requirements for GCash acceptance. The previously supplied Gmail address is operator/proposed mail-sender metadata; it is not payment authorization or a GCash merchant credential. No personal GCash wallet number is needed in application source.
2. Review/save the PayMongo network-domain additions in cloud environment settings. On this Node 24 cloud, start Node with NODE_USE_ENV_PROXY=1 when making external provider calls so fetch respects the injected HTTPS proxy and NO_PROXY. Do not change proxy credentials or disable TLS verification. Standard deployments without a proxy use normal fetch networking.
3. Obtain a PayMongo **test** secret API key and test webhook signing secret. Enter them in secure runtime settings as PAYMONGO_SECRET_KEY and PAYMONGO_WEBHOOK_SECRET; never use NEXT_PUBLIC_ variables, Git, logs or chat. No actual keys are supplied by this task. The API key must be available to the application for Basic authentication and the signing secret for local HMAC; an inert proxy placeholder is insufficient.
4. Configure PAYMENT_PROVIDER=paymongo, PAYMONGO_MODE=test, GCASH_CHECKOUT_ENABLED=true and APP_URL equal to the actual trusted application origin. Run the development Node server. Production remains disabled even with these flags. Register the public HTTPS `/api/commerce/webhook` endpoint in the merchant dashboard and verify the current event names/payloads/signature contract, including checkout_session.payment.paid, payment.paid and payment.refunded. A localhost callback is not reachable by the provider; a real HTTPS test deployment is required.
5. Use synthetic test users and the provider's documented sandbox GCash flow. Verify successful, failed/cancelled, duplicated, delayed, wrong-amount and refunded payments; canonical retrieval; email/access delivery; operator reconciliation; and real webhook retries. Record provider resource IDs and sanitized outcomes, not credentials or customer details. Check current Checkout API request/response fields before enabling this test flag against an actual account.
6. Keep real sales off until this evidence, GCash merchant activation, reviewed commercial content, operational/legal policies, secure hosting/storage and the remaining launch checks are complete. Follow the separate rollout checklist in GCASH_PURCHASE_DELIVERY.md; no live release is enabled by this implementation task.

## Order and checkout behavior

`/shop` names GCash as the customer method and labels sandbox/mock/closed states. Verified customers create immutable server-priced orders. `/account/purchases` starts or resumes GCash sandbox checkout and offers an explicit status check. The hosted URL must be HTTPS on exactly checkout.paymongo.com, with no alternate host, user info or port. The provider gets only server-owned item/amount/currency/reference metadata and trusted return URLs. Receipt email is not requested from the gateway.

PaymentSession is unique per order. The local session is committed before making exactly one external creation attempt. Concurrent/repeated requests reuse that session; they do not issue blind repeated external POSTs. If creation may have succeeded but the response is lost/invalid, state becomes REVIEW_REQUIRED. The operator checks the merchant dashboard using the order reference and uses `/admin/products` → Reconcile sandbox payment with the correct `cs_...` session ID. The server retrieves and validates its order/local-session metadata before binding it. Reconciliation can recover an existing unpaid checkout or fulfill its confirmed payment. It never creates a replacement remote checkout. A completely unknown outcome stays blocked for operator investigation, not an automatic second charge.

Both the order reference and metadata order/local-session IDs, GCash-only method list, line-item amounts/quantities, currency, checkout ID and payment-intent ID are revalidated. Payment is accepted only from a canonical paid GCash record in the same successful intent, exact PHP total and test mode. Up to five payment records are inspected; multiple paid records require operator review. Invalid/missing fields, foreign references, wrong amounts, live records and provider failures grant nothing. Existing unpublished/withdrawn/missing/altered files remain protected by the PDF delivery checks.

## Signed events and fulfillment

`Paymongo-Signature` is checked against the unmodified bounded request body using HMAC-SHA256 over timestamp + '.' + body, constant-time comparison, the test signature slot and a five-minute freshness window. Duplicate/ambiguous header fields and nonempty live signatures are rejected. JSON/event data is parsed only after verification, and live-mode events are rejected. Fresh signatures are required for provider retries; if the provider retains an older timestamp, use canonical reconciliation and confirm its current retry policy before launch.

Supported notifications trigger canonical API retrieval; raw event amounts/statuses are not payment proof. Per-event advisory locks and order row locks serialize duplicate webhook/status requests. Payment resource ID, event ID, order entitlement and delivery notice have unique identities. One transaction commits verified payment, paid order, one purchased entitlement, notice and audit. A repeated event with conflicting bytes is rejected. A premature paid event with a not-yet-paid canonical record returns retryable failure and is not acknowledged as processed. Unknown authenticated event types are recorded as ignored and grant no access. Webhook receipt metadata stores only IDs/type/body hash, not full personal-data-bearing bodies.

Successful repeated confirmation never clears an existing access revocation. Successful provider refunds are retrieved from canonical records and revoke entitlements atomically. Any positive confirmed refund, including a partial refund, conservatively marks the entire order REFUNDED and blocks the whole bundle pending operator reconciliation; the current schema/UI do not claim partial-bundle accounting. Pending/failed refunds do not count as confirmed. REFUNDED is terminal: out-of-order paid events cannot restore access. This milestone observes refunds; it does not initiate a money-moving refund API call. Initiate/test actual provider refunds through the merchant dashboard under its documented workflow.

## Test and release evidence

Run the normal lint/type/unit/content/database/build checks. `npm run test:e2e` exercises the production server with test keys/flags present and confirms that checkout and sandbox-backed access still fail closed. Stop this checkout's normal development server before `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:gcash`; it starts a development app on port 3100 and a loopback fixture on 3201. Run this sequentially with other browser suites. The wrapper provisions a unique disposable database/private directory, injects generated fixture keys, runs migrations/seeds and destroys only generated test resources. The fixture refuses non-test databases/production runtime and never calls a real gateway.

The emulator's API-origin override is allowed only for loopback and a generated disposable database. Never set PAYMONGO_TEST_API_ORIGIN in operator/live settings. Browser navigation to the hosted domain is intercepted by the test; screenshots and simulated approvals/proofs do not count as actual provider or editorial review.
