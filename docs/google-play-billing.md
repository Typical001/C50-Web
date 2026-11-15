# Google Play Billing runbook

## Current rollout — November 15, 2026

Implementation is staged for Internal testing, not production acceptance. Website/direct APK Razorpay remains unchanged. Supabase migrations `20261115062543` and `20261115062749` are applied. Two current paid batches have disabled product mappings. No Google purchase or real charge has been performed.

Android build requested: `cda43959-bd39-4a2b-abf2-88fc12678c27`, profile `play-internal`, package `com.carrier50.c50academy`, version code 5. Build outcome and Play upload must be verified separately. This build uses a working-tree upload; its displayed Git HEAD is not a complete source revision.

## Shared access contract

One batch is one non-consumable, one-time Google product. No automatic expiry is introduced. Website/direct APK uses Razorpay; Play AAB uses expo-iap 6.4.4. Both grant the same Supabase enrollment for the same confirmed learning account.

`google_play_products` maps immutable product IDs to batches. Admin can read mappings through RLS; writes use the existing authenticated administrator backend. `google_play_accounts` binds an opaque UUID to each learning account. `google_play_purchases` stores purchase tokens and their SHA-256 uniqueness keys server-only: RLS enabled, no anon/authenticated grants or policies. Never log tokens or provider error objects.

The backend queries Google's productsv2 API, checks product, quantity, account binding, state and test-account allowance, then calls service-only `record_google_play_purchase`. Pending purchases do not unlock access. Replay preserves one payment and one enrollment; terminal cancellation cannot be undone by an older response. Repeated verification does not reactivate manually cancelled enrollments. A remaining verified Razorpay or Google payment can support access if another payment is cancelled. Admin overrides and batch active status retain existing semantics.

Acknowledgement runs after the durable transaction and is retried by reconciliation. The app never consumes a purchase. Product IDs cannot be remapped after saving. Existing private purchase records support restore even after catalog removal.

Google verification does not return an authoritative charge total. Google ledger records therefore have a zero legacy amount placeholder, null `amount_paise`/`gateway_mode`, `payment_gateway=google_play`, `google_is_test`, and a Google order reference. Web/Admin explicitly display Google Play order rather than presenting zero as a price. Financial reporting must not sum the placeholder as verified revenue. Fetching Google Orders totals and partial-refund financial reconciliation remain release work.

## Backend configuration (names only)

- `GOOGLE_PLAY_BILLING_ENABLED`: defaults off; set true only after setup and tests.
- `GOOGLE_APPLICATION_CREDENTIALS`: path to a Render secret file for the dedicated Google service account. No credentials in source, Expo public variables or client bundles.
- `GOOGLE_PLAY_TESTER_USER_IDS`: comma-separated Supabase user UUIDs allowed to verify license-test purchases. These are separate from Google license tester emails.
- `GOOGLE_PLAY_RTDN_AUDIENCE`, `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT`, `GOOGLE_PLAY_RTDN_SUBSCRIPTION`: exact authenticated Pub/Sub push identity, audience and full subscription resource.
- `GOOGLE_PLAY_RECONCILE_SECRET`: at least 32 random characters, server/scheduler only.

Routes: authenticated GET `/api/google-play/catalog`, POST `/prepare`, POST `/verify`; administrator GET `/api/admin/google-play/products` and PUT `/api/admin/google-play/products/:batchId`; authenticated Pub/Sub POST `/api/google-play/rtdn`; secret-authenticated POST `/api/google-play/reconcile`.

The reconciliation route scans 50 oldest non-cancelled records per invocation, requeries Google, and retries acknowledgement. Configure a durable scheduler and monitoring before enabling sales; an endpoint alone is not a running job. Monitor failed calls and acknowledgement age. Pub/Sub errors request redelivery; processing is idempotent by purchase token, not dependent on event order. Unknown/unbound purchases are rejected for investigation. Long-term invalid-token repair, voided-purchase catch-up, acknowledgement retry prioritization and large-ledger scheduling need additional acceptance before production.

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
