# Current state — Web and shared backend

Last consolidated: 2026-11-09. Local source/configuration reviewed; historical test and hosted observations are dated below. This documentation pass did not rerun application tests or inspect live services.

## Evidence ledger

| Area | Implemented | Recorded verification | Deployment / remaining uncertainty |
| --- | --- | --- | --- |
| Learning platform | Catalog, auth, enrollment, subject/chapter/lecture drill-down, video/notes, progress, watch history, streak/statistics APIs, announcements/search | Historical builds and access smoke checks on September 5–6 | Core Render web/backend deployment recorded September 6; full student journey unverified |
| Durable state/uploads | Production routes use Supabase; local JSON retained as legacy reference. Storage-backed validated uploads and shared-reference cleanup | September 4–5 migration/SQL/build evidence | Public course-assets retained; private paid files/videos unfinished |
| Payment/access | Real Orders, provider verification, raw signed webhooks, reconciliation, locked enrollment finalizer; protected reads and role escalation defenses | 18 payment/client tests recorded September 6; SQL fixtures rolled back | Test webhook configured September 7; no recorded successful external checkout/delivery E2E |
| Recovery | Isolated verified recovery session, expired-link/resend, URL cleanup, legacy endpoint 410 | 7 recovery tests recorded October 27; live expired-link UI checked | Deployed code and hosted redirect correction recorded October 27; template and successful fresh-email reset/login unverified |
| Public policies | /privacy, /delete-account, /terms and slash variants; footer/cross-links | Local build and unauthenticated HTTP checks October 27–November 5 | Live publication of these changes not established; owner review and deletion fulfilment pending |
| Shared CMS | Batch/payment metadata, overview JSONB, homepage/faculty, syllabus and images | Historical Admin builds and rollback-only role/content checks | Latest standalone Admin deployment not established |

## Release constraints

- Rotate exposed admin password/revoke sessions and confirm legacy elevated-key retirement; no completion evidence. Existing custom Express sessions after password change need separate revocation work.
- A public PDF/video URL is not protected by course-table RLS. Do not describe paid media delivery as private.
- Deletion is a manual request channel, not an implemented deletion API/job. Terms wording does not establish operational/legal compliance.
- Payment Enabled appeared checked for two batches in the September 6 inspection despite disabled migration defaults. Do not assume either setting today.
- Refund/dispute entitlement policy, real payment tests, release monitoring and support operations remain. GET /api/admin/payments exists; a complete reconciliation UI is not established.

## Sources

[Server](../server.ts), [payment service](../server/payments.ts), [payment router](../server/payment-routes.ts), [migrations](../supabase/migrations), [payments runbook](../docs/payments.md), [recovery runbook](../docs/password-recovery.md), [deletion runbook](../docs/account-deletion.md), [historical memory](archive/root-memory-2026-11-09.md).

The November 9 Android preview succeeded; this does not prove a newer web deployment. Build warnings previously included a large frontend bundle.

## Test Series synchronization — 2026-11-12

**Implemented:** Shared Test Series catalog uses existing batches, tags, enrollments and verified payments. Added catalog visibility, authenticated owned-catalog reads and server/database enforcement for removal from sale.

**Tested / database applied:** November 12: Web TypeScript/build and 19 payment tests passed; Admin build and 6 tests passed; Android TypeScript, 39 tests and direct Metro export passed. Supabase migrations and rollback-only authorization/visibility/payment tests passed. No new hosted application deployment, native APK or physical-device test.

**Remaining:** Deploy the updated backend/web and Admin, then build/install Android and verify a real admin edit appears on both clients. Existing deployed applications do not automatically acquire these new screens. No customer content was created/published during verification. Test Series remain catalogs with learning content, not an interactive exam/scoring engine. Physical-book work is deferred.

## Supabase security observation — 2026-11-12

Post-migration security advisors reported the existing authenticated SECURITY DEFINER access helpers (`is_admin`, `has_active_batch_access`), disabled leaked-password protection and limited MFA configuration. The helpers intentionally support identity-bound access/RLS checks and were not replaced by this task; existing Auth hardening remains outstanding. References: [RPC privilege review](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [MFA](https://supabase.com/docs/guides/auth/auth-mfa). These findings mean this feature is not a claim that every platform security issue is resolved.

## Razorpay completion — 2026-11-12

Implemented locally: retained the existing authenticated `/api/payments/create-order`, `/api/payments/verify` and owner-scoped status endpoints, Standard Web Checkout and direct-APK native checkout. Added the official backend `razorpay` SDK 2.9.8, minimum 100 paise validation on server/web/Android, sanitized provider failures, stale browser-account response rejection, and canonical provider IDs in the embedded Admin ledger. The standalone Admin now has a paginated, status/mode-filtered Payments view, refreshing every 30 seconds while visible and on focus/manual refresh. It reads the same Supabase purchase records, not a second database.

Tested November 12: Web TypeScript, 19 payment/client tests (including the new minimum and account-change checks), 7 recovery tests, Web/backend build; Admin TypeScript/build and 6 existing tests; Android TypeScript and 39 existing tests. Read-only Razorpay order-list authentication succeeded with the supplied test credentials. Live Supabase payment columns and SELECT policies were inspected; no schema changes or payment creation were performed. Existing Admin tests do not cover the new ledger UI end to end.

Configured locally: backend credentials in the already ignored Web `.env`; existing webhook-secret setting preserved. No credential values copied into documentation or clients. This does not configure the deployed server. No deployment, new APK, browser/native checkout completion, payment charge or webhook delivery test occurred. npm installation reported 10 dependency advisories (3 moderate, 6 high, 1 critical); dependency triage remains required before release. The Web build retains its large-chunk warning.
