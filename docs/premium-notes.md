# Premium Notes: external forms and manual verification

## Contract (implemented November 18, 2026)

Premium Notes is separate from batch enrollment, lecture notes, Razorpay payments and Google Play Billing. A listing is an individual PDF or a standalone bundle delivered externally. C50 hosts no paid PDF files and does not import Google Form submissions or payment-proof uploads.

The website and both Android variants, including the Play/AAB package, show Buy for published listings. The external link comes only from Admin configuration. This Play behavior was explicitly requested by the owner; this implementation is not evidence of Play policy eligibility or approval. A Google Form that collects external-payment proof remains an external purchase flow. Review the applicable [Google Play Payments requirements](https://support.google.com/googleplay/android-developer/answer/9858738) before publishing. Existing batch billing gates remain unchanged.

## Admin workflow

1. Open Premium Notes in the separate Admin panel. Add a title, description, note/bundle type, INR price, optional cover, included-content description, delivery instructions and HTTPS checkout/form URL. Publish only after checking the real form and seller's workflow. Uncheck Published to archive; do not delete purchase history.
2. Configure the form to collect the C50 account email and request reference so submissions can be matched manually. Do not request passwords, payment PINs or CVV. No form or seller has been invented or published by this implementation.
3. Review requests in the paginated queue. Status filters apply to the full queue; email/title/reference search applies to the current page. Review the actual form submission and external payment record independently of C50's Pending status.
4. Record Purchased or Rejected with an internal verification reason. Mark delivery separately only after arranging delivery. Corrections require a reason and retain prior decisions in history. Concurrent stale edits are rejected; reload before trying again.

## Customer workflow

Sign in, open Premium Notes, select a listing and tap Buy. The backend creates or reuses one request per authenticated user/product before opening the external URL. Pending means checkout was requested, not that the form was submitted or payment was confirmed. The request reference is available on the C50 detail screen for copying into the form. Reopen form retries without creating another request. Rejected requests can be reopened while the listing is published; Purchased requests never initiate another checkout.

The website retains its detail view in the original tab. Android uses the device URL handler and retains its detail screen. Failed opening leaves the saved request available for retry. Clients refresh on return/focus, every 30 seconds while visible, and manually. Purchased status and delivery information synchronize by C50 account. Logout/account switching remounts the screens and existing session transport rejects late responses.

## API and database

- `GET /api/premium-notes`: published catalog, without checkout URLs or delivery instructions.
- `GET /api/premium-notes/mine`: authenticated user's requests, including archived products they requested; delivery instructions appear only after Purchased.
- `POST /api/premium-notes/:id/request`: authenticated request creation/reuse. User identity is derived from the verified session, never the body. Returns the request and current validated checkout URL; Purchased returns no checkout URL.
- `/api/admin/premium-notes`: administrator GET/POST; `PUT /:id` requires the loaded `updated_at` to prevent overwrites.
- `GET /api/admin/premium-note-requests`: administrator queue with pagination and status filtering. Customer emails are resolved server-side only for displayed records.
- `POST /api/admin/premium-note-requests/:id`: administrator decision, delivery status, reason and expected `updated_at`.
- `GET /api/admin/premium-note-requests/:id/history`: administrator-only decision history.

Tables: `premium_note_products`, `premium_note_requests`, `premium_note_events`. Amounts are integer INR paise. Requests snapshot title and listed price; these are not gateway-confirmed transaction totals. Unique `(user_id, product_id)` prevents duplicates. Transactions serialize status changes and audit insertion. Direct anon/authenticated table and RPC privileges are revoked, RLS enabled, and Express authorizes every private operation. Audit grants allow service-role SELECT/INSERT only, explicitly overriding Supabase's default ALL grants. User deletion cascades owned requests/events; deletion of an administrator nulls their historical actor reference.

Migrations: `20261118082723_premium_notes.sql` and `20261118125532_premium_notes_audit_permissions.sql`. Both were applied to the connected project on November 18. Post-migration checks found all three tables protected, zero products/requests and no client RPC execution privilege. Audit UPDATE/DELETE denied for service_role; INSERT allowed. RLS-no-policy advisor notices for these server-only tables are intentional; this is not a claim that all pre-existing project advisories are resolved.

## Validation and release checklist

- Web TypeScript and production build; Admin lint/build; Android TypeScript and Play Metro export passed locally. Admin lint retains pre-existing warnings outside this feature; Web retains the existing large-chunk warning.
- Four focused backend tests cover URLs/prices, real Postgres-compatible migration execution, default-grant hardening, request reuse, account isolation, review authorization, audit preservation, stale writes and archive/retry behavior. Existing payment/session/Google regressions passed (36 tests including the four new tests); 44 Android tests passed.
- `npm run test:premium-notes` runs the focused backend suite. `npm run test:payments` now includes it for deployment checks.
- `scripts/check-premium-notes-ui.mjs` mounts actual Web/Admin components in ignored `dist/qa` fixtures. Run local Vite servers on 5179 and 5180, install Playwright outside the repositories, and set `PLAYWRIGHT_PACKAGE_JSON` to that installation's package.json. It uses installed Chrome and blocks all live external traffic. Tested 1440/768/360 layouts without horizontal overflow, form opening with opener isolation, pending/reopen, Admin approval and customer refresh, edit/save/reload, empty/error/retry and failed-load save lock. Fixture screenshots were visually reviewed. These are component checks, not native-device tests.
- Publish the backend and Admin after migrations. Verify hosted anonymous catalog and protected routes without publishing sample content. Build a fresh production AAB and verify public Supabase configuration in the artifact. Native form-return behavior, physical-device acceptance and Play publication remain separate checks. See Main Brain changelog for actual deployment/build IDs.
