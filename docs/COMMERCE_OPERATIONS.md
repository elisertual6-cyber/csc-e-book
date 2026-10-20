# Development commerce operations

This milestone implements a development storefront and mock purchase lifecycle. It is not a commercial launch. No real gateway, outbound mail service or remote object-storage integration is configured. Production checkout is deliberately unavailable, including when PAYMENT_PROVIDER=mock. No card data is requested or stored.

## Product preparation

An admin opens `/admin/products` to create an inactive product, configure an integer PHP price in centavos, attach an edition and activate after validation. Seed products remain inactive. Create a new product/version for changed commercial material; historical order items retain the purchased product name, version and price. A replacement price is a new immutable row; previous rows become inactive. Pending orders retain their original total.

Release requires a matching product/PDF version and explicit whole-document human-review confirmation. Commercial files must be FULL editions with lessons and at least 500 unique independently approved, still-published questions. Their manifest and bytes are revalidated on activation, checkout, link issuance and download. Withdrawn content and checksum mismatches prevent delivery. No development content is automatically approved or activated.

When NODE_ENV is not production and PAYMENT_PROVIDER=mock, an admin may attach a DRAFT proof for simulated delivery. Such artifacts are permanently marked developmentOnly and can never be downloaded in production. This is not publication or independent content approval. Never use actual customer information or represent proofs as saleable editions.

## Customer lifecycle

`/shop` shows active products, current PHP prices and clear development labels. Authenticated customers create one-item orders using a per-selection UUID checkout key. Prices, quantities and totals come from the server; extra client fields are rejected. A repeated key returns the same order and cannot select another price. Creation, activation and price changes coordinate through database locks.

`/account/purchases` shows up to 100 owned recent orders, pending-order cancellation, simulated successful payment and private file requests. A simulation accepts only the order action and obtains its event, amount and currency from the locked server-owned order. Fulfillment commits the verified mock payment, paid state, unique entitlement, development delivery notice and audit record together. Repeated/concurrent payment actions do not grant duplicate access. Cancelled/refunded orders cannot be paid again.

Mock operation requires both development runtime and PAYMENT_PROVIDER=mock. `npm run start` runs in production and refuses simulation, regardless of the configured provider. The webhook endpoint always returns 503: a posted status, forged event or success redirect never proves payment. A future provider adapter must verify its documented signature over the raw request, check event authenticity and canonical amount/currency/order state, reject replays and pass sandbox success/failure/refund tests before enabling production checkout. Do not remove the production block merely to make a demonstration work.

## Delivery and access administration

Artifacts reference the existing checksum-verified private PDF store (`PDF_PRIVATE_DIR`, outside public/ and static assets). Every issue and consume operation verifies the same customer owns a current unrevoked, unexpired entitlement; its paid order includes the artifact's product/version; order-line totals and price currencies are coherent; and a verified matching payment backs the order. Mock payment records cannot grant production downloads or premium exam access. Product deactivation stops new orders without removing a valid existing purchase.

Download links contain 256 random bits; only their SHA-256 hashes are stored. Links require the same signed-in owner, expire after five database-clock minutes and permit one successful delivery. Row locks prevent concurrent reuse. Delivery rechecks access, content eligibility and file checksum, then records consumption and an audit event. Failed/missing files do not consume links. An interrupted transfer may consume a link; customers can issue another. Download history records issuance/consumption, not proof a reader opened the PDF. Files have private/no-store headers and attachment disposition. Avoid token URLs in proxy/access logs; redact them in production observability.

Admins see the most recent 100 orders and payment states in `/admin/products`. They can revoke access immediately or restore a non-expired purchase backed by a coherent verified paid order, with audit records. Restoration cannot override refunds. In development, reversing a simulated payment changes the order/payment to REFUNDED and revokes its entitlements in one transaction. This is not an actual gateway refund; no funds move. There is no production refund adapter yet.

## Notifications and deployment prerequisites

A unique `DeliveryNotice` per paid order records a PURCHASE_READY event using `development-outbox`. The account explicitly states that no email was sent. Phase 5A adds the encrypted queue and functioning Node SMTP worker described in ACCOUNT_SECURITY.md. Real delivery still needs an authorized provider, verified sender/domain, scheduling and deliverability/transactional policy review. Never email private storage keys or reuse ephemeral download links in notices.

Private disk works for this single Node/browser worker. A deployment must supply a durable shared private volume or implement a remote private object-storage adapter, backups and restore validation. Default ephemeral/edge hosting is insufficient. Real-provider verification/recovery testing, real payment/refund reconciliation, remote storage, complete content/legal review and production operational hardening remain launch prerequisites.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run content:check`, `npm run test:db`, `npm run build`, then `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`. The ordinary suite runs the production server and tests that mock checkout and unsigned webhooks fail closed.

Stop this checkout's running development server before `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:commerce`: Next permits one development server per checkout. This separate suite starts a development server on port 3100, uses synthetic PDF proofs, exercises the full mock lifecycle on desktop/mobile, and checks concurrency, ownership, price snapshots, expiration, revocation/restoration and refund denial. Both wrappers provision unique disposable databases and private file directories and destroy only their generated resources. Never run bare Playwright against development/customer data. The database provisioning role needs CREATE/DROP DATABASE; the real application deployment role should not.

## Phase 5A notification update

The original development-outbox boundary now feeds an encrypted mail queue for verified customer addresses with coherent paid orders and live entitlements. The separately scheduled npm run mail:work worker supports private development copies and a strict-TLS SMTP submission adapter. No real SMTP provider is configured or authorized in this cloud. File copies are not sent emails; SMTP acceptance is not guaranteed inbox delivery. Read ACCOUNT_SECURITY.md for scheduling, credentials, retry/lease behavior, sensitive-payload erasure and real-provider prerequisites.
