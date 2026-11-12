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
