begin;

-- Existing success labels (including simulator records) are not proof of capture.
alter table public.payments add column if not exists verified_at timestamptz;

create or replace function public.has_active_batch_access(p_user_id uuid, p_batch_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (coalesce(auth.role(), '') = 'service_role' or p_user_id = auth.uid())
    and exists (
      select 1 from public.batches b where b.id = p_batch_id and (
        exists (select 1 from public.profiles pr where pr.id = p_user_id and pr.role = 'admin')
        or (b.is_active and exists (
          select 1 from public.enrollments e where e.user_id = p_user_id
          and e.batch_id = b.id and e.status = 'active' and (
            not b.is_paid or (e.access_type = 'paid' and exists (
              select 1 from public.payments p where p.id = e.payment_id
              and p.user_id = e.user_id and p.batch_id = e.batch_id
              and p.status = 'success' and p.verified_at is not null
              and p.amount > 0 and p.currency = 'INR'
              and nullif(p.razorpay_order_id, '') is not null
              and nullif(p.razorpay_payment_id, '') is not null
            ))
          )
        ))
      )
    );
$$;
revoke all on function public.has_active_batch_access(uuid,uuid) from public, anon;
grant execute on function public.has_active_batch_access(uuid,uuid) to authenticated, service_role;

-- Restrictive policies also constrain existing permissive policies. No RLS is disabled.
create policy course_entitlement_lectures on public.lectures as restrictive
for select to authenticated using (public.has_active_batch_access(auth.uid(), batch_id));
create policy course_entitlement_subjects on public.subjects as restrictive
for select to authenticated using (public.has_active_batch_access(auth.uid(), batch_id));
create policy course_entitlement_chapters on public.chapters as restrictive
for select to authenticated using (exists (
  select 1 from public.subjects s where s.id = subject_id
  and public.has_active_batch_access(auth.uid(), s.batch_id)
));
create policy anonymous_lecture_block on public.lectures as restrictive for select to anon using (false);
create policy anonymous_subject_block on public.subjects as restrictive for select to anon using (false);
create policy anonymous_chapter_block on public.chapters as restrictive for select to anon using (false);

create policy course_entitlement_progress on public.lecture_progress as restrictive
for all to authenticated using (exists (select 1 from public.lectures l where l.id = lecture_id))
with check (exists (select 1 from public.lectures l where l.id = lecture_id));
create policy course_entitlement_history on public.watch_history as restrictive
for all to authenticated using (exists (select 1 from public.lectures l where l.id = lecture_id))
with check (exists (select 1 from public.lectures l where l.id = lecture_id));

-- Prevent a student from assigning themselves an admin role via profile UPDATE.
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role and current_user in ('authenticated','anon') then
    raise exception 'Profile role changes require a trusted server' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_profile_role() from public, anon, authenticated;
create trigger protect_profile_role before update on public.profiles
for each row execute function public.protect_profile_role();

-- Only the trusted finalization transaction may establish verification evidence.
-- Keep its existing locking, ownership mapping, and idempotency behavior.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.finalize_razorpay_payment(uuid,text,text,text)'::regprocedure) into definition;
  if position('verified_at =' in definition) = 0 then
    if position('set status = ''success'',' in definition) = 0 then
      raise exception 'Unexpected finalizer definition; review before migration';
    end if;
    definition := replace(definition, 'set status = ''success'',',
      'set status = ''success'', verified_at = coalesce(verified_at, now()),');
    execute definition;
  end if;
end;
$$;
commit;
