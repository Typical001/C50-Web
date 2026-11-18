create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
revoke all on schema net from public, anon, authenticated;
create schema if not exists c50_private;
revoke all on schema c50_private from public, anon, authenticated;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'c50_google_play_reconcile') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'c50_google_play_reconcile', 'Private scheduled Google Play reconciliation authentication');
  end if;
end $$;

create or replace function public.validate_google_play_reconcile_token(p_token text)
returns boolean language sql security definer set search_path = '' as $$
  select length(p_token) between 32 and 256 and exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'c50_google_play_reconcile'
      and extensions.digest(s.decrypted_secret, 'sha256') = extensions.digest(p_token, 'sha256')
  );
$$;
revoke all on function public.validate_google_play_reconcile_token(text) from public, anon, authenticated;
grant execute on function public.validate_google_play_reconcile_token(text) to service_role;

create table c50_private.play_reconciliation_requests (
  request_id bigint primary key,
  created_at timestamptz not null default now()
);
alter table c50_private.play_reconciliation_requests enable row level security;
revoke all on c50_private.play_reconciliation_requests from public, anon, authenticated;

create function c50_private.enqueue_play_reconciliation()
returns bigint language plpgsql security invoker set search_path = '' as $$
declare v_secret text; v_id bigint;
begin
  select decrypted_secret into strict v_secret from vault.decrypted_secrets where name = 'c50_google_play_reconcile';
  select net.http_post(
    url := 'https://c50-web.onrender.com/api/google-play/reconcile',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb, timeout_milliseconds := 180000
  ) into v_id;
  insert into c50_private.play_reconciliation_requests(request_id) values (v_id);
  delete from c50_private.play_reconciliation_requests where created_at < now() - interval '30 days';
  return v_id;
end $$;
revoke all on function c50_private.enqueue_play_reconciliation() from public, anon, authenticated;

select cron.schedule('c50-google-play-reconcile', '*/10 * * * *', 'select c50_private.enqueue_play_reconciliation();');
-- Activate only after deploying the matching server verifier and validating one request.
select cron.alter_job(jobid, active := false) from cron.job where jobname = 'c50-google-play-reconcile';
