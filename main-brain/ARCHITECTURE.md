# Architecture and shared contracts

Last consolidated: 2026-11-09. Local source/configuration reviewed; historical test and hosted observations are dated below. This documentation pass did not rerun application tests or inspect live services.

## Components and data flow

`Student React UI → Express API → Supabase Auth/Postgres/Storage`
`Android → Supabase Auth + RLS-protected reads; Express for enrollment/payment/access`
`Standalone Admin → Supabase Auth + admin-authorized database/Storage operations`
`Razorpay → signed Express webhook → payment ledger/finalizer → enrollment`

The Vite student UI and Express API deploy as one Render service. The separate Admin is a static application. There is also a legacy embedded Admin UI in the web app; supported payment/content fields must remain aligned while it is reachable. Backend implementation is in [server.ts](../server.ts) and [server modules](../server). No second mobile payment backend exists.

## Authentication and authorization

Express accepts a Bearer token (or session cookie): custom encrypted/signed web sessions are verified and their user fetched through Auth Admin; Supabase tokens are verified through Auth. It loads the authoritative role from profiles rather than trusting client claims. Missing auth is rejected; unavailable identity/profile fails closed. Admin UI gating supplements, rather than replaces, RLS. Existing custom sessions are not automatically revoked by the password recovery change.

The shared has_active_batch_access RPC requires active exact-user/batch enrollment. Paid access additionally requires a matching server-verified successful payment, amount and provider evidence. Administrators have explicit content-management access. Free enrollment uses the authenticated backend endpoint; clients cannot create paid entitlements. Course structure and progress/history writes are protected; public search exposes batch metadata only.

## Stable interfaces

| Endpoint | Contract |
| --- | --- |
| GET /health | Public process health; not proof of database/payment health |
| GET /api/batches and /api/batches/:id | Active public catalog metadata |
| POST /api/enrollments | Authenticated free-batch enrollment with server checks |
| GET /api/enrollments/:userId | Owner/admin checks and verified active access filtering |
| GET /api/batches/:batchId/access | Authenticated batchId and hasAccess |
| GET /api/batches/:batchId/structure | Authenticated entitlement required |
| POST /api/payments/create-order | batchId only; returns paymentId, orderId, integer-paise amount, currency, public keyId |
| POST /api/payments/verify | Three Razorpay callback identifiers only; returns paymentId, batchId, status, hasAccess, message |
| GET /api/payments/:paymentId/status | Owner-only reconciliation with same status shape |
| POST /api/payments/razorpay/webhook | Raw JSON signature/event validation; durable idempotent processing |
| GET /api/admin/payments | Admin-only ledger read; not evidence of a complete reconciliation UI |

Payment status is pending/success/failed. Success and current entitlement are separate: callers must check hasAccess. Server loads price/identity; HMAC and fetched provider order/payment validate ownership, amount, currency, receipt, mode and capture. Authorized alone stays pending. Duplicate callbacks/webhooks share locked finalization; failures do not revoke valid enrollment. Unknown/static-button events are audit-only. See [payments](../docs/payments.md) for retry semantics.

## Database ownership

| Tables | Responsibility |
| --- | --- |
| profiles | Auth-linked identity and protected role |
| batches, subjects, chapters, lectures | Catalog, overview_content JSONB and syllabus/media references |
| homepage_settings, announcements | CMS sections, faculty and notices |
| payments, payment_webhook_events, enrollments | Verified ledger, idempotency and access |
| lecture_progress, watch_history, daily_streaks | User-owned learning state |

The [migration directory](../supabase/migrations) records ten dated schema/security migrations from September 4–11, 2026. Historical records say they were applied; remote state was not rechecked in this consolidation. Service-only finalization, restrictive course policies and role protections are critical invariants. Schema summaries in archives are incomplete historical snapshots, not current migration specifications.

## Storage and configuration boundaries

course-assets is public for existing free files; thumbnails is public-read with admin write guards. Backend uploads validate type/signature/size and avoid deleting shared references. Admin picker checks do not impose bucket-wide limits. Both buckets' public URLs remain public despite application gating. Private paid-file delivery and protected video hosting remain roadmap work.

Server credentials stay on the backend. Browser/mobile use publishable settings only. CORS uses exact APP_URL and configured origins. Public policy routes serve script-free HTML. See [configuration](TECH-STACK.md) and [remaining security work](ROADMAP.md).

## Test Series shared contract — 2026-11-12

`batches.catalog_visible boolean not null default true` controls discovery and new sales, independently from active learning access. Existing records default visible. Classification uses a normalized Test Series marker in tags, category or custom_tag; Admin writes one canonical `Test Series` tag and preserves existing unrelated tags/category. No records are duplicated during classification.

Public `GET /api/batches` and search expose only active listed records; the catalog includes MPPSC batches and legacy Test Series classifications. Public single-batch reads reject withdrawn records. Authenticated `GET /api/my-batches` returns active listed rows plus the caller's entitled withdrawn rows (Admin can see all active rows). Clients filter discovery by `catalogVisible`, retaining owned withdrawn rows in dashboards. Never use catalog visibility as a substitute for entitlement checks.

Batch API types map `catalog_visible` to `catalogVisible`; create/update honor the field. Free enrollment and new Razorpay order creation reject withdrawn rows. Database triggers serialize new free-enrollment/payment insertion against removal with a batch row lock. Direct authenticated enrollment INSERT is denied: all supported clients use the authenticated Express API with a server-owned database client. Existing captured-order reconciliation/finalization still works after withdrawal, without creating duplicate enrollment/payment records.

RLS hides withdrawn batches from anonymous/unrelated users, allowing Admin and the entitled owner to read. Admin-only write policies remain authoritative. Test Series deletion and removal of its classification are rejected by a trigger; use visibility instead. Price validation rejects contradictory free/paid flags, nonpositive paid prices and discounts above price. After any enrollment/payment, changing a series access type or active flag is rejected to preserve access. Legacy content/access policies and server-only payment finalization remain in force.

Migration history records the three November 12 migrations listed in CHANGELOG. [Rollback verification script](../scripts/verify-test-series.sql) uses existing test identities without disclosing them, creates temporary transaction fixtures, then rolls back; never remove its transaction boundary.

## Payment contract completion — 2026-11-12

Express uses Razorpay SDK 2.9.8 with backend-only environment keys. Create requests accept `batchId` only; price/INR/receipt come from the server and DB, with minimum 100 paise. Response uses existing camelCase `orderId`, integer `amount`, `currency`, local `paymentId` and public `keyId`; no duplicate `/api/create-order` alias is required. Web loads official Standard Checkout dynamically; direct Android uses its native checkout against the same authenticated endpoints. No frontend key environment variable is necessary because the backend returns the public ID.

Verification validates HMAC-SHA256 of the stored order ID plus payment ID with timing-safe comparison, ownership and provider-captured amount/currency/order/mode before the existing idempotent Supabase finalizer grants enrollment. Provider authentication errors are sanitized 401; other provider errors 500; missing/invalid verification fields/signature 400. Ambiguous create failures are recovered by receipt without another order POST. Web rejects responses if the session token changed in flight.

Supabase `payments` is the purchase/order ledger; `payment_webhook_events` records durable deduplicated event metadata, and enrollments hold shared entitlement. This is not a complete settlement/refund/individual-attempt accounting system: provider retries may update the same purchase; automatic refund processing remains outside scope. Admin reads explicit non-secret columns with RLS and pagination, including test/live mode and legacy ID fallbacks; it does not mark purchases paid from the browser. Existing Admin write permissions were not expanded. Payment success does not alone establish current content access.
