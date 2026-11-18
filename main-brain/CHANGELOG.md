# Changelog — Web app and shared backend

Historical entries below are consolidated summaries, not newly executed work. Full sanitized records are in [archive](archive/README.md). Append future entries with change, rationale, validation, deployment outcome and remaining work.

## Undated historical work

Learning platform, CMS/faculty, FAQ visibility, uploads, batch field mapping, drill-down and video embed fixes recorded; old auth/JSON descriptions later superseded.

## 2026-09-04–05

Durable state, Storage, environment isolation, auth functions, course access and payment schema migrations; builds/SQL smoke evidence recorded.

## 2026-09-06

Real payment backend and Web/Admin checkout integrated; 18 tests and Render deployment/smoke checks recorded. No actual purchase.

## 2026-09-07

Hosted Test webhook secret/events configured and unsigned requests rejected; provider payment delivery unverified.

## 2026-09-08–11

Overview JSONB, admin image guards and auth hardening recorded; standalone Admin release pending.

## 2026-10-27

Recovery repaired, deployed code confirmed, hosted redirect corrected; 7 tests and expired-link UI verified. Privacy page implemented locally.

## 2026-11-01

Deletion request page and updated privacy disclosures; store artwork generated. Publication/fulfilment not verified.

## 2026-11-05

Terms page/routes/cross-links and local production checks completed; publication/review pending.

## 2026-11-09

Carrier50 preview build completed in Mobile. Main Brain consolidated documentation and redacted historical credentials; application/runtime unchanged by consolidation.

## 2026-11-09 — Documentation validation

Confirmed all 24 required Main Brain documents across three apps. Checked 51 Markdown files for local link targets: no broken links. Credential-pattern scan found no matches for known historical seeded passwords, JWTs, long Supabase key values, recovery-token values or private-key headers. Historical credentials were redacted before archiving; this does not rotate credentials or sanitize Git history. Commands and dependency ranges were read from local manifests; application tests were not rerun for this documentation-only change. No application code, database, credentials or deployment settings changed.

## 2026-11-12 — Test Series catalog synchronization

Shared Test Series catalog uses existing batches, tags, enrollments and verified payments. Added catalog visibility, authenticated owned-catalog reads and server/database enforcement for removal from sale.

Removal uses `catalog_visible=false`, retaining `is_active`, enrolled access, content and payments. Existing series markers are recognized without copying rows; canonical Test Series tags preserve other tags. Paid/free access type and active status cannot be changed after enrollment/payment records exist; this avoids invalidating previous purchases. Pending verified payments can still finalize after withdrawal.

November 12: Web TypeScript/build and 19 payment tests passed; Admin build and 6 tests passed; Android TypeScript, 39 tests and direct Metro export passed. Supabase migrations and rollback-only authorization/visibility/payment tests passed. No new hosted application deployment, native APK or physical-device test.

Applied migrations: `20261112050742_test_series_catalog_visibility`, `20261112050911_scope_batch_admin_read_policy`, `20261112051122_server_owned_enrollment_creation`. Local filenames were aligned with the recorded remote migration versions after CLI creation and MCP application. Direct enrollment inserts are denied; supported clients continue through the authenticated Express free-enrollment endpoint and server-only paid finalizer.

Validation found and corrected an existing anonymous catalog policy calling a non-anonymous admin function. Admin upload regression assertion was updated for the stronger synchronous save guard. Existing Web bundle-size warning remains. No credentials changed, no real charges initiated, no users deleted and no test fixtures retained.

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

## Embedded website Admin removed — 2026-11-12

Implemented: removed AdminDashboard component/import/view, desktop/mobile Admin Console navigation, automatic admin-role redirects, legacy /admin/admin-hash detection, Admin-specific auth presentation and Admin quick-login option. All signed-in roles use the learning Dashboard; homepage and player-back navigation use that same destination. Old Admin paths show the ordinary site. Ordinary student quick-access behavior is unchanged; no replacement Admin link was added.

Validation: Web TypeScript, production build and 7 recovery tests passed. Production bundle scan confirms embedded console/Admin quick-login markers absent. Task-start hashes confirm backend server/modules and standalone Admin source unchanged. Local headless Edge fixture checks cover signed-out/student/admin desktop (1440px) and mobile (375px) navigation and old /admin/#admin entry paths; authenticated fixtures exercise Dashboard and Profile. Login/player-back destinations were inspected in source; real authentication and course enrollment were not performed. Existing large-bundle warning remains.

No backend API, authorization, RLS, payment, database, account-role or standalone Admin changes. No deployment performed; the hosted website may retain its old console until the Web service is redeployed. Earlier embedded-Admin implementation notes are historical and superseded by this removal.

## Email confirmation/reset routing correction — 2026-11-13

Fixed the parser that classified every Supabase callback error as password recovery. Only an explicit recovery type or reset-password path enters recovery; explicit non-recovery types take precedence. Untyped errors at the Site URL show neutral email-link guidance, not a reset form. Signup callbacks show a sign-in notice without claiming verified status; callback tokens/errors are removed from the address bar and are not auto-consumed into a session. Password recovery retains its token-pair/user validation.

Added rate-limited POST /api/auth/resend-confirmation accepting only an email for the signup resend operation, with generic success and sanitized failure feedback. Login exposes Resend confirmation email. Signup and resend explicitly request the validated APP_URL root as email redirect; password recovery still targets /reset-password. No password, email confirmation status or user role is changed by the UI callback itself.

Verified: Web TypeScript, 8 recovery tests and production build passed. Headless Edge local fixtures verified generic/expired email errors and signup callbacks do not show Reset your password, callback URL scrubbing, resend email validation/request payload, and genuine recovery error UI. No email was sent, no real confirmation/reset token consumed, no database changes and no deployment performed. Existing bundle-size warning remains. Actual newest-email confirmation and subsequent login remain pending after deployment.

## Session privacy — 2026-11-13

Web now uses verified Supabase sessions instead of custom tokens. Private UI is remounted on session transitions; generation guards reject delayed API responses after logout/account switch. Dashboard failures show Retry rather than fabricated zero metrics. Reviewer quick-login is removed.

Rationale: never restore a prior user from cached identity, late responses or a failed offline logout. Failed re-login retains the logout lock. Web TypeScript and production build passed (existing large-bundle advisory); 5 session, 19 payment and 8 recovery tests passed. Local Edge fixtures passed login/reload, cross-tab logout, delayed-response logout, account switch, offline logout/reload and dashboard failure handling.

No deployment, Supabase configuration/schema/data change, or new APK was performed. Deploy Web/backend together, deploy Admin and rebuild Android separately. Existing custom-token website sessions must sign in again. Physical-device and real-account production checks remain pending.

## Razorpay provider authentication — 2026-11-13

Implemented: upstream Razorpay credential rejection returns HTTP 502 with PAYMENT_PROVIDER_AUTH_FAILED and a sanitized payment-unavailable message. Genuine user-authentication errors remain 401; provider failure no longer triggers Web logout. Added a read-only backend credential/receipt diagnostic with default Test mode and an explicit --live option. No orders or charges are created by this diagnostic.

Validation: Web TypeScript and production build passed (existing large-bundle warning); 21 payment tests, 6 session tests and 8 recovery tests passed. Coverage includes SDK credential rejection, corrected mocked credentials, HTTP error code, preserved customer session, genuine expired sessions and existing duplicate/ambiguous-order reconciliation. Initial failing SDK mock was corrected to an injected SDK factory; final suite passes without network calls.

Deployment evidence: payment fix a74bcd153ea93d63a4b342df9f4225acccb3b81b deployed successfully on Render (dep-dbrfpviaujis73cslocg). Its read-only Test authentication passed and found zero provider orders for the inspected pending Test receipt. A subsequent user environment update supplied Live keys and failed the Test-only diagnostic (dep-dbrg25s9v7es73cg2uag), leaving the prior release live. User then explicitly authorized Live deployment with read-only verification and no charge. Revision f9ce121 adds the explicit Live diagnostic; final rollout result follows below.

Data: one pending Test Batch purchase for INR 50 was inspected read-only; no provider order/payment/verification was stored. No user, payment, enrollment or Supabase settings were modified. Do not reuse the Test intent under Live keys or delete it blindly. Separate reviewed retirement/reconciliation is required for this user's next purchase of the same batch.

Remaining: verify matching Live webhook endpoint/secret and payment.captured, order.paid, payment.failed delivery, automatic capture, account readiness and actual end-to-end checkout/access/Admin reconciliation. No real charge or native APK test occurred. Local ignored .env still has the old failing Test credentials; update it only if local payment development is needed. Never copy secrets into clients or documentation.

Live rollout verified November 13 at 22:42 IST: f9ce12123c4c9643e19efd243fc1fb819bc2c3f4 deployed successfully as dep-dbrk9js9v7es73cr9ad0. Render build diagnostic reported read-only Live authentication PASSED; no order/payment was created. Hosted /health and /api/batches returned 200, unauthenticated /api/auth/me returned 401 with no-store. These checks do not certify checkout/webhook/capture or settlement readiness.

Final release: normal Render build command restored to npm ci --include=dev && npm run lint && npm run test:payments && npm run build. Follow-up deployment dep-dbrkadetlv9c738p7kng of f9ce121 succeeded November 13 at 22:44 IST. The one-time provider check is not a permanent deployment dependency. Web/backend are live; Live webhook delivery and actual checkout remain unverified.

## Privacy notice rewrite — 2026-11-14

Implemented the owner-approved screenshot-based rewrite: Carrier-50 Institute / Carrier50 / C50 Academy, legal owner Sunil Rajput, supplied Gwalior address and support email, dated November 14. Added summary, linked contents and twelve accessible sections. Omitted incomplete Cookie Notice references and unsupported push/advertising/device-identifier claims; retained actual provider, learning, payment and storage disclosures. Termly attribution identifies draft provenance only.

Policy decision: adults aged 18 or older; Terms now agrees. No age gate or automated age verification was added. Retention remains 30 days after ownership verification for deletion requests, with legal/dispute exceptions; clarified that the payment-record period applies to deletion requests, not all purchases after payment. Existing deletion page and operational process were not changed.

Validation: 7 privacy/deletion tests passed (including two new Web policy regressions), Web TypeScript and production build passed. Existing large-bundle advisory remains. In-app browser inspected 1280px desktop and 375px mobile layouts, no horizontal overflow; section targets and Enter-key navigation/focus passed. Publication revision 455c87c; live verification is recorded below when complete. No API, Supabase, payment configuration, Android behavior or user-record changes.

Published November 14: revision 455c87c000aa6710d2929a71caf127934a912c1f, Render deployment dep-dbs04b5bedkc73bkfpp0 reported Deploy succeeded | Live. Unauthenticated HTTPS GETs to /privacy, /privacy/ and /terms all returned 200 and matched the reviewed local HTML exactly (line-ending normalized). Live page visually checked; all five external provider/provenance links returned 200. No application behavior or database changes.


## Homepage app promotion — 2026-11-14

Replaced hardcoded app promotion with Supabase-backed Admin settings and removed the nonfunctional email form. Added additive migration and database validation; explicit administrator write policy. Fixed partial API saves and failed-load protection. Web TypeScript/build, Admin lint/build, 11 Web homepage/session tests, 21 payment tests and 1 Admin test passed. Admin lint retains unrelated warnings; Web retains large-bundle warning. Database transaction checked anonymous/non-admin denial, admin save/reload, unsafe URL rejection and preservation of unrelated fields, then rolled back. Local fixture UI verified desktop/375px promotion, keyboard link focus, safe new-tab attributes, hidden states and editor inline validation; fixtures removed. No sample content published. Security advisor reports existing access-helper/password-protection warnings, none on the new invoker function. Initial release-checkout tests could not run without installed dependencies; validation used the app workspace with installed lockfile dependencies. Deployment evidence is recorded below.


### Hosted release evidence — 2026-11-14

Verified live November 14, 2026: Web revision cc5e8d4991e7065d2c1338f38f5c562361f7057c (feature commit fd824c4e821ec4ccaabec9923f813a4d220953b5), Render deploy dep-dbsabanf3r2c73e6i3ng; Admin revision 27aee7ed18845a86845d776362ba4bb54ef1b608, Netlify deploy 6af8a55f2655a2dd680a6336. Supabase migration version 20261114071849 is applied and matches the local migration filename. Public /health and /api/homepage returned 200; homepage GET has no-store and safe Coming Soon defaults, and unauthenticated PUT returned 401. Hosted Admin displayed the new controls, saved unchanged settings successfully and reloaded them; the database content fingerprint excluding updated_at was unchanged. Public page inspection confirmed promotion content and no subscription form. Real store listing URLs remain unset; no sample links or content were published. No Android change/build required.

## Google Play Billing rollout — 2026-11-15

Implemented locally: Android native Play checkout/restore with store prices; backend account-bound Google verification and post-commit acknowledgement; shared cross-provider access; Admin immutable product mapping and provider-labelled ledger; Web ledger provider display. Razorpay remains the website/direct-APK provider.

Applied: Supabase migrations 20261115062543 and 20261115062749. Google tokens/account bindings are server-only; current two paid-batch mappings remain disabled. Tested: Web TypeScript/build, 21 payment + 6 session regressions, 2 Google/isolated SQL tests; Admin lint (existing warnings) and build; Android TypeScript + 44 tests.

Not complete: Google Cloud/Play credentials, RTDN/scheduler configuration, product activation, verified AAB upload/Internal release, physical-device acceptance, Google financial totals/refund catch-up and production release. EAS build cda43959-bd39-4a2b-abf2-88fc12678c27 (version code 5) finished successfully and was uploaded to a saved Internal testing draft; not released to testers or production. No real charge or production Play release. See [shared runbook](../../C50-Project/docs/google-play-billing.md).

## Google Play configuration progress — 2026-11-16

Render environment-update deployment dep-dbt9l7c9v7es73a055ng succeeded at revision 361815c557478fcc9b0c6e5b399ac796783f35dc. The GOOGLE_APPLICATION_CREDENTIALS variable and google-play-verifier.json secret filename are present; credential contents were not displayed. Google API authentication remains to be checked from the server.

After explicit approval, the verifier service account is Active in Play Console with Carrier50-only read, financial and order-management permissions (no Admin/release grants). Cloud Pub/Sub API is enabled and the c50-play-purchases topic exists. Both batch products are saved as India-only Buy drafts, Test 1 INR 2499 and Test Batch INR 50; Google bulk price rounding was corrected before saving. Notification subscription, publisher grant, RTDN configuration and scheduled reconciliation are not yet complete. Product mappings and checkout remain disabled.

User changed the release target to production on November 16. This supersedes the earlier Internal-only release authorization; it does not establish production readiness or a completed submission. No real charge has been made. Supplied financial-account details are not stored in project documentation.

Local validation today: Web TypeScript/build, 21 payment tests, 6 session tests and 3 Google/SQL tests passed. Admin lint/build passed with existing lint warnings. Financial-total changes are local and not deployed yet. The local migration file for already-applied 20261115144004 has been restored and tested in isolated PGlite. Physical-device purchase/restore/refund acceptance remains outstanding.

## Google Play rollout checkpoint — 2026-11-16 17:10 IST

Supersedes earlier November 15/16 setup-pending observations. Production is the user-authorized target. Version 5 is saved as a production draft, not submitted or live; physical-device payment/restore acceptance is outstanding. Both India-only Buy products remain drafts and checkout/mappings remain disabled.

The dedicated verifier has Carrier50-only read, financial and order-management permissions. Render revision d61a1bf86d970fced916d2c94ae8cd308cbac2a5 is deployed (dep-dbtelij2o0lc73ejn3l0). Its read-only Google purchase API authentication PASSED at 17:07 IST, resolving the earlier 401 permissionDenied observation without broadening access. No purchase or charge was created. Financial-total code is deployed in Web; Admin commit 4975f8d was pushed, but its exact hosted revision is not yet established.

Pub/Sub topic, authenticated push subscription, topic-only Google publisher grant and Play RTDN settings are configured. Full test-notification delivery confirmation remains to be recorded. Scheduled reconciliation is enabled every ten minutes. A manual invocation reached the deployed backend with HTTP 200 on an empty Google purchase ledger; this verifies transport/authentication, not real-purchase processing.

Migrations 20261116112806, 20261116112940 and 20261116113506 are applied. Managed pg_net grants could not be restricted by postgres; the final transport uses synchronous http directly, never placing the Vault credential in the net queue. The unused queue log contains zero requests. Private run logs retain only time/status; client roles cannot invoke the Vault validator or access the private schema. Do not revert to the older queued transport.

Validation rerun: Web TypeScript/build passed (existing large-bundle warning); 31 focused tests passed: 4 Google/SQL/reconciliation, 21 payment and 6 session/mobile-session tests. No Android rebuild or device acceptance was performed in this continuation. Security advisor reports expected private-table no-policy notices plus existing access-helper and leaked-password-protection warnings; no claim of a clean full security audit.

Remaining: notification delivery proof, product option review/activation, controlled device acceptance, exact Admin hosted verification and production submission. Partial-refund reporting, stale financial snapshots and voided-purchase catch-up remain operational follow-ups.


### Later November 16 verification

Google RTDN test reception was confirmed in Render with the sanitized authenticated-test acceptance log. Reconciliation now has 40 HTTP-200 runs, all while the Google purchase ledger is empty. Both India-only Buy options are active at INR 50 and INR 2499 with multi-quantity disabled. Version 5 is saved in Publishing overview for production: no blocking validation errors, one missing-deobfuscation-file warning; not submitted yet. Hosted Admin bundle index-DA-FEKlX.js contains the Google total/currency fields and mapping editor, though exact Netlify deployment revision has not been checked.

Added a tester-only exception to the disabled checkout gate, using authenticated user IDs already configured in GOOGLE_PLAY_TESTER_USER_IDS. This allows controlled acceptance without exposing checkout to other users. Five Google tests and fresh TypeScript/build passed; prior 31-test suite results remain separately dated. User supplied a confirmed student account for acceptance. License-test setup and physical-device purchase/restore checks are in progress.


## Premium Notes and expandable Study Spaces — 2026-11-18

Implemented: individual/bundle catalog, external Buy/form workflow, per-account Pending/Purchased/Rejected states, manual Admin review with decision history and separate delivery status. Android Study Spaces now has Show more/Show less instead of horizontal scrolling. The external Buy button is included in the Play/AAB variant by explicit user request; no Play-program eligibility or publication approval is claimed. Existing batch payments are unchanged.

Tested: Web/Android TypeScript; Web/Admin production builds; Admin lint (pre-existing unrelated warnings); 36 backend payment/session/Google/notes tests and 44 Android tests. The follow-up audit-grant fix also passed the 25-test payment/notes and six-test session suites. Browser fixtures verified 1440/768/360 layouts, external opener isolation, Pending/reopen, Admin approval/customer refresh, editing/save/reload, empty/error/retry and failed-load save lock. No live purchase or form submission was made.

Supabase: both additive migrations applied; local filenames reconciled with hosted migration versions 20261118082723 and 20261118125532. Three protected tables, no public/client direct access or RPC execution; service-role audit UPDATE/DELETE revoked and INSERT retained. Products and requests remain empty.

Built: production AAB versionCode 6, EAS build a4a12973-bace-483d-8fee-ab6d354bb2c6 (FINISHED). Local artifact: c50-mobile/dist/Carrier50-v6-premium-notes.aab. Archive inspection confirmed Premium Notes, Pending status and expected public Supabase URL/key. EAS production public variable names EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY were explicitly configured for reproducible future builds; values are not recorded here. AAB build success is not device verification or Play publication.

Release checkpoint: Web/backend revision 266a6cc54a28ff8616fcc9d0c4277a4c1d9cdcbb pushed and hosted rollout observed: asset index-DE48gmpx.js contains Premium Notes; anonymous catalog returns HTTP 200 with an empty array and no-store; own-request and both Admin read routes return HTTP 401 without login. Render dashboard deployment ID was not inspected. Admin revision 356662ac10bd9a749fae687fecb9f2809f0c0a88 pushed; hosted asset index-BwDqKVye.js contains Premium Notes controls. Signed-in hosted Admin save/reload is not claimed. Actual product/form configuration, physical-device acceptance, external seller/payment matching and Play publication remain outstanding.

[Premium Notes runbook](../docs/premium-notes.md)
