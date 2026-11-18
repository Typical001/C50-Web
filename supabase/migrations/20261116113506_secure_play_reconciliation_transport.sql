-- Replace the unused asynchronous queue transport: managed net grants cannot
-- be revoked by postgres on this project. Never enqueue the Vault credential.
create extension if not exists http with schema extensions;
create table c50_private.play_reconciliation_runs (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(),
 status_code integer not null
);
alter table c50_private.play_reconciliation_runs enable row level security;
revoke all on c50_private.play_reconciliation_runs from public, anon, authenticated;
create or replace function c50_private.enqueue_play_reconciliation()
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_secret text; v_status integer; v_id bigint;
begin
 select decrypted_secret into strict v_secret from vault.decrypted_secrets where name='c50_google_play_reconcile';
 begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','180000');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','10000');
  select r.status into v_status from extensions.http((
   'POST','https://c50-web.onrender.com/api/google-play/reconcile',
   array[extensions.http_header('Authorization','Bearer ' || v_secret)],
   'application/json','{}'
  )::extensions.http_request) r;
 exception when others then
  -- Never return provider bodies, headers or underlying error text.
  v_status := 0;
 end;
 perform extensions.http_reset_curlopt();
 insert into c50_private.play_reconciliation_runs(status_code) values(coalesce(v_status,0)) returning id into v_id;
 delete from c50_private.play_reconciliation_runs where created_at < now()-interval '30 days';
 return v_id;
end $$;
revoke all on function c50_private.enqueue_play_reconciliation() from public,anon,authenticated;
-- Remains disabled until server deployment and a successful end-to-end probe.
select cron.alter_job(jobid,active:=false) from cron.job where jobname='c50-google-play-reconcile';
