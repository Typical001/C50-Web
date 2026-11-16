-- Supabase extension installation grants net access through its extension hook.
-- Restrict the HTTP queue after installation, before any secret-bearing request.
revoke all on schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all sequences in schema net from public, anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;
