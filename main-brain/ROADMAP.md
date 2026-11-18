# Roadmap — Shared platform

<<<<<<< HEAD
## Premium Notes and expandable Study Spaces — 2026-11-18

Implemented: individual/bundle catalog, external Buy/form workflow, per-account Pending/Purchased/Rejected states, manual Admin review with decision history and separate delivery status. Android Study Spaces now has Show more/Show less instead of horizontal scrolling. The external Buy button is included in the Play/AAB variant by explicit user request; no Play-program eligibility or publication approval is claimed. Existing batch payments are unchanged.

Tested: Web/Android TypeScript; Web/Admin production builds; Admin lint (pre-existing unrelated warnings); 36 backend payment/session/Google/notes tests and 44 Android tests. The follow-up audit-grant fix also passed the 25-test payment/notes and six-test session suites. Browser fixtures verified 1440/768/360 layouts, external opener isolation, Pending/reopen, Admin approval/customer refresh, editing/save/reload, empty/error/retry and failed-load save lock. No live purchase or form submission was made.

Supabase: both additive migrations applied; local filenames reconciled with hosted migration versions 20261118082723 and 20261118125532. Three protected tables, no public/client direct access or RPC execution; service-role audit UPDATE/DELETE revoked and INSERT retained. Products and requests remain empty.

Built: production AAB versionCode 6, EAS build a4a12973-bace-483d-8fee-ab6d354bb2c6 (FINISHED). Local artifact: c50-mobile/dist/Carrier50-v6-premium-notes.aab. Archive inspection confirmed Premium Notes, Pending status and expected public Supabase URL/key. EAS production public variable names EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY were explicitly configured for reproducible future builds; values are not recorded here. AAB build success is not device verification or Play publication.

Release checkpoint: Web/backend revision 266a6cc54a28ff8616fcc9d0c4277a4c1d9cdcbb pushed and hosted rollout observed: asset index-DE48gmpx.js contains Premium Notes; anonymous catalog returns HTTP 200 with an empty array and no-store; own-request and both Admin read routes return HTTP 401 without login. Render dashboard deployment ID was not inspected. Admin revision 356662ac10bd9a749fae687fecb9f2809f0c0a88 pushed; hosted asset index-BwDqKVye.js contains Premium Notes controls. Signed-in hosted Admin save/reload is not claimed. Actual product/form configuration, physical-device acceptance, external seller/payment matching and Play publication remain outstanding.

[Premium Notes runbook](../docs/premium-notes.md)


=======
>>>>>>> 78d9680eb377fe63a96032332f24a6a1ff719be9
## Google Play Billing rollout — 2026-11-15

Implemented locally: Android native Play checkout/restore with store prices; backend account-bound Google verification and post-commit acknowledgement; shared cross-provider access; Admin immutable product mapping and provider-labelled ledger; Web ledger provider display. Razorpay remains the website/direct-APK provider.

Applied: Supabase migrations 20261115062543 and 20261115062749. Google tokens/account bindings are server-only; current two paid-batch mappings remain disabled. Tested: Web TypeScript/build, 21 payment + 6 session regressions, 2 Google/isolated SQL tests; Admin lint (existing warnings) and build; Android TypeScript + 44 tests.

Not complete: Google Cloud/Play credentials, RTDN/scheduler configuration, product activation, verified AAB upload/Internal release, physical-device acceptance, Google financial totals/refund catch-up and production release. EAS build cda43959-bd39-4a2b-abf2-88fc12678c27 (version code 5) finished successfully and was uploaded to a saved Internal testing draft; not released to testers or production. No real charge or production Play release. See [shared runbook](../../C50-Project/docs/google-play-billing.md).


Last consolidated: 2026-11-09. Local source/configuration reviewed; historical test and hosted observations are dated below. This documentation pass did not rerun application tests or inspect live services.

| Priority | Remaining work | Completion evidence required |
| --- | --- | --- |
| P0 | Exposed admin credentials/sessions and legacy elevated-key retirement | Dated rotation/revocation/retirement verification without recording values |
| P0 | Deploy retirement of custom Express sessions | Local rejection and regression coverage complete November 13; verify hosted old-session rejection and fresh Supabase login |
| P0 before paid content | Private notes and protected video delivery | Unentitled users cannot retrieve paid assets; authorized expiring retrieval works |
| P0 before paid launch | Real Test-mode checkout and signed provider delivery | Success, failure, cancellation, delayed/duplicate events, repair, wrong-user/batch denial verified |
| P1 | Latest policy pages deployed and reviewed | Public HTTPS page content verified; owner practices match disclosures |
| P1 | Account deletion fulfilment | Reviewed operation tested on controlled account, with retention/session handling and confirmation |
| P1 | Fresh-email recovery | Template checked; fresh reset and login succeed; expired links safe |
| P1 | Refund/dispute and payment support | Approved operational policy, explicit entitlement handling, monitored reconciliation; evaluate existing admin ledger UI |
| P1 | Full production user journeys | Auth, CMS/uploads, free/paid access, progress/history/streaks and denial evidence |
| P2 | Operations and scalability | Monitoring/log review; shared limiter if multiple instances; confirm custom-domain need |
| P2 | Dependency/bundle and security review | Address measured warnings; rerun applicable security advisors; verify tier-dependent options before changes |

The September 7 webhook setup and October 27 recovery redirect correction are completed historical configuration work, not outstanding implementation. Actual payment/recovery E2E remains open. Admin deployment and Android release are tracked in their own brains. Do not silently enable batches or change keys as part of documentation work.

## Test Series acceptance — 2026-11-12

- Implemented and locally verified: dedicated management, free/paid catalog display, refreshed shared records, removal preserving student access and transaction history.
- Supabase applied and tested: visibility/validation/write guards and role policies; test transactions rolled back.
- Pending release: updated web/backend and standalone Admin deployment, new Android APK, device/browser admin-create/edit/publish/remove journeys and actual Razorpay/provider E2E. Interactive tests/timers/results are outside this catalog task.

## Razorpay acceptance update — 2026-11-12

- Implemented locally: existing Standard Checkout completed with minimum 100 paise, shared payment persistence and standalone Admin payment ledger; no duplicate checkout subsystem.
- Checks passed as recorded in CURRENT-STATE. No new hosted deployment or Android build.
- Remaining: deploy backend/Web and Admin, configure matching server-only Razorpay credentials and webhook secret, confirm automatic capture and webhook delivery, rebuild direct APK and verify success/cancellation/failure/restart/account-switch end to end. Confirm exactly one purchase/enrollment after repeated callback/webhook, cross-client access and Admin pagination/filter behavior. Keep test and live records distinguishable. Complete dependency-advisory triage before rollout.

## Test Series UI acceptance — 2026-11-12

Completed locally: responsive catalog styling and empty/loading/error states; TypeScript/build and local browser fixture checks passed (details in CURRENT-STATE). Pending: deploy Web and confirm the same layout and real published-series content on the hosted site. This UI change does not resolve outstanding payment/device release verification.

## Drive notes acceptance — 2026-11-12

Local implementation/builds, link-contract tests and browser fixture edit/save/reload/open-link checks complete. Pending: deploy Web/Admin, rebuild Android, verify a real per-lecture PDF with student Drive permissions and device handler, and exercise live authorized Admin add/save/reload. No database migration required. Public-link redistribution remains outside enrollment protection.

## Embedded Admin retirement — 2026-11-12

Completed locally: embedded management UI and entry points removed; TypeScript/build/recovery tests and local role/navigation fixtures verified. Pending: Web deployment and hosted desktop/mobile confirmation. Standalone Admin access and backend authorization remain independent and unchanged.

## Confirmation callback distinction — 2026-11-13

Email confirmation and password recovery now have separate UI handling; untyped Site URL errors are neutral, and only recovery context opens the reset form. POST /api/auth/resend-confirmation is rate-limited, validates email and invokes Supabase signup resend with the validated APP_URL root redirect. It never resets a password or bypasses confirmation. Local checks passed as recorded in CURRENT-STATE; deployment and a real fresh-email/login round trip remain pending. Supabase Site URL should be the website root and Redirect URLs must allow that root and /reset-password; retain default confirmation verification links rather than linking straight to the application. Configuration/template values were not changed or live-verified in this task. Use the newest confirmation email; use Forgot Password only for recovery.

## Session privacy — 2026-11-13

Implemented: Web now uses verified Supabase sessions instead of custom tokens. Private UI is remounted on session transitions; generation guards reject delayed API responses after logout/account switch. Dashboard failures show Retry rather than fabricated zero metrics. Reviewer quick-login is removed.

Local evidence: Web TypeScript and production build passed (existing large-bundle advisory); 5 session, 19 payment and 8 recovery tests passed. Local Edge fixtures passed login/reload, cross-tab logout, delayed-response logout, account switch, offline logout/reload and dashboard failure handling.

Pending acceptance: coordinated release, real confirmed-account login/recovery, offline logout/restart, account-switch and Android device checks. Supabase working confirmation/catalog settings were left unchanged; user reported these working before this change.

## Provider failure acceptance — 2026-11-13

Code/tests complete: 502 provider-error contract, preserved login, read-only credential diagnostic, 21 payment/6 session/8 recovery tests and Web build/type checks. Payment fix deployed at a74bcd1; Test credential check passed. User subsequently requested Live deployment after saving Live keys; verify final release outcome in CURRENT-STATE. Remaining: Live webhook/capture/account checks, actual controlled payment/access E2E, and reviewed handling of the pre-existing pending Test attempt. No database mutations authorized by this diagnostic.

Live rollout verified November 13 at 22:42 IST: f9ce12123c4c9643e19efd243fc1fb819bc2c3f4 deployed successfully as dep-dbrk9js9v7es73cr9ad0. Render build diagnostic reported read-only Live authentication PASSED; no order/payment was created. Hosted /health and /api/batches returned 200, unauthenticated /api/auth/me returned 401 with no-store. These checks do not certify checkout/webhook/capture or settlement readiness.

Final release: normal Render build command restored to npm ci --include=dev && npm run lint && npm run test:payments && npm run build. Follow-up deployment dep-dbrkadetlv9c738p7kng of f9ce121 succeeded November 13 at 22:44 IST. The one-time provider check is not a permanent deployment dependency. Web/backend are live; Live webhook delivery and actual checkout remain unverified.

## Privacy policy acceptance — 2026-11-14

Screenshot-based rewrite, complete contact identity, consistent adult eligibility/retention, responsive public page and local validation complete. Revision 455c87c contains only policy, minimal Terms alignment and focused tests. See CURRENT-STATE for hosted verification. Operational deletion fulfilment and age-policy handling remain owner responsibilities; this content change implements no automation.

Published November 14: revision 455c87c000aa6710d2929a71caf127934a912c1f, Render deployment dep-dbs04b5bedkc73bkfpp0 reported Deploy succeeded | Live. Unauthenticated HTTPS GETs to /privacy, /privacy/ and /terms all returned 200 and matched the reviewed local HTML exactly (line-ending normalized). Live page visually checked; all five external provider/provenance links returned 200. No application behavior or database changes.


## Homepage app promotion — 2026-11-14

Completed locally: app promotion editing/rendering, store validation, section hiding, load-failure save protection and hidden subscription form. Supabase migration and rollback-only authorization/save/reload checks passed. Local builds, 11 Web homepage/session tests, 21 payment tests and 1 Admin promotion test passed. Completed hosted: Web/Admin release and authenticated Admin unchanged-save/reload. Remaining: actual store URLs when available. No Android build required.


### Hosted release evidence — 2026-11-14

Verified live November 14, 2026: Web revision cc5e8d4991e7065d2c1338f38f5c562361f7057c (feature commit fd824c4e821ec4ccaabec9923f813a4d220953b5), Render deploy dep-dbsabanf3r2c73e6i3ng; Admin revision 27aee7ed18845a86845d776362ba4bb54ef1b608, Netlify deploy 6af8a55f2655a2dd680a6336. Supabase migration version 20261114071849 is applied and matches the local migration filename. Public /health and /api/homepage returned 200; homepage GET has no-store and safe Coming Soon defaults, and unauthenticated PUT returned 401. Hosted Admin displayed the new controls, saved unchanged settings successfully and reloaded them; the database content fingerprint excluding updated_at was unchanged. Public page inspection confirmed promotion content and no subscription form. Real store listing URLs remain unset; no sample links or content were published. No Android change/build required.

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


<<<<<<< HEAD
### Device acceptance handoff — 2026-11-16

Web/backend revision 1469d2b075a538060591f6d265752bb9f5610cfe is Live on Render, deployment dep-dbtke34i67rs7391pghg, with the tester identifier configured. Public GOOGLE_PLAY_BILLING_ENABLED was verified false; only the selected confirmed student account bypasses the rollout gate. Both exact batch/product mappings are enabled. Google Console saved the dedicated license-test list and added it to the existing active Internal v5 track. This is a no-charge acceptance step, not a change of the production release target. Install through https://play.google.com/apps/internaltest/4701625687672221084 using the configured Google account, then sign into the configured C50 student account. Use only the Google test payment method; do not make a real charge.

Production version 5 is saved in Publishing overview, awaiting submission. Submission and global checkout activation remain outstanding until device purchase/restore and website/Admin access evidence is recorded. No new Android build, real purchase, payout change or manual enrollment was made. Normal Render build command was restored. Latest source tests: five Google tests, Web TypeScript/build passed; previous 31-test suite passed before the tester-gate edit. Main Brain updates after the final hosted verification are local documentation records, not a further deployed application revision.
=======
## Premium Notes and expandable Study Spaces — 2026-11-18

Implemented: individual/bundle catalog, external Buy/form workflow, per-account Pending/Purchased/Rejected states, manual Admin review with decision history and separate delivery status. Android Study Spaces now has Show more/Show less instead of horizontal scrolling. The external Buy button is included in the Play/AAB variant by explicit user request; no Play-program eligibility or publication approval is claimed. Existing batch payments are unchanged.

Tested: Web/Android TypeScript; Web/Admin production builds; Admin lint (pre-existing unrelated warnings); 36 backend payment/session/Google/notes tests and 44 Android tests. The follow-up audit-grant fix also passed the 25-test payment/notes and six-test session suites. Browser fixtures verified 1440/768/360 layouts, external opener isolation, Pending/reopen, Admin approval/customer refresh, editing/save/reload, empty/error/retry and failed-load save lock. No live purchase or form submission was made.

Supabase: both additive migrations applied; local filenames reconciled with hosted migration versions 20261118082723 and 20261118125532. Three protected tables, no public/client direct access or RPC execution; service-role audit UPDATE/DELETE revoked and INSERT retained. Products and requests remain empty.

Built: production AAB versionCode 6, EAS build a4a12973-bace-483d-8fee-ab6d354bb2c6 (FINISHED). Local artifact: c50-mobile/dist/Carrier50-v6-premium-notes.aab. Archive inspection confirmed Premium Notes, Pending status and expected public Supabase URL/key. EAS production public variable names EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY were explicitly configured for reproducible future builds; values are not recorded here. AAB build success is not device verification or Play publication.

Release checkpoint: Web/backend revision 266a6cc54a28ff8616fcc9d0c4277a4c1d9cdcbb pushed and hosted rollout observed: asset index-DE48gmpx.js contains Premium Notes; anonymous catalog returns HTTP 200 with an empty array and no-store; own-request and both Admin read routes return HTTP 401 without login. Render dashboard deployment ID was not inspected. Admin revision 356662ac10bd9a749fae687fecb9f2809f0c0a88 pushed; hosted asset index-BwDqKVye.js contains Premium Notes controls. Signed-in hosted Admin save/reload is not claimed. Actual product/form configuration, physical-device acceptance, external seller/payment matching and Play publication remain outstanding.

[Premium Notes runbook](../docs/premium-notes.md)
>>>>>>> 78d9680eb377fe63a96032332f24a6a1ff719be9
