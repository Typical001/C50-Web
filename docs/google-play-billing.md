# Google Play Billing runbook

## Historical rollout — November 15, 2026

Implementation is staged for Internal testing, not production acceptance. Website/direct APK Razorpay remains unchanged. Supabase migrations `20261115062543` and `20261115062749` are applied. Two current paid batches have disabled product mappings. No Google purchase or real charge has been performed.

Android build requested: `cda43959-bd39-4a2b-abf2-88fc12678c27`, profile `play-internal`, package `com.carrier50.c50academy`, version code 5. EAS reports FINISHED. Play Console accepted version 5 in a saved Internal testing draft. Correction recorded November 16: the Internal track was resumed on November 15; the earlier paused observation is superseded. A production draft is now saved, not submitted. This build uses a working-tree upload; its displayed Git HEAD is not a complete source revision.

## Shared access contract

One batch is one non-consumable, one-time Google product. No automatic expiry is introduced. Website/direct APK uses Razorpay; Play AAB uses expo-iap 6.4.4. Both grant the same Supabase enrollment for the same confirmed learning account.

`google_play_products` maps immutable product IDs to batches. Admin can read mappings through RLS; writes use the existing authenticated administrator backend. `google_play_accounts` binds an opaque UUID to each learning account. `google_play_purchases` stores purchase tokens and their SHA-256 uniqueness keys server-only: RLS enabled, no anon/authenticated grants or policies. Never log tokens or provider error objects.

The backend queries Google's productsv2 API, checks product, quantity, account binding, state and test-account allowance, then calls service-only `record_google_play_purchase`. Pending purchases do not unlock access. Replay preserves one payment and one enrollment; terminal cancellation cannot be undone by an older response. Repeated verification does not reactivate manually cancelled enrollments. A remaining verified Razorpay or Google payment can support access if another payment is cancelled. Admin overrides and batch active status retain existing semantics.

Acknowledgement runs after the durable transaction and is retried by reconciliation. The app never consumes a purchase. Product IDs cannot be remapped after saving. Existing private purchase records support restore even after catalog removal.

The productsv2 response alone does not provide an authoritative charge total. Local code now fetches the separate Google Orders API, binds its order/token/product, validates currency and decimal amount, and stores google_order_total/currency/state. Web/Admin display verified totals when available; otherwise they identify a Google Play order without showing the legacy zero placeholder as revenue. Full refunds/cancellations revoke that purchase through the existing atomic access path. Partial-refund financial reporting and ordered financial snapshots remain follow-up work. This financial change is deployed in Web as of the later November 16 checkpoint below; Admin hosted verification remains outstanding.

## Backend configuration (names only)

- `GOOGLE_PLAY_BILLING_ENABLED`: defaults off; set true only after setup and tests.
- `GOOGLE_APPLICATION_CREDENTIALS`: path to a Render secret file for the dedicated Google service account. No credentials in source, Expo public variables or client bundles.
- `GOOGLE_PLAY_TESTER_USER_IDS`: comma-separated Supabase user UUIDs allowed to verify license-test purchases. These are separate from Google license tester emails.
- `GOOGLE_PLAY_RTDN_AUDIENCE`, `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT`, `GOOGLE_PLAY_RTDN_SUBSCRIPTION`: exact authenticated Pub/Sub push identity, audience and full subscription resource.
- `GOOGLE_PLAY_RECONCILE_SECRET`: at least 32 random characters, server/scheduler only.

Routes: authenticated GET `/api/google-play/catalog`, POST `/prepare`, POST `/verify`; administrator GET `/api/admin/google-play/products` and PUT `/api/admin/google-play/products/:batchId`; authenticated Pub/Sub POST `/api/google-play/rtdn`; secret-authenticated POST `/api/google-play/reconcile`.

The reconciliation route scans up to 10 non-cancelled records per invocation, prioritizing unacknowledged then oldest checked, with concurrency five, requeries Google, and retries acknowledgement. Configure a durable scheduler and monitoring before enabling sales; an endpoint alone is not a running job. Monitor failed calls and acknowledgement age. Pub/Sub errors request redelivery; processing is idempotent by purchase token, not dependent on event order. Unknown/unbound purchases are rejected for investigation. Long-term invalid-token repair, voided-purchase catch-up, acknowledgement retry prioritization and large-ledger scheduling need additional acceptance before production.

## Console setup and release

1. Dedicated Cloud project and Android Publisher API; dedicated service account invited to this Play app with purchase/order permissions, not broad owner access. Credential creation and secret entry require user handoff.
2. Authenticated Pub/Sub push topic/subscription, Google Play publisher grant, RTDN topic in Play Monetization setup, scheduler and monitored retries.
3. Upload billing-enabled AAB to Internal testing. Current Console blocks product creation until an artifact contains Billing permission.
4. Create India/INR one-time products: `c50_batch_c25125eddbac4bf8b8dd2ad2534de3b3` (Test 1, INR 2499), `c50_batch_391fca62da024928a6e2344b9e1ac1c1` (Test Batch, INR 50). Disable multiple quantities, rentals and pre-orders. Confirm Google price/tax presentation. No free-batch changes.
5. Add selected Google license testers and Internal track testers; install using the test opt-in. Internal track alone does not guarantee test charges. Configure matching learning-account tester UUIDs.
6. Enable mappings and server switch only for acceptance. Verify Google shows a test payment method. No real charge is authorized.
7. On a physical device test successful/pending/cancelled/declined purchase, app death before callback, offline verification/restore, reinstall, account switching, replay, refund/revoke, RTDN, acknowledgement retry and website unlock. Confirm Admin record, no duplicate enrollment and surviving second-provider entitlement.
8. Production release remains blocked until these checks and financial/refund operational gaps are resolved. Do not submit the Internal build to production automatically.

## Validation recorded

November 15: Web TypeScript and production build passed; 21 existing payment tests and 6 session tests passed. Two new tests exercise Google validation plus actual migration SQL in isolated PGlite (pending denial, replay, wrong account, cancellation, surviving Razorpay access, immutable mapping and private-token permissions). Admin lint passed with existing warnings; Admin TypeScript/build passed. Android TypeScript and 44 existing tests passed. No physical-device purchase test yet.

Supabase security advisor: two expected no-policy notices for deliberately server-only Google tables; existing authenticated SECURITY DEFINER helper warnings (caller checks retained) and leaked-password protection warning remain. These are not a claim of a clean full security audit.

References: [Google purchase lifecycle](https://developer.android.com/google/play/billing/lifecycle/one-time), [purchase verification](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.productsv2/getproductpurchasev2), [Orders financial data](https://developers.google.com/android-publisher/api-ref/rest/v3/orders).

## Hosted progress — November 15, 2026

Web/backend revision 361815c557478fcc9b0c6e5b399ac796783f35dc is Live on Render, deployment dep-dbss4p95efls73f3rg40. Public health returned 200; unauthenticated Google catalog and Admin mapping endpoints returned 401. Admin revision 2f2d22a is published: hosted bundle index-DgHi4oF3.js contains the Google mapping editor and ledger fields. Authenticated Admin UI/save acceptance remains outstanding.

Cloud project c50-play-billing-20261115 (number 431508870911) created under the user-selected Google account. Android Publisher API enabled after explicit terms approval. Service account c50-play-verifier@c50-play-billing-20261115.iam.gserviceaccount.com created without project-wide roles. User credential creation/Render secret entry handoff is pending; Play app permissions, Pub/Sub and scheduler are not yet configured.

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

Transport reference: [Supabase http extension](https://supabase.com/docs/guides/database/extensions/http). GOOGLE_PLAY_RECONCILE_SECRET is optional when using the service-only Vault validator. The cron job uses direct HTTPS and private status-only run logs. No secret values belong in commands or documentation.


### Later November 16 verification

Google RTDN test reception was confirmed in Render with the sanitized authenticated-test acceptance log. Reconciliation now has 40 HTTP-200 runs, all while the Google purchase ledger is empty. Both India-only Buy options are active at INR 50 and INR 2499 with multi-quantity disabled. Version 5 is saved in Publishing overview for production: no blocking validation errors, one missing-deobfuscation-file warning; not submitted yet. Hosted Admin bundle index-DA-FEKlX.js contains the Google total/currency fields and mapping editor, though exact Netlify deployment revision has not been checked.

Added a tester-only exception to the disabled checkout gate, using authenticated user IDs already configured in GOOGLE_PLAY_TESTER_USER_IDS. This allows controlled acceptance without exposing checkout to other users. Five Google tests and fresh TypeScript/build passed; prior 31-test suite results remain separately dated. User supplied a confirmed student account for acceptance. License-test setup and physical-device purchase/restore checks are in progress.
