# Roadmap — Shared platform

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
