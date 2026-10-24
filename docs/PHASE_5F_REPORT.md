# Phase 5F — authenticated accessibility hardening

This milestone implements the authenticated-state accessibility work explicitly left open by Phase 5C and the launch-hardening roadmap. It does not create or approve curriculum, enable payments, change authorization or claim production readiness.

## Delivered behavior

- Answer and review-flag controls recover keyboard focus after acknowledged saves. The existing busy/disabled lock remains in place. Restoration applies only to the original input on the same still-active question, when focus is otherwise on the document body. It does not steal focus after question navigation or restore controls after an unconfirmed/error state, expiry or grading.
- Subject performance progress bars in results and history have accessible names identifying their topic.
- The editorial question form groups answer choices under a legend and names the correctness radio controls by option letter. Keyboard users can distinguish the four choices.
- Content-type buttons expose their selected state with `aria-pressed`; native Enter/Tab behavior is retained rather than introducing an incomplete ARIA tab pattern.

All backend role, independent-review, immutable-version, deadline, server-grading and entitlement checks are unchanged.

## Dedicated verification

Run after building:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:a11y:authenticated
```

The command uses the existing disposable-database wrapper and a separate production-server configuration. It creates synthetic identities and content only in a generated `csc_e2e_...` database and removes that database afterward. Each test explicitly checks that database boundary before writing fixtures. Tests must never be aimed at the hosted app or customer data.

Four browser workflows run across desktop and mobile Chromium, with 22 configured screen/state scans per viewport (44 in total):

- Learner: account/security, empty orders, practice lobby, empty history, pending synthetic order with production checkout disabled, active attempt, graded result and populated history.
- Each of ADMIN, EDITOR and REVIEWER: lesson workspace/PDF selection controls, question workspace, submitted question/review controls and chapter workspace.
- ADMIN additionally: exam-template and product administration with loaded catalog records.

The scanner runs the WCAG 2/2.1 A/AA axe tags without suppressing rules, and checks horizontal overflow. Scans wait for identifiable loaded UI rather than treating a loading page as coverage. Keyboard tests follow the skip link through question navigation into answer selection, flagging and submission; they assert focus after server acknowledgement. A deliberately held save verifies that navigating to another question retains the learner's new focus. Staff tests exercise content-type switching and distinct correctness-radio selection. Editor/reviewer access to admin-only template/product pages remains denied.

The pending order fixture never pays, requests a gateway checkout or grants access. Simulated publication used to exercise exam screens is isolated fixture setup, not human review of the actual curriculum. Browser traces contain only synthetic accounts and should still remain private test artifacts.

## Roadmap and release boundaries

The roadmap now states current phase status, a concrete next engineering sequence and the difference between implemented software and real deployment/provider/human evidence. The next infrastructure priority remains durable private artifacts and a separate browser/PDF worker, alongside authorized SMTP, authentic PayMongo sandbox testing, operational recovery/monitoring and content/legal review.

This is local automated accessibility evidence, not WCAG conformance certification or hosted-device validation. Manual screen-reader use, 200–400 percent zoom/reflow, touch/voice interactions, longer content and conditional/error/recovery states still need review. Paid/download and live-provider journeys are not certified by scanning a disabled sandbox button. Broader fulfillment/refund/mail controls need accessibility review in an authorized staging setup as those integrations become available. No actual merchant, email, remote-storage or production recovery evidence is introduced here.

The draft lesson/question totals remain 15 and 70. Nothing in this milestone satisfies the independent 500-question gate, verifies official 2027 coverage, changes checkout/registration settings or deploys external services. All existing launch restrictions remain.

## Validation result

Lint, TypeScript, all 48 unit tests, content checks and the production build passed. Build tracing verified all 48 manifests without transient artifacts. The regular production browser/security suite passed all 31 tests; the separate authenticated accessibility suite passed all four workflows and their 44 configured scans. No axe rules were disabled. Existing test fixtures and their temporary database were removed by the wrapper. These results establish the local scope above, not the unresolved external/manual release requirements.
