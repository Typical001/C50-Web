# Steps 4–5 — existing Express payment backend and Web/Admin Checkout

Implemented 2026-09-06. Web Checkout and existing CMS controls are integrated into Downloads; Android checkout and external end-to-end testing remain. Do not release paid purchases to customers yet.

## Web/Admin operation

Configure a paid batch and its effective price in the existing CMS. Payment Enabled controls purchase availability. The optional Razorpay Payment Button ID is a reference, not the production access mechanism; never paste executable HTML or secret keys.

The student modal creates a backend order, opens official Checkout, verifies provider identifiers, and polls the owner-only status endpoint for pending confirmation. Success requires matching payment/batch IDs and server-confirmed access. Start Learning checks entitlement again. Free enrollment is unchanged.

The separate ₹1,000 test fixture was created inactive and payment-disabled. In development, editing it shows the official button test component with an explicit no-course-access warning and a Dashboard Test-mode/amount confirmation checkbox. Do not check that box until verified in Razorpay. The component is not rendered in production. The authenticated Admin recheck showed Payment Enabled checked for both this fixture and Aagaz; no settings were changed during the inspection.

Automated checks now include 18 payment/client tests. Authenticated Admin controls were inspected, but actual Checkout success, dismissal/retry, pending confirmation, and webhook delivery still require a Test-mode end-to-end run.

## Endpoints

All client endpoints require the existing web session or Supabase access token in `Authorization: Bearer ...`. Students can only verify or reconcile their own purchases. Requests reject unexpected fields rather than trusting client amounts/user IDs/statuses.

| Endpoint | Input | Result |
| --- | --- | --- |
| POST `/api/payments/create-order` | `{ "batchId": "uuid" }` | `{ paymentId, orderId, amount, currency, keyId }`; amount is integer paise |
| POST `/api/payments/verify` | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` | `{ paymentId, batchId, status, hasAccess, message }` |
| GET `/api/payments/:paymentId/status` | Local payment UUID | Same status shape; performs server-to-server reconciliation |
| POST `/api/payments/razorpay/webhook` | Raw JSON plus Razorpay signature/event-ID headers | 200 only after durable processing/ignore; retryable failures return non-2xx |

`status` is `pending`, `success`, or `failed`. A successful payment and current course availability are separate: callers must check `hasAccess` before opening a course. Authorized-but-not-captured payments remain pending. Configure automatic capture in Razorpay; this service does not blindly capture authorized payments.

## Verification and retries

- HMAC-SHA256 comparison is constant-time. Checkout verifies the stored order ID plus the callback payment ID. Webhooks verify the untouched raw bytes before parsing JSON.
- Fetch order/payment data from Razorpay with backend credentials. Validate order/payment linkage, receipt/local purchase mapping, exact stored paise, INR currency, environment, paid order totals, captured payment, and no existing refund before finalization.
- `amount` remains rupees for existing UI compatibility. `amount_paise` and `gateway_mode` freeze the new provider snapshot. Historical records are not backfilled as verified purchases.
- One pending new-format purchase per user/batch is enforced by a unique index. Concurrent create calls reuse its order. Prices are fixed when the intent is created; repeated calls reuse that quote.
- Order POSTs are never automatically repeated after an ambiguous timeout. Retry create/status performs a read-only receipt lookup and safely repairs the local order link. If no matching provider order is found, the intent stays pending for support review; do not blindly reset/delete it or create a second order. After confirming in Razorpay that no order/payment exists, a trusted operator may mark the abandoned intent failed to permit a new attempt.
- Verification, status polling, and successful webhooks share the locked transaction. Repeated calls can repair a missing enrollment without duplicating payments or enrollments.
- Failed attempts update only a pending payment, never enrollment. A later captured attempt on that same order can safely succeed. Late failure events cannot downgrade a successful payment.
- Webhook event IDs are unique; store hashes, processing state, and optional local payment IDs, not complete bodies. Different content reusing one event ID is rejected. Duplicates may re-run idempotent finalization to repair missing enrollment.
- Unknown/static payment-button events are audit-only and never create entitlements.

## Deployment prerequisites still outstanding

Set backend-only `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. No secret belongs in Vite, Expo, CMS, or source control. Return only the public key ID to Checkout. Test/live credentials must match stored purchase mode; reconcile old-mode purchases before switching.

The local test API credentials were authenticated with a **read-only** Razorpay request. The webhook secret is still unset. Configure a strong secret directly in the server environment and the Razorpay test-mode dashboard, then configure the deployed HTTPS endpoint:

`https://YOUR-BACKEND/api/payments/razorpay/webhook`

Subscribe to `payment.captured`, `order.paid`, and `payment.failed`. Perform an actual test-mode Checkout payment and verify dashboard webhook deliveries after deploying; these external end-to-end tests have not yet occurred. No paid batch was enabled in this step.

The in-process authenticated limiter is 30 requests per route/user/minute. Add a shared edge limiter for a multi-instance deployment. Processing is synchronous and durably retryable; monitor webhook latency/failures and provider retry exhaustion. Reconcile affected purchases via the owner-scoped status endpoint or a reviewed backend-only operation.

Private paid files/protected videos remain a release prerequisite. Refund/dispute entitlement policy is not implemented by these three event handlers; define it before live rollout.

## Checks

Run `npm run test:payments`, `npm run lint`, and `npm run build`. The automated payment suite uses fake provider/store responses and real Express raw-body handling, not actual charges. `supabase/tests/course_entitlements.sql` runs rollback-only fixtures against the database to check constraints, RLS, finalization, and enrollment repair. `scripts/test-course-access.mjs` is a read-only backend smoke test requiring an existing student/free enrollment and configured environment.

## Official references

- [Razorpay Standard Checkout verification](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
- [Raw webhook validation and event idempotency](https://razorpay.com/docs/webhooks/validate-test/)
- [Orders and receipt lookup](https://razorpay.com/docs/api/orders/fetch-all/)
