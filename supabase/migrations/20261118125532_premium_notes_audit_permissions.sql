-- Supabase default privileges may grant ALL to service_role at table creation.
-- Explicitly remove mutation privileges rather than relying on a narrower GRANT.
revoke all on public.premium_note_events from service_role;
grant select, insert on public.premium_note_events to service_role;
