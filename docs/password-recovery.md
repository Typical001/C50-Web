# Password recovery deployment checklist

The web flow uses Supabase's implicit recovery email flow: Supabase verifies the email link, then redirects with `type=recovery`, an access token and a refresh token. The application validates both tokens and the user in an isolated non-persistent session. It removes URL credentials, asks for a strong password twice and clears the recovery session on success. Bare/expired links never reuse an existing login. PKCE/custom token-hash email templates are not configured by this change and are rejected rather than silently falling back.

## Required hosted settings

1. Render backend `APP_URL`: `https://c50-web.onrender.com` (or the actual production origin if changing domains).
2. Supabase Authentication → URL Configuration → Site URL: `https://c50-web.onrender.com`.
3. Add the exact Redirect URL `https://c50-web.onrender.com/reset-password`. Preserve intentionally used local-development redirects; do not use broad production wildcards.
4. Supabase Reset Password email template should use `{{ .ConfirmationURL }}` for this flow. A hard-coded localhost or SiteURL-only reset link is incorrect. Do not replace a customized template without review.
5. Deploy this code, then request a NEW email from the deployed website. Old invalid/consumed links cannot be repaired. Test once with a controlled account; enter the new password yourself, never send recovery links/passwords to chat.

## Validation

Run `npm run test:recovery`, `npm run test:payments`, `npm run lint`, `npm run build`. Check missing-token and expired-link screens, resend, successful update and fresh login, duplicate submission, and mobile-email browser opening. Session revocation of pre-existing custom Express sessions is not implemented by this change; treat that as a separate security task.

The backend rejects malformed emails and insecure/local production APP_URL values. It cannot override a missing Supabase redirect allow-list entry. The old unused `/api/auth/reset-password` token-paste endpoint returns 410; passwords are submitted directly to Supabase Auth from the validated recovery form.

## Operational status (2026-10-27)

Follow-up browser verification: the fix is deployed (live bundle index-C7nbBxqU.js; local repository commit 7335910). Corrected the hosted Site URL from localhost to https://c50-web.onrender.com and added https://c50-web.onrender.com/reset-password to the allow-list, preserving both local-development entries. Verified the saved dashboard list and the live expired-link/resend UI. The email template and successful real-email recovery remain unverified. The user must request a fresh email and complete the reset/login. No email sent, password changed, or live user session revoked during this task.
