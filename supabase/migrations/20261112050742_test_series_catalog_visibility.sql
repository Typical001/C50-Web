begin;
alter table public.batches add column catalog_visible boolean not null default true;
create function public.is_test_series(p_category text, p_tag text, p_tags jsonb)
returns boolean language sql immutable security invoker set search_path = ''
as $$
 select exists(select 1 from (
   select p_category as value union all select p_tag
   union all select jsonb_array_elements_text(case when jsonb_typeof(p_tags)='array' then p_tags else '[]'::jsonb end)
 ) terms where lower(regexp_replace(trim(value),'[-_]+',' ','g'))='test series');
$$;
create function public.guard_series_catalog() returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if TG_OP='DELETE' then
   if public.is_test_series(old.category,old.custom_tag,old.tags) then
     raise exception 'Remove test series from sale instead of deleting its records';
   end if;
   return old;
 end if;
 if public.is_test_series(new.category,new.custom_tag,new.tags) then
   if new.is_free is null or new.is_paid is null or new.is_free=new.is_paid
     or new.price is null or new.price<0 or coalesce(new.discount_price,0)<0
     or coalesce(new.discount_price,0)>new.price
     or (new.is_free and (new.price<>0 or coalesce(new.discount_price,0)<>0 or new.payment_enabled))
     or (new.is_paid and new.price<=0) then
       raise exception 'Invalid test series free/paid price settings';
   end if;
 end if;
 if TG_OP='UPDATE' and public.is_test_series(old.category,old.custom_tag,old.tags) then
   if not public.is_test_series(new.category,new.custom_tag,new.tags) then
     raise exception 'Keep the Test Series classification; remove from sale to archive';
   end if;
   if (new.is_paid is distinct from old.is_paid or new.is_active is distinct from old.is_active)
      and (exists(select 1 from public.enrollments where batch_id=old.id)
        or exists(select 1 from public.payments where batch_id=old.id)) then
     raise exception 'Existing purchases require the same access type and active state; change catalog visibility instead';
   end if;
 end if;
 return new;
end; $$;
create trigger guard_series_catalog before insert or update or delete on public.batches
 for each row execute function public.guard_series_catalog();

-- Lock against simultaneous withdrawal while creating a new purchase/enrollment.
create function public.guard_catalog_purchase() returns trigger language plpgsql security invoker set search_path = '' as $$
declare listed boolean;
begin
 if TG_TABLE_NAME='enrollments' then
   if new.access_type<>'free' then return new; end if;
 end if;
 select catalog_visible into listed from public.batches where id=new.batch_id for share;
 if listed is distinct from true then raise exception 'This item is no longer available for new enrollment or purchase'; end if;
 return new;
end; $$;
create trigger guard_catalog_payment before insert on public.payments
 for each row execute function public.guard_catalog_purchase();
create trigger guard_catalog_free_enrollment before insert on public.enrollments
 for each row execute function public.guard_catalog_purchase();
revoke all on function public.guard_series_catalog(), public.guard_catalog_purchase() from public, anon, authenticated;
-- Existing grants/policies remain. Restrict direct discovery but retain entitled reads.
create policy catalog_batch_public_visibility on public.batches as restrictive for select to anon using (catalog_visible);
create policy catalog_batch_visibility on public.batches as restrictive for select to authenticated
 using (catalog_visible or public.is_admin() or public.has_active_batch_access(auth.uid(),id));
alter policy "Admins can update batches" on public.batches using (public.is_admin()) with check (public.is_admin());
commit;
