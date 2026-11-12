> HISTORICAL SNAPSHOT — captured 2026-11-09 from Implementation plan.md. Not current instructions or deployment status. Later entries may supersede earlier entries. Credentials redacted; obsolete local hyperlinks converted to labels. See [current state](../CURRENT-STATE.md).

# C50 Production Deployment Implementation Plan

## Carrier50 Android launcher branding — 2026-11-09

- Display name is Carrier50 in both Expo configuration sources and both distribution modes; package IDs, signing credentials and payment separation preserved.
- Supplied unnamed.png preserved as assets/carrier50-logo.png. Exported black-backed standard/adaptive launcher assets with mask-safe padding; removed placeholder adaptive background/monochrome references. Export script: c50-mobile/scripts/export-launcher-icons.cjs. Splash/store artwork unchanged.
- Regenerated ignored local Android resources; verified Carrier50 label and adaptive XML. TypeScript and all 29 mobile tests pass. Both resolved distribution configurations checked.
- Configured the two existing public Supabase values in EAS preview environment (no server secrets). Preview APK build submitted: 6130b55f-2803-4657-b12c-7edbf8224724. Build FINISHED; downloaded dist/branding/Carrier50-preview.apk and inspected packaged Carrier50 label, direct package ID, black adaptive background, absence of placeholder monochrome layer, and extracted supplied-logo foreground. No connected-device runtime test or Play submission.

## Terms of Service — 2026-11-05

- [x] Create public Carrier50 Terms page with user-confirmed no voluntary refunds/cancellations and mandatory legal-rights exceptions.
- [x] Add Express /terms routes, homepage footer link, and privacy/deletion cross-links.
- [x] Verify production build and local HTTP 200 for /terms and /terms/ without login or client JavaScript.
- [ ] Owner/legal review of terms; push/deploy web changes to Render and verify public HTTPS page. Submit https://c50-web.onrender.com/terms to Play Console only after deployment.

## Google Play listing artwork — 2026-11-01

- [x] Generate and validate upload-sized icon (512x512) and feature graphic (1024x500), saved in store-assets with prompts.
- [ ] Upload approved assets to Play Console. Existing Android binary icon remains unchanged; adopting the generated icon in the app requires a separate icon configuration/build update.

## Account deletion request page — 2026-11-01

- Added public, script-free `/delete-account` and `/delete-account/` pages with C50 Academy/Carrier-50 identity, owner Sunil Rajput, support email carrierdds50@gmail.com, prefilled email request plus copyable fallback, ownership-verification steps, data categories, loss-of-access warning and retention disclosures. No login required.
- User confirmed 30 days for processing and payment-record retention; page defines the start as ownership verification, discloses legal/dispute exceptions and independent provider retention. Privacy policy updated consistently. Owner must validate actual retention obligations before publication.
- Added website footer link and Android Profile/Login Request Account Deletion links with accessible labels and browser-open failure fallback. No accounts deleted, database changes, emails sent or automatic deletion backend added. This is a manual support flow; monitor inbox and use a reviewed administrative procedure. See C50-Project/docs/account-deletion.md.
- Verified web/mobile TypeScript, production web build, all 29 mobile tests (3 new deletion tests), and unauthenticated local production HTTP 200 HTML responses for both paths. Existing bundle-size warning remains. No device test, deployment, APK/AAB build or Play Console submission performed.
- Remaining: review policy/operational fulfilment, deploy and verify https://c50-web.onrender.com/delete-account, rebuild Android and test links, then submit the URL to Play Console. Page implementation alone does not prove deletion fulfilment or Play compliance.


## Hosted recovery redirect correction — 2026-10-27

- Inspected signed-in Supabase URL Configuration: Site URL was still http://localhost:3000 and only two local reset redirects were allowed. Changed Site URL to https://c50-web.onrender.com and saved the exact https://c50-web.onrender.com/reset-password redirect, preserving both local entries. Dashboard now shows three allowed URLs.
- Confirmed recovery code is already deployed: local web repository commit 7335910 (Password fix) and live bundle index-C7nbBxqU.js. No GitHub push or additional deployment required/performed in this task.
- Browser-tested a synthetic expired-error fragment on the live homepage: it opens the corrected recovery error view, cleans the URL, and Request a new reset link opens the email form. Saved dashboard evidence in recovery-url-settings.png. No real recovery email sent, credentials used, or password changed.
- Supersedes earlier deployment/redirect-pending notes. Remaining: user requests a NEW email and completes reset/login; old invalid links cannot be repaired. Email-template review and real successful recovery E2E remain unverified.


## Password recovery repair — 2026-10-27

- [x] Replace token-paste/empty-refresh-token flow with verified isolated recovery session, root-path error handling, URL credential cleanup, password confirmation, resend path and safe failure handling.
- [x] Validate forgot-password input and public HTTPS production redirect; retire unused legacy reset endpoint with 410.
- [x] TypeScript/build, 7 recovery tests and 18 payment tests; local HTTP 200/400/410 checks passed.
- [x] Confirm Supabase connection and C50 project ACTIVE_HEALTHY.
- [ ] Verify/correct Site URL, exact `/reset-password` allow-list and recovery email template in dashboard (not exposed by available connector tools). Confirm Render APP_URL is the production origin. Settings not changed in this task.
- [ ] Deploy the changed web/backend code and complete a fresh-email password reset followed by login with a controlled account. User must enter the password; do not share recovery tokens. Local browser visual check blocked by ERR_SSL_PROTOCOL_ERROR; automated tests do not replace E2E validation.
- [ ] Separately address revocation of pre-existing custom Express sessions after password change. Runbook: `C50-Project/docs/password-recovery.md`.

## Privacy policy implementation — 2026-10-27

- Added a standalone, responsive, script-free public HTML privacy policy at `/privacy` (also `/privacy/`) in the existing Express/Vite app. Owner: Sunil Rajput; public privacy/support contact: carrierdds50@gmail.com. Covers account/profile data, learning activity, payments, hosting/auth/video providers, local storage, security, retention, deletion requests and children.
- Replaced the web footer placeholder and added a shared accessible browser link on Android Login, Register and Profile, with failure handling. No dependencies, database changes, payment changes or secrets added.
- Verified web and mobile TypeScript, production web build, 24 existing mobile tests and two new privacy regressions. Built production server returns HTTP 200 HTML for both privacy paths without authentication; owner/contact and script-free response checked.
- Not deployed; target public URL is https://c50-web.onrender.com/privacy. Deploy web/backend and verify public HTTPS before submitting to Play Console; rebuild Android to include links and test on-device. No APK/AAB generated.
- Owner review remains necessary for real operational retention/deletion practices and provider disclosures. Email request instructions are not an implemented deletion workflow. Add discoverable in-app/external account-deletion handling and complete Data safety before Play release; this page does not establish overall legal or Play compliance.


## Admin login hardening and email replacement — 2026-09-11

- Removed exposed demo credentials from Login and added safe error messages, duplicate-submit prevention and password clearing. App now owns server-user/admin-role/current-token verification; generation guards, cancellation, timeout, deferred auth callbacks and visibility rechecks prevent stale results from restoring CMS state. Logout immediately locks the panel, persists that lock for this tab and uses local-scope sign-out. CMS remains gated if authorization fails; database RLS remains authoritative. Changes mirrored to Downloads; six upload/login regression checks pass.
- At the user's explicit request, updated the existing Supabase administrator's email to prathvishsinghyadavgwl6@gmail.com through the Auth Admin API. Re-read verified the new email, same user ID and admin role. No new account was created. Password unchanged; no reset email sent and no account-wide session revocation performed. Temporary administrative script removed.
- Required next: rotate the exposed account password and revoke existing sessions; email replacement alone does not remediate leaked credentials or old tokens. Push/redeploy admin source and perform actual administrator/student login, logout and refresh checks. No passwords or keys recorded here.

## Admin thumbnail uploads — 2026-09-11

- Applied and recorded live migration 20260911120000_restrict_admin_thumbnail_uploads: removed the permissive anonymous/student thumbnails INSERT policy and added restrictive INSERT/UPDATE/DELETE guards requiring an admin for this bucket. Existing admin policies, public image reads, stored objects and other buckets are preserved. No images deleted.
- Added BatchImageInput to batch create/edit for thumbnail and banner: HTTPS URL option plus local-device file picker, preview, JPG/PNG/WebP validation (5 MB, decodable bitmap, maximum 10,000 pixels per side), unique non-overwriting Supabase paths, authenticated admin precheck, upload status and save/close blocking during upload. Limits are picker-side; bucket-wide limits were not changed because other CMS upload flows share it. Uploaded images remain in Storage if the form is cancelled; old images are retained to avoid breaking shared references.
- Existing thumbnail_url/banner_url columns synchronize with Web and Android after saving/refetching. Source mirrored to Downloads. Production build and two static upload regression checks pass; lint has only existing HomepageCMS/SyllabusCMS warnings. Live role-predicate checks permit admin and reject student; anonymous check denied at function permission layer. Policy catalog verified; no end-to-end browser upload or file deletion test performed.
- Remaining: push admin-panel changes to C50-Admin, deploy/redeploy, test local-file upload and saved-image display in Web/Android. Login demo credentials and stale-request hardening from the audit remain outside this upload-only change.

## Whole-app glass theme rollout — 2026-09-10

- Extended approved near-black/violet Home design through Login, Register, Profile, My Batches, Batch Detail and Course Player. Added shared GlassScene backgrounds; frosted auth forms, profile header, batch stats/action panel, player breadcrumbs/details; translucent charcoal list cards and unified rounded surfaces. Shared theme now derives from glassTheme, with legacy gold aliases mapped to lavender. Updated in-app emblem and loading splash accents. Home structure remains unchanged.
- Corrected primary action text/icons to dark foreground on lavender; retained semantic success/error styling and unobstructed video. Existing native alerts and provider-owned checkout/video interfaces retain their platform/provider layouts. No authentication, enrollment, payment verification, CMS or backend logic changes; no new dependencies. Existing native blur build requirement remains.
- Synced scoped source to Downloads after verifying those files matched the starting worktree. TypeScript passed; all 24 tests passed, including new app-wide theme wiring regressions and existing payment/access contracts. Play-mode Android Metro export succeeded at c50-mobile/dist/glass-app-play. No APK/AAB generated or deployment performed.
- Remaining: install a fresh preview APK and visually test keyboard/form focus, large text, Profile/My Batches navigation, batch overview, protected notes, player/completion controls and glass scrolling performance on real Android. Existing functional limitations and production security blockers are not resolved by this UI task. This entry supersedes earlier notes saying these screen interiors were not restyled.

## Reference palette update — 2026-09-10

- Color-only update to the approved Home design: near-black background (#090A0D), charcoal glass (#15161D), cool white text (#F5F5FA), muted lavender controls (#D5CFFA), and soft violet light effects. Replaces the earlier olive/ivory colors, including hard-coded warm highlights and category icon tints. Shared glass resource pages and navigation shell inherit the palette.
- Layout, imagery, effects geometry, navigation, content, payment/access logic and dependencies unchanged. Mirrored to Downloads; TypeScript and all 22 tests passed, including opaque text contrast checks. No native build or device visual check performed for this color-only change. Previous native blur rebuild requirement still applies to APKs without expo-blur.

## Glass-reference Home and resources — 2026-09-09

- Implemented the supplied smart-home reference as C50 learning UI: smoky olive/bronze backdrop, dim CMS course imagery, radial light pools, fine curved orbit lines and subtle particles, frosted rounded cards with rim highlights, ivory filter pills, large sans-serif heading, image-first course cards and horizontally scrolling circular shortcuts for all six categories.
- Home top-right Profile icon and Profile → My Batches stay connected. Previously removed promotional hero and bottom navigation remain absent. Resource lists share the glass surfaces; auth, course detail, player, Profile and My Batches interiors retain their existing designs. No smart-home controls or fabricated course content added.
- Added shared GlassScene/FrostedSurface/Reveal and glassTheme. expo-blur ~57.0.2 uses Expo 57 BlurTargetView and dimezisBlurViewSdk31Plus (Android 12+ blur; older devices use tint). Reduced transparency selects opaque cards; reduced motion disables entrance animation. Decorative layers do not intercept taps. Palette opaque fallback text contrast covered by tests.
- Mirrored current source and dependency changes to Downloads. TypeScript passed; all 22 tests passed (including static wiring, navigation and entitlement contract checks); Play-mode Android Metro export succeeded at c50-mobile/dist/glass-home-play. These checks do not prove native runtime appearance or checkout behavior.
- Remaining: build/install a fresh preview APK because expo-blur is a new native module; verify small screens, large text, category scrolling, Profile/back navigation, course/notes access, blur performance and reduced-motion settings on real Android. No native APK/AAB built, no deployment or database/payment changes performed. Existing payment/security release blockers are unchanged. See c50-mobile/docs/glass-home-redesign.md.

## Bottom navigation removed — 2026-09-09

- Removed the Home/My Batches/Profile bottom navigation entirely. Replaced nested tab navigator with native stack, retaining existing route IDs for compatibility. Home top-right profile icon opens Profile with native back navigation; Profile's enrollment tile opens My Batches so existing course access remains reachable. Dashboard Explore action remains typed and returns to Home.
- Removed Home's floating-bar clearance, retaining bottom safe-area padding; Profile receives safe-area padding and no longer duplicates header top space. Six category shortcuts, saved content, auth/payment/entitlement logic unchanged.
- Mirrored source to Downloads; TypeScript and all 20 tests pass. Regression test asserts no bottom-tab navigator and Profile/My Batches links. No native APK/AAB, deployment or physical-device navigation test performed. Earlier bottom-bar descriptions are historical.


## Android Home hero removed — 2026-09-09

- Removed the entire pictured YOUR NEXT CHAPTER hero, promotional heading/description and My learning space CTA from Android Home; removed unused hero styles/import/state. Search now leads directly into the study toolkit with normal spacing. My Batches remains available in bottom navigation.
- Android-only source change, mirrored to Downloads. Saved Supabase hero content, Web/Admin behavior, faculty CMS, courses, navigation and security remain unchanged. TypeScript and all 20 tests passed, including a hero-removal regression assertion. No APK/AAB or deployment performed.


## Home positioning and supplied palette revision — 2026-09-09

- Supersedes the Sept 8 dark coffee Home: use printed palette hex values #524646 plum, #A8A492 sage, #FCF2E5 cream and #EC5B38 orange. Cream Home canvas, plum compact hero/main tabs, sage borders/tinted cards, orange actions. Darker derived link text and dark orange-button text preserve readable contrast; tests cover key text combinations.
- Removed fixed six-shortcut panel from Home bottom. All six category buttons now scroll in the Home header below the hero, matching reference hierarchy. Header/profile → search → smaller CMS hero → study-toolkit grid → course filters/catalog → faculty. One floating Home/My Batches/Profile bar stays above Android's bottom inset; Home list has explicit bottom clearance and bar hides on keyboard. Other tab screens keep an in-flow bar to avoid overlaying their content.
- Home status bar is dark on cream and light on existing dark screens. Existing CMS data, search, paid/free filtering, all category routes, social links, payment/enrollment checks unchanged. Other screen interiors retain previous styling.
- Source synced into Downloads. TypeScript and all 20 tests pass; Android Metro export checked during this task. Still requires updated native APK/device visual review, including keyboard, large fonts and gesture/three-button navigation. No APK/AAB, Git push or release performed. No claim of physical-device visual verification.


## Coffee Home redesign — 2026-09-08

- Implemented approved Home-first Espresso Academy direction: espresso/mocha/cream/caramel tokens, serif editorial headings, CMS hero with functional My Batches CTA, redesigned thumbnail/text course cards, educator carousel, working search and All/Paid/Free filters. Removed invented Home rating display. Missing thumbnail fallback, responsive narrow/font-scale treatment, pull/focus refresh, error/retry and request cancellation.
- Restyled six-shortcut panel and shared rounded main tabs; applied a dark coffee navigation-container theme to avoid white edges. Preserved every category route, profile route, course details, CMS reads and Play paid-price restrictions. No payment/enrollment/backend/schema changes. Legacy global theme and other screen layouts intentionally remain unchanged pending Home approval.
- Source integrated into Downloads. TypeScript and all 18 tests pass; Android Play Metro export passed. These are code/bundle checks, not physical-device visual approval. No native APK/AAB, Git push, store release or dependency installation.
- Remaining: build/install updated Android app, inspect Home at small/large text and with real CMS data, test keyboard/search/filter/offline/navigation behavior, obtain Home design approval, then redesign Batch Overview/My Batches/Profile/resources/classroom/authentication. Specification: c50-mobile/docs/coffee-home-redesign.md.


## Android Home category navigation — 2026-09-08

- Added fixed six-shortcut panel at the bottom of Home above retained Explore/My Batches/Profile tabs: Paid Courses, Free Courses, Lecture Notes, Current Affairs, Test Series, Social Links. Two-row layout, accessible button labels and system bottom-inset-aware tab bar.
- Registered typed HomeCategory route with loading/error/retry/empty states and pull refresh. Paid/free catalogs are disjoint and active-only; Current Affairs/Test Series match explicit category, custom_tag or tags (case insensitive, hyphen/underscore normalized). These are batch catalog destinations, not a new quiz engine. Tag batches via existing custom-tag control where needed.
- Lecture Notes reads existing authenticated/RLS-protected lecture attachments, then rechecks backend batch entitlement and reloads the attachment before opening HTTPS. Handles removed/invalid URLs, account changes, navigation-away and launch failures. No payment/enrollment writes or policy changes. Public-media security caveat from earlier work still applies.
- Social Links uses the user's exact YouTube channel https://www.youtube.com/channel/UChfRet3hNB7VOy6xcy7sm2g and Instagram https://www.instagram.com/carri_er50/reels/. Confirmed links live in c50-mobile/src/lib/homeCategories.ts; no invented URLs or new CMS field.
- Hardened Home faculty JSON against malformed values and removed the Profile navigation any-cast. Source integrated into Downloads; no env/dependency/backend/schema change, Git push or APK/AAB build.
- Validation: 15 mobile tests; final TypeScript and Android Metro export checked in this task. Physical-device navigation/layout/PDF/link launch checks remain; install an updated APK to test. Empty categories display honest unavailable-content states, not unrelated resources.


## Completed: Android Batch Overview CMS — 2026-09-08

- Implemented in existing standalone admin-panel + c50-mobile; mirrored source to Downloads. Admin edits header/title/banner/thumbnail/tag, description/headings, stat labels/values/icons, feature lists/icons, extra paragraph/bullet sections and display captions. Add/remove/reorder controls; existing price/free/payment settings and entitlement checks preserved. No new backend or separate content database.
- Applied/recorded additive Supabase migration 20260908090000_batch_overview_content.sql. Validated batches.overview_content JSONB; retained existing admin-only RLS. Migrated existing hard-coded feature bullets into editable metadata; removed invented 60+/4.5 Android fallbacks. No existing prices, descriptions, media URLs, payments or enrollments changed.
- Android reads the same row on focus/foreground/pull-refresh and every 30 seconds while focused+active. Structured plain-text rendering with bounded lists/icon allowlist; safe-area footer spacing. Stats are editable display values, not actual counts/reviews. OS bars and purchase/security state remain outside CMS.
- Passed Downloads Admin build, mobile TypeScript, 10 tests, Android Play Metro export. Live rollback-only SQL verified admin save/read, student read, denied student writes and malformed content rejection. Authenticated UI loaded actual MPPSC Foundation - MP GK; add-section/bullet draft checked then discarded without saving.
- Remaining: deploy updated standalone Admin where hosted, build/install updated Android APK/AAB once, physical-device layout + synchronization check with user-approved content. Later supported content edits require no new binary. No Git push/native build/hosted Admin deployment performed. Runbook: c50-mobile/docs/batch-overview-cms.md.


Updated: 2026-09-06. This file is the living checklist for the deployment-hardening work. Update this file and `memory.md` after every completed step.

## Secure-payment execution status — 2026-09-05

### Webhook configuration update — 2026-09-07

- [x] Test-mode Razorpay webhook TZ1fCIPxsdmIGn enabled for payment.failed, payment.captured, order.paid at https://c50-web.onrender.com/api/payments/razorpay/webhook, with matching server-only secret saved in Render.
- [x] Render redeploy dep-daf4d2mq1p3s73bjs6e0 is Live. Health 200; unsigned webhook request rejected with 400 Invalid webhook signature. No source changes, transaction, enrollment, or Live-mode activation.
- [ ] Perform a real Test-mode checkout and verify provider webhook delivery, payment/enrollment linkage, failed-event behavior and idempotency. This remains distinct from configuration and unsigned-request testing. Older secret-unset/deploy-pending notes below are superseded for the deployed backend only.

- [x] Startup regression repaired in both checkouts: public active-batch catalog uses the server client with mapped metadata; frontend rejects failed/non-array responses and shows a retry alert. Verified three batches load and homepage renders; Downloads lint/build pass. No RLS weakening or additional payment-step implementation.

This sequence is separate from the older deployment-hardening step numbers below.

- [x] Payment Step 1: additive payments/enrollments database foundation.
- [x] Payment Step 2: local server-only Razorpay test key configuration. Webhook secret and Render configuration remain deployment tasks.
- [x] Payment Step 3: shared Express authentication and database-backed course access enforcement. Migration `20260905120000_enforce_course_entitlements.sql` applied and recorded in live Supabase.
  - Express accepts existing signed/encrypted web sessions and verifies Supabase access tokens through Auth; authoritative roles are read from profiles.
  - Shared entitlement RPC requires an active exact-user/batch enrollment; paid access additionally requires a matching successful payment with server verification evidence and provider IDs. Historical success labels alone do not qualify.
  - Protected course structure, progress/history writes, and direct Supabase course reads. Added authenticated batch-access endpoint. Public search returns batch metadata only.
  - Blocked client profile-role escalation and disabled mock payment verification (503).
  - Web player and embedded CMS now authenticate structure requests; player displays access failures.
  - Passed TypeScript, production build, API smoke tests (including free enrolled access), and rollback-only live SQL tests for invalid entitlements, direct RLS, role escalation, finalizer verification stamping, and duplicate finalization.
- [x] Payment Step 4 backend implementation: replaced mock orders/verification with Razorpay HTTPS API integration, strict server-derived purchase inputs, HMAC plus provider-data verification, raw-body signed webhooks, and owner-only status reconciliation.
  - Applied and recorded `20260906080000_payment_order_reconciliation.sql` live: exact paise/mode snapshots, unique pending purchase per user/batch, stronger service-only finalization, failed-attempt-to-capture recovery, and missing-enrollment repair.
  - Pending orders are reused; ambiguous POST outcomes recover via receipt lookup rather than blindly creating another order. Webhook IDs/payload hashes prevent inconsistent replay; failures never revoke enrollment.
  - Passed 16 automated payment tests, TypeScript, production build, API smoke checks, and rollback-only live DB tests. Actual Razorpay test credentials authenticated with a read-only request.
  - [ ] External validation: webhook secret is unset; deploy an HTTPS endpoint, configure matching Razorpay/server secret and three event subscriptions, then run an actual test Checkout payment and dashboard webhook deliveries. No charge was made and no paid batch was enabled.
  - [x] Workspace integration (2026-09-06): Step 3/4 application code, migration files, payment tests, smoke script, and runbook are integrated into Downloads. Preserved Downloads-only configuration notes and all ignored environment files. Downloads payment tests (16), TypeScript, production build, and authentication/free-course smoke checks pass.
  - API/runbook: `C50-Project/docs/payments.md`. Web/Admin implementation is now completed in Step 5; actual payment/button testing, Android, private paid assets, and rollout checks remain.
- [x] Payment Step 5 implementation: existing Web/Admin Checkout UI and isolated official ₹1,000 button component (`pl_TYDEnuuLchDM7E`); button alone never grants access.
  - Replaced simulated checkout with server-created Razorpay Orders, strict verification/status polling, pending/retry states, and entitlement rechecks before Start Learning.
  - Added Paid Batch, Payment Enabled, and optional button-ID reference controls in both existing admin interfaces; server validation and mapped batch fields are aligned.
  - Applied/registered migration `20260906120000_paid_batch_ui_settings.sql`: button-ID format constraint and separate initially inactive/payment-disabled ₹1,000 test fixture. Production builds exclude its development-only button renderer.
  - Integrated source into Downloads. TypeScript, 18 payment/client tests, student/backend and Admin builds, and API access smoke checks passed.
  - Authenticated Admin UI rechecked on 2026-09-06: Aagaz and test batch display the controls; the isolated test warning/confirmation guard is visible. Payment Enabled is now checked for both in the live UI, differing from the migration defaults. This read-only check did not save or change either batch.
  - [ ] Actual Checkout payment, cancellation/pending recovery, webhook delivery, and provider button Test-mode/₹1,000 validation remain external end-to-end checks. No transaction was performed.
- [x] Payment Step 6 code implementation: existing Android app uses shared backend verification/entitlements. Direct-install preview APK supports native Razorpay; Play production AAB consumes existing access without a paid purchase CTA, price or link. Distinct Android package IDs and fail-closed production configuration.
  - Removed direct enrollment inserts; free enrollment stays on the authenticated free-only endpoint. Verified Dashboard/Profile enrollments, player access checks, native callback verification and persisted pending-status recovery implemented.
  - TypeScript and six mobile contract/build-policy tests pass. Both Android Metro export variants checked; clear cache when changing distribution.
  - [ ] Native APK/AAB compilation and physical-device checkout/cancellation/restart/account-switch tests remain. Configure EAS public Supabase variables and backend webhook secret/events; no native build or payment was performed. See c50-mobile/docs/android-payments.md. This completion marker covers implementation, not Play approval or release readiness.
- [ ] Payment Step 7: full end-to-end security/payment testing and deployment.

**Storage release condition:** no live paid lecture currently has a notes URL. The existing public course-assets bucket was retained for free assets. Before attaching paid files, implement private Storage plus authorized signed downloads; paid videos also need an access-controlled provider. Database/API gating does not make a public file/video URL private.

**Workspace:** Step 3/4/5 application changes are integrated into `C:\Users\prath\Downloads\C50-Project-main` (2026-09-06). Downloads-only notes and local credentials were preserved. Step 5 migration was applied and recorded separately. Webhook deployment/configuration, actual payment testing, and Android remain pending.

## Completed

### Render deployment attempt — 2026-09-06

- [x] **Backend deployed and verified:** commit `9c7dcb3374d02b7dc0ab76436b42631d14149aee` passed installation, TypeScript, all 18 payment tests, and production build. Render deploy `dep-daekv47avr4c73b9jhkg` reports Live.
- [x] Public smoke checks: HTTPS /health returns 200 with status ok; / and /api/batches return 200; unauthenticated order creation and batch access return 401; untrusted Origin returns 403; deployed origin is allowed exactly.
- [ ] Razorpay webhook secret/dashboard subscriptions, actual Test-mode Checkout and webhook delivery, authenticated user end-to-end testing, private paid media, and remaining release checks are still outstanding. Deployment is not approval for live customer payments. The first-attempt failure below is historical and resolved by this commit.

- [x] Created free Node Web Service `c50-web` in Singapore from `Typical001/C50-Web` main (repository contains the web/Express folder at root). Service ID: `srv-daekrln40ujc73fl3860`; assigned URL: https://c50-web.onrender.com.
- [x] Configured build `npm ci --include=dev && npm run lint && npm run test:payments && npm run build`, start `npm start`, health path `/health`, production runtime, approved Supabase/Razorpay test credentials, separate session secret, and exact origins. Temporary credential transfer file deleted; original local environment preserved. Webhook secret remains unset.
- [ ] First deployment of `20ac88a` failed at npm ci: lockfile missing three @svta packages. Repaired package-lock.json in Downloads and worktree; isolated npm ci dry-run now passes. User must push repaired lockfile; verify next Render build and public health/catalog/auth boundaries before marking deployment complete. No live backend or successful payment test has been confirmed.

- [x] **1. Render startup readiness** — use `process.env.PORT` and expose `GET /health` in `C50-Project/server.ts`; TypeScript validation passes.
- [x] **2. Supabase schema foundation** — add `lecture_progress.watch_percentage`, create RLS-protected `watch_history` and `daily_streaks`, and register migration `20260904182206_production_json_state_foundation` as applied.
- [x] **3. Remove JSON-backed API state** — convert enrollment, payment history, progress, watch history, daily streak, announcement, dashboard-statistic, and search endpoints to Supabase; register `20260905063528_add_announcement_type`.
- [x] **4. Move uploads to Supabase Storage**
  - [x] Created the live public `course-assets` bucket through migration `20260905064354_add_course_assets_storage`; it allows PDFs, JPEGs, PNGs, and ZIPs up to 20 MiB.
  - [x] Added Storage RLS policies allowing authenticated administrators to upload, update, and delete objects in `course-assets`.
  - [x] Removed the active Express static middleware for `/uploads`; the server no longer exposes `public/uploads` as a static upload directory.
  - [x] Replaced `/api/upload` local writes with a server-authorized Storage upload, which returns a public Storage URL and accepts only validated Base64 payloads.
  - [x] Preserved the upload payload through sanitization; enforce matching extension/MIME, file signatures, and a 20 MiB decoded-file maximum.
  - [x] Updated the legacy dashboard uploader to send its admin token and handle failures, and changed the course player to download only explicit remote attachment URLs.
  - [x] Migrated the three live legacy `notes_url` values to `course-assets`; no live lecture points to `/uploads/...`.
  - [x] Delete an unreferenced `course-assets` note automatically when a lecture is updated or deleted; shared assets are retained.
  - [x] `npm run lint` and `npm run build` pass. A real upload smoke test follows after the server-only service role credential is configured in Step 5.

## Remaining implementation

Local configuration update (2026-09-05): Downloads checkout backend Supabase variables and a generated session secret are now populated in ignored `.env`; admin/mobile public variables are in ignored `.env.local`. All five migrations were confirmed remotely. Razorpay settings were preserved. Hosted deployment and legacy key retirement remain outstanding.

- [x] **5. Configure production secrets, origins, and Supabase security**
  - [x] Removed hard-coded credentials from the student web app, admin panel, mobile app, and Express server. Added environment templates for each runtime and require server-only `SUPABASE_SECRET_KEY` plus `SESSION_SECRET` at startup.
  - [x] Switched clients to the current publishable-key environment variable and the backend to a current secret key; no service-role/secret key can be bundled into Vite or Expo output.
  - [x] Replaced wildcard CORS with an exact `APP_URL` plus optional comma-separated `CORS_ALLOWED_ORIGINS` allow-list. Password-reset redirects now always use `APP_URL`.
  - [x] Hardened `is_admin` and `handle_new_user`: fixed `search_path`, revoked public execution, limited execution to required roles, and removed the client-controlled administrator-role path from signup.
  - [x] Updated Supabase Auth policy: confirmed email, 12-character password minimum, upper/lowercase/digit/symbol requirement, password-change reauthentication, and exact local reset URLs.
  - [!] **Deployment handoff**: Set the actual Render URL and secret values in Render before starting the service. Migrate the existing backend to the already-created `c50_backend` Supabase secret key, then deactivate the exposed legacy `service_role` key. Enable Supabase leaked-password protection after upgrading to Pro; it is unavailable on the project’s current tier.

- [ ] **6. Secure paid-batch purchases — Razorpay Orders + Checkout**

  **Initial audit findings (2026-09-05; superseded by completed items/status above):**

  - The existing student web PaymentModal.tsx (historical reference) simulates a Razorpay payment, sends client-supplied `userId` and amount, and the existing `POST /api/payments/verify` records it as successful without HMAC verification.
  - `POST /api/payments/create-order` currently creates a random mock order rather than a Razorpay order. No webhook endpoint exists.
  - `enrollments` already has a unique `(user_id, batch_id)` constraint and RLS correctly allows direct inserts only for free active batches. `payments` is already readable only by its owner or an administrator. These policies will be retained.
  - `batches` lacks `payment_enabled` and `razorpay_payment_button_id`; `payments` lacks currency, Razorpay signature/method, update time, and unique provider identifiers; `enrollments` lacks `payment_id` and `enrolled_at`.
  - The standalone Admin CMS has the real Batch Create/Edit UI in BatchesCMS.tsx (historical reference). The legacy embedded `AdminDashboard.tsx` batch UI should be kept aligned if it remains enabled.
  - The Android app currently inserts enrollments directly and marks paid batches enrolled without taking payment. It authenticates directly with Supabase, while Express currently accepts only its custom web session token. The shared backend auth boundary must be extended before Android uses payment APIs.
  - The course-structure endpoint is currently public, so hiding the React button is not an access control. It must require a verified active entitlement before returning paid-course content.

  **6.1 — Database migration (additive; no data destruction)**

  - [x] Applied `20260905074500_secure_razorpay_purchase_foundation.sql` to the live Supabase project and recorded it as applied. It adds `batches.payment_enabled boolean not null default false` and `batches.razorpay_payment_button_id text`; existing paid batches remain disabled until an administrator explicitly enables payment.
  - [x] Extended `payments` with `currency`, Razorpay order/payment/signature fields, payment method, failure metadata, and `updated_at`. Existing `gateway_order_id`/`gateway_payment_id` values are copied into the new canonical fields when present; legacy columns are retained.
  - [x] Added unique partial indexes for non-null Razorpay order IDs and payment IDs, plus the unique webhook event ID. They make duplicate checkout callbacks and webhooks harmless.
  - [x] Extended `enrollments` with `payment_id` and `enrolled_at`, retaining its existing unique `(user_id, batch_id)` entitlement constraint. A database constraint prevents a `paid` enrollment without a linked payment.
  - [x] Added server-only transactional RPC `finalize_razorpay_payment`. It row-locks the payment, safely transitions it to success, and creates/repairs the active paid enrollment atomically. It has a fixed search path and cannot be called by `anon` or `authenticated` clients.
  - [x] Added RLS-protected `payment_webhook_events` with unique Razorpay event IDs, payload hashes, processing state, and optional linked payment for idempotent webhook handling. It does not store unnecessary payment-card or bank data.

  **6.2 — Backend and authentication boundary**

  - [x] Added server-only placeholders for `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` to C50-Project/.env.example (historical reference). Test-mode key ID/secret are configured in the gitignored local backend `.env` and their presence was verified without reading them. The webhook secret can be set only after Step 4 deploys the endpoint. Before deployment, add these values directly to Render. Never add any of them to `VITE_`, `EXPO_PUBLIC_`, admin-panel, mobile, or source-control variables.
  - [x] Implemented a small server-side HTTPS Razorpay client with timeouts and sanitized errors; Orders API and secrets remain backend-only.
  - [x] Evolved `requireAuth` to verify encrypted web sessions and Supabase access tokens with Auth, then load the authoritative profile role.
  - [x] Added `hasActiveBatchAccess(userId, batchId)` backed by the shared database entitlement RPC; includes explicit administrator access.
  - [x] Protected course structure and progress/history writes; restricted direct course-table reads through RLS; public search limited to batch metadata.
  - [ ] Before paid assets are published, add private paid-file Storage and authenticated signed downloads; public URLs cannot be secured by course-table RLS alone.

  **6.3 — Orders, verification, and webhooks**

  - [x] Implemented authenticated create-order with batchId-only input, server-loaded active/paid/payment-enabled batch checks, existing-access rejection, exact decimal-to-paise conversion, and local receipt metadata.
  - [x] Persist the pending payment before returning `{ orderId, amount, currency: 'INR', keyId }`. The public Razorpay key ID may be returned; the secret never is. No supplied amount, user ID, batch price, payment status, or enrollment status is accepted.
  - [x] Replace `POST /api/payments/verify` input with only Razorpay callback identifiers (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`). Look up the pending payment/order locally, verify ownership and amount/currency against Razorpay server data, compute `HMAC_SHA256(order_id + '|' + payment_id, RAZORPAY_KEY_SECRET)`, compare with `timingSafeEqual`, then call the transactional finalizer. A repeat call returns the same safe entitlement state rather than creating duplicates.
  - [x] Add `POST /api/payments/razorpay/webhook` before JSON parsing or with route-specific raw-body capture. Verify `X-Razorpay-Signature` over the exact raw body with `RAZORPAY_WEBHOOK_SECRET`, persist the Razorpay event ID first, and process `payment.captured`/`order.paid` idempotently. When a captured payment has a pending local payment but no enrollment, invoke the same finalizer. For `payment.failed`, mark only the matching pending payment failed; never create or revoke an existing valid enrollment.
  - [x] Added owner-only status reconciliation and pending confirmation handling. Provider-confirmed captured payments can finalize before a webhook; an authorized payment or client success alone never grants access.

  **6.4 — Web UI and Admin CMS (implemented; external payment testing outstanding)**

  Implementation and authenticated Admin inspection are complete as recorded in Payment Step 5 above. The following describes the implemented design; Razorpay Dashboard mode/amount confirmation and actual transactions/webhook delivery are still unverified.

  - Load Razorpay Checkout (`https://checkout.razorpay.com/v1/checkout.js`) only after a server order is created. Replace the fake card/UPI fields and simulated delay in `PaymentModal.tsx` with Razorpay Checkout callbacks. On handler success call the new verify API, refresh enrollments, and only then show **Payment Successful / Start Learning**. Show **Payment received. Confirmation pending.** when status is pending.
  - Add one explicitly labelled **₹1,000 Razorpay test-payment batch** in the existing admin CMS, configured with `is_paid = true`, `payment_enabled = false` until Orders + Checkout is live, and `razorpay_payment_button_id = 'pl_TYDEnuuLchDM7E'`. Confirm in the Razorpay Dashboard that this button is test-mode and priced at ₹1,000 before exposing it to any tester.
  - Add a small isolated test-only page/component that renders Razorpay's official payment-button form exactly with `https://checkout.razorpay.com/v1/payment-button.js` and `data-payment_button_id="pl_TYDEnuuLchDM7E"`. It is for validating the Razorpay button itself only; it must display **“Payment test only — course access is not granted by this button.”** and must not create an enrollment, call the success endpoint, or be used for the paid-batch purchase CTA.
  - After webhook handling is implemented, record matching button webhook events as payment audit entries only. Do not map a static-button event to a user/batch entitlement because the button flow does not securely bind the signed-in C50 user and the exact batch. Remove or hide the test button before production launch unless a separate, reviewed use case remains.
  - Preserve free enrollment unchanged through the existing free-only endpoint. For paid, not-enrolled batches show **BUY NOW**; active enrollment shows **START LEARNING**. Re-check entitlement before navigation to the player and handle a backend `403` gracefully.
  - Extend `admin-panel/src/types.ts` and BatchesCMS.tsx (historical reference) with `isPaid`, `paymentEnabled`, and `razorpayPaymentButtonId`. Add the two payment controls, validate that payment-enabled implies paid plus a positive price, send only the button ID/reference (never secrets), and map snake_case fields. Mirror those changes in `C50-Project/src/types.ts` and its legacy `AdminDashboard.tsx` if that CMS remains reachable.
  - Keep the button ID as optional administrative reference/future migration data; production access is always based on Orders + Checkout + server verification, not a static Razorpay Payment Button.

  **6.5 — Android shared entitlement flow**

  - Remove direct paid-enrollment inserts from BatchDetailScreen.tsx (historical reference). Free enrollment may use the same Express free-enrollment API once mobile authentication support is added; it must not create paid entitlements directly in Supabase.
  - Add `EXPO_PUBLIC_API_URL` only for the public Express URL. Use the authenticated Supabase access token to call the same `create-order`, `verify`, entitlement/status, and protected-course APIs. Do not add Razorpay secret credentials to Expo.
  - Select and implement a supported Razorpay mobile Checkout integration (native SDK or WebView only if Razorpay supports the final approach) that submits the same order/payment/signature identifiers to Express. It may have a platform-specific UI, but it cannot have a separate payments table, separate verification path, or client-side enrollment logic.
  - Require backend entitlement before CoursePlayer navigation/data fetch; update Dashboard/Batch Detail queries to consider only active enrollments and handle pending payment state.

  **6.6 — Tests, rollout, and observability**

  - Add unit/integration coverage for paise conversion, HMAC verification, invalid/foreign order IDs, tampered amounts, duplicate callbacks, duplicate webhooks, captured-without-enrollment repair, failed payments, free enrollment preservation, and `403` paid-course access without entitlement.
  - Use Razorpay test mode first. Exercise success, failure, cancellation, delayed webhook, webhook retry, and verification-before-webhook scenarios with controlled test users/batches. Verify payment/enrollment RLS still prevents cross-user reads and direct paid inserts.
  - Log only local payment IDs, Razorpay IDs, event IDs, and state transitions—never secrets, signatures, card data, or full webhook payloads. Add an admin-only payment status/reconciliation view based on the existing ledger.
  - Deploy backend environment variables to Render, configure Razorpay webhook URL to the Render HTTPS endpoint, configure the exact allowed web/admin origins, run staging smoke tests, then enable `payment_enabled` batch-by-batch. Do not enable live paid checkout until all test-mode checks pass.

- [ ] **7. Test the full production path**
  - Validate auth, password reset, admin CMS, uploads, free enrollment, paid enrollment, progress, history, streaks, dashboard statistics, and unauthorized access.
  - Run TypeScript/build checks, Supabase security advisors, and endpoint smoke tests against staging or controlled test records.

- [ ] **8. Deploy**
  - Commit the backend, migrations, and deployment configuration to GitHub.
  - Deploy `C50-Project` as one Render Web Service (React frontend plus Express API), with `/health` and production environment variables.
  - Deploy `admin-panel` as a separate static site and add only that site’s exact origin to backend CORS.
  - Configure Supabase Auth redirect URLs, Render custom domain, monitoring/log review, and a post-deploy smoke test.

## Current architecture target

```text
Student web app + Express API (Render)
                ↓
             Supabase
       Auth · PostgreSQL · Storage

Admin CMS (static host) ────────────┘
Mobile app (Expo) ──────────────────┘
```
