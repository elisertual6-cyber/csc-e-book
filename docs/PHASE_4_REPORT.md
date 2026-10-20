# Phase 4: development commerce milestone

## Delivered

- Responsive `/shop`, `/account/purchases` and `/admin/products` screens for active products, PHP pricing, orders, payment status and private files.
- Admin-only product creation, immutable replacement prices, explicit PDF release/activation and audited purchase access revocation/restoration. Whole-edition eligibility, matching versions and checksum checks gate commercial releases; development draft proofs are permanently marked and prohibited in production.
- Authenticated, server-priced checkout with UUID idempotency and immutable purchased name/version/amount snapshots. Mock payment fulfillment commits one payment, entitlement, delivery notice and audit event atomically, with cancellation and simulated refund transitions.
- Owner-bound, random, hashed download tokens lasting five database-clock minutes, single-use consumption with row locks, checksum verification, purchase/entitlement rechecks, download history and private response headers.
- Development purchase-ready notification outbox, explicitly labeled as unsent. No real payment credentials or card data are collected. Production refuses mock checkout, mock-backed delivery and unsigned webhook events.

## Changes and checks

The additive `202610200004_development_commerce` migration extends order snapshots, artifact release metadata and download grants, and creates DeliveryNotice. Core files are `src/lib/commerce.ts`, `payments.ts`, `commerce-client.ts`, the commerce/admin route handlers, three client screens, private PDF validation, schema/migration, Playwright commerce/production-boundary tests and COMMERCE_OPERATIONS.md. Existing auth/editorial/exam behavior is preserved.

Validation on 20 October 2026: lint, TypeScript, all 16 unit tests, content validation, database integration, production build and all 14 production browser/security tests passed. The separate development commerce suite passed on desktop and mobile, exercising idempotent checkout/payment, price snapshots, ownership, single-use/expired links, revoked/restored access, mock reversal and forged webhook rejection. Synthetic approvals and purchase proofs remain confined to disposable databases/private directories. Mobile library and exam-result screenshots were inspected for layout and overflow. Actual browser attachment downloads and admin product/order rendering were also checked on both screens. Migration deployment was rerun for repeatability.

## Limitations and operator actions

This is a development milestone, not complete production commerce. A selected gateway adapter still needs authentic signature verification, canonical payment checks, sandbox evidence and real refund/reconciliation handling. The webhook fails closed and production checkout is disabled. Notification outbox records do not send email; an actual mail adapter/worker, verified sender and delivery tracking remain pending. Private files use local disk; remote private object storage or durable shared-volume hosting, backup and restore proof remain deployment work.

Actual content is still one draft lesson/question and 25 outline chapters. No real templates/products were activated and no actual content was auto-approved. Complete the 500-question independent review target, whole-PDF human review, official source verification, legal/privacy/refund/support details and account verification/recovery before launch. Order/download/admin screens show up to 100 recent records; pagination and retention/monitoring belong to hardening.

Next: production integration work and Phase 5 accessibility, load/security, observability and restore testing. Cloud draft settings must be reviewed/saved and the environment published separately; local commits have not been pushed to GitHub or validated in a fresh restored task.
