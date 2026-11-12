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

## Test Series website UI — 2026-11-12

Implemented: extracted the catalog presentation into `src/components/TestSeriesCatalog.tsx`, retaining existing filtering, visibility and enrollment/purchase callbacks. Added centered responsive spacing, purple selected filters with keyboard focus, disabled/spinning refresh, initial skeletons, retained cards during background refresh, one error/retry panel, and helpful empty states with a reset action. No API, payment, database, Android or Admin changes.

Validated locally: `npm run lint` and `npm run build` passed (existing large-bundle warning remains). Headless Edge with intercepted local API fixtures checked empty/populated layouts at 1440, 768 and 375 pixels with no horizontal overflow; screenshots reviewed for desktop/tablet empty and mobile populated layouts. Filters/reset, keyboard Enter/Tab, hidden-series exclusion, initial skeletons, disabled refresh, retained cards on refresh/failure, single error/Retry and signed-out free-enrollment login handoff passed. Fixtures were browser-only; no Supabase content was created. Existing purchase/learning callbacks were retained, but authenticated enrollment, actual checkout and learning E2E were not repeated.

Deployment: not performed. Hosted visual verification remains pending after deployment.

## Google Drive lecture notes — 2026-11-12

Implemented locally: consistent HTTPS notes-link validation across all three clients; standard Drive file links preserve file IDs and access parameters, folder/malformed links and embedded credentials are rejected. Admin retains URL/upload inputs, adds inline guidance/errors and Open link preview, blocks invalid saves and recognizes the snake-case PDF indicator. Website PDF Notes opens safely in a new tab; Drive does not use an iframe/download attribute, while direct .pdf URLs retain the reader. Android shows PDF Notes with the optional title separately and checks batch access before opening through Linking, reporting open/access errors.

Validation: Web TypeScript/build and Admin TypeScript/build passed; Admin's 6 existing tests passed; Android TypeScript and 44 tests passed, including 5 new tests for links, parameter preservation, cross-client consistency and access-before-opening/failure behavior. Headless Edge with intercepted local fixtures verified Admin edit/load, validation/preview/save/reload/PDF badge and Web Drive new-tab attributes/no iframe plus direct-PDF reader compatibility. Browser HMR websocket warnings did not block fixture checks. Live Supabase metadata confirmed the existing text notes_url/notes_title fields; no migration or content mutation. Add-new-lecture against live Supabase, actual Drive file permissions, physical-device opening and updated APK remain unverified. No deployment or real-file external opening was performed.

Limits: valid URL syntax cannot prove the target is a PDF or viewable by a student. Public Drive links can be redistributed; app enrollment checks do not secure the externally hosted file. No Drive permission changes, file copying, new tables or API contracts. Existing payment/access behavior retained. Web build still reports its pre-existing large-bundle warning.
