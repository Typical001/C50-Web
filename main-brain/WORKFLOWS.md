# Workflows — Web and backend

Last consolidated: 2026-11-09. Local source/configuration reviewed; historical test and hosted observations are dated below. This documentation pass did not rerun application tests or inspect live services.

## Development and validation

From C50-Project: install with npm ci, configure ignored environment using [.env.example](../.env.example), run npm run dev (default port 3000). Run npm run lint, npm run test:payments, npm run test:recovery and npm run build. Production starts with npm start. Do not execute destructive clean commands merely to inspect documentation.

## Student journey

Register/login → catalog → batch → free enrollment or server-created paid checkout → verified enrollment → subjects → chapters → lectures → video/notes and progress. CMS controls homepage sections, faculty and syllabus. Refresh errors must not become false access/success. Check session expiry, unpaid denial, missing content and network failures. Recovery uses a newly requested email and the isolated recovery screen; see [recovery procedure](../docs/password-recovery.md).

## Payments and operations

Use [payment runbook](../docs/payments.md). Run controlled Test-mode success/failure/cancellation/delayed-webhook/retry cases before enabling live purchases. Confirm exact user/batch enrollment, idempotency and cross-user denial. Reconcile pending purchases through the owner-scoped status endpoint; do not invent a second order after ambiguous provider timeouts. Refund/dispute handling remains undefined operational work.

## Deployment

Historical host: https://c50-web.onrender.com, Render Singapore free Node service, repository Typical001/C50-Web (web folder at repository root). Recorded build command: npm ci --include=dev && npm run lint && npm run test:payments && npm run build; start npm start; health /health. Confirm actual host settings before changes; free service sleeping was recorded. New recovery tests should also be run during validation even though the historical host command does not include them.

After deployment, record revision/deploy ID/date and test public homepage/catalog/health, auth denial, untrusted-origin denial, intended exact origins and controlled authenticated journeys. Validate actual HTTPS privacy/deletion/terms content, not merely HTTP status. Verify webhook provider deliveries independently from unsigned-request rejection. No deployments are triggered by maintaining these documents.

## Support and governance

[Account deletion](../docs/account-deletion.md) requires monitored inbox, ownership verification, reviewed deletion/retention procedure and completion evidence. Do not log credentials or request recovery tokens. Owner-confirmed policy timings need operational/legal review. Existing tokens/custom sessions must be addressed in fulfilment. Coordinate shared schema/API changes with [Mobile](../../c50-mobile/main-brain/README.md) and [Admin](../../admin-panel/main-brain/README.md).

## Test Series workflow — 2026-11-12

1. In standalone Admin open Test Series → Add Test Series. Enter metadata/images and free or paid settings. New series start unlisted; use Preview to inspect metadata. Save keeps a stable row ID.
2. Use Content to configure existing subjects/chapters/lectures/attachments. Publish with the catalog checkbox when ready. For paid series, set a positive price and explicitly enable payments. Do not use public files for confidential paid content without addressing the existing shared media-security gap.
3. Website desktop/mobile navigation and Android Test Series display the same records. Both customer catalogs refresh on entry/foreground/manual refresh and every 30 seconds while active (Android also requires focus). Verify free/paid filters and loading/error/empty states.
4. Remove from sale to hide a series and prevent new purchases. Existing students keep access in their learning dashboard; payment/enrollment records are preserved. Edit and recheck the catalog checkbox to republish. Do not delete database rows to remove a listing.
5. Test one free and one paid series with controlled accounts: student/Admin permissions, duplicate submits, withdrawn discovery, retained access and delayed capture. Supabase verification used rolled-back fixtures; actual user/payment/device E2E is still pending.
6. Deploy backend/web and Admin before expecting the UI to appear on hosted services. Build a fresh Android APK and test both themes; a Metro export is not an APK or a release.

## Payment verification — 2026-11-12

Follow the [updated checkout test/deployment procedure](../docs/payments.md). Check the same student purchase on website, direct Android and Admin Payments; pending/cancelled payments cannot grant access. Local checks passed as recorded in CURRENT-STATE; hosted deployment and actual payment/webhook/device tests remain outstanding.

## Per-lecture Google Drive PDF notes — 2026-11-12

In Admin → Batch Content Manager, select batch, subject and chapter, then add/edit a lecture. Paste a Drive PDF file-sharing URL into Notes PDF URL / Drive Link, optionally set Notes Title, use Open link to confirm the file and viewing permissions, then save. Alternatively retain Upload Note to Supabase. Folder links and non-HTTPS/credential-bearing URLs cannot be saved through this form. A valid link is not proof of PDF content or student access.

Reopen the lecture to verify its saved link and PDF indicator. On the website open the lecture's Notes tab → PDF Notes; Drive opens in a new tab, while direct PDFs also retain the reader. On Android open the lecture → PDF Notes; entitlement is checked before opening the external handler. Drive may require a Google account with permission. Public sharing allows anyone with the link to view; do not treat that as private paid-content delivery. Publish/deploy updated applications and rebuild Android separately from saving content.
