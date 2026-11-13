# Decisions — Shared platform

Last consolidated: 2026-11-09. Local source/configuration reviewed; historical test and hosted observations are dated below. This documentation pass did not rerun application tests or inspect live services.

| Decision | Rationale / consequence |
| --- | --- |
| Existing Express API is the shared purchase authority | Web and Android cannot independently grant paid access |
| Supabase replaces production JSON state | Durable cross-client state; db.json is historical, not an active fallback contract |
| Server-derived prices and provider-confirmed capture | Client success/amount/status cannot grant enrollment |
| Transactional finalizer plus unique events/orders | Retry and duplicate delivery do not create duplicate entitlements |
| Public free assets retained temporarily | Compatibility preserved; paid-media security remains explicit release work |
| Publishable client keys and protected server secrets | Frontend bundles cannot carry administrative credentials |
| Implicit isolated recovery session | Existing configured email flow retained; missing/expired credentials fail safely |
| Manual deletion request channel | Page communicates a process; fulfilment implementation is a separate responsibility |
| 2026-11-09 Main Brain consolidation | Current facts separated from dated evidence; shared contracts documented here once |

These record implemented choices, not new approvals. Product policy choices in historical Terms/deletion notes require owner review before publication. Source evidence: [architecture](ARCHITECTURE.md), [payment](../docs/payments.md), [recovery](../docs/password-recovery.md), [deletion](../docs/account-deletion.md).

## Test Series decisions — 2026-11-12

User selected catalog synchronization only and removal that preserves existing access. Reuse one Supabase batch row per series rather than creating competing catalogs. Keep exam category independent from the reserved Test Series tag; recognize historical category/custom-tag markers. Use a separate listed-for-sale flag, not `is_active`, because the latter gates learning access. New series start as drafts until the Admin explicitly publishes them. All new enrollments go through the existing authenticated server API; browser/mobile clients cannot insert enrollment rows directly. Existing course purchase restrictions in Play remain unchanged.

## 2026-11-13 — One session authority

Use Supabase SDK sessions on all clients and authoritative server/profile verification. Retire custom Web tokens rather than maintain two revocation paths. Accepted consequence: existing website users sign in again after coordinated deployment. Persist a local logout lock until successful explicit authentication so network failure cannot restore old identity. This does not provide immediate global JWT revocation.
