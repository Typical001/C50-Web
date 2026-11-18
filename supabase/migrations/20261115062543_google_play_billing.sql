-- Google Play tokens and account bindings are never exposed through client APIs.
create table public.google_play_products (
  batch_id uuid primary key references public.batches(id) on delete restrict,
  product_id text not null unique check (product_id ~ '^[a-z][a-z0-9_.]{1,99}$'),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.google_play_products enable row level security;
revoke all on public.google_play_products from anon, authenticated;
grant select on public.google_play_products to authenticated;
grant all on public.google_play_products to service_role;
create policy play_mapping_admin_read on public.google_play_products for select to authenticated
using (exists(select 1 from public.profiles where id=auth.uid() and role='admin'));

create table public.google_play_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid not null unique default gen_random_uuid()
);
create table public.google_play_purchases (
  token_hash text primary key check (length(token_hash)=64),
  purchase_token text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete restrict,
  product_id text not null references public.google_play_products(product_id) on update restrict,
  payment_id uuid unique references public.payments(id) on delete cascade,
  state text not null check (state in ('PURCHASED','PENDING','CANCELLED')),
  acknowledged boolean not null default false,
  checked_at timestamptz not null default now()
);
alter table public.google_play_accounts enable row level security;
alter table public.google_play_purchases enable row level security;
revoke all on public.google_play_accounts, public.google_play_purchases from anon, authenticated;
grant all on public.google_play_accounts, public.google_play_purchases to service_role;
create index google_play_reconciliation on public.google_play_purchases(checked_at);
alter table public.payments add column google_product_id text, add column google_is_test boolean;

create or replace function public.record_google_play_purchase(
 p_hash text, p_token text, p_user uuid, p_batch uuid, p_product text,
 p_state text, p_order text, p_test boolean
) returns uuid language plpgsql security definer set search_path='' as $$
declare existing public.google_play_purchases; result uuid; payment_status text;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service only'; end if;
 if p_state not in ('PURCHASED','PENDING','CANCELLED') then raise exception 'Invalid state'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_hash,0));
 select * into existing from public.google_play_purchases where token_hash=p_hash for update;
 if found and (existing.user_id<>p_user or existing.batch_id<>p_batch or existing.product_id<>p_product or existing.purchase_token<>p_token) then
   raise exception 'Purchase binding mismatch';
 end if;
 if not exists(select 1 from public.google_play_products where batch_id=p_batch and product_id=p_product) then raise exception 'Product mismatch'; end if;
 -- A terminal cancellation cannot be undone by a concurrent older verification response.
 if existing.state='CANCELLED' then p_state:='CANCELLED'; end if;
 if existing.state='PURCHASED' and p_state='PENDING' then p_state:='PURCHASED'; end if;
 payment_status:=case p_state when 'PURCHASED' then 'success' when 'CANCELLED' then 'refunded' else 'pending' end;
 result:=existing.payment_id;
 if result is null then
   insert into public.payments(user_id,batch_id,payment_gateway,amount,status,currency,gateway_order_id,google_product_id,google_is_test,verified_at)
   values(p_user,p_batch,'google_play',0,payment_status,'INR',coalesce(p_order,''),p_product,p_test,case when p_state='PURCHASED' then now() end)
   returning id into result;
 else
   update public.payments set status=payment_status, gateway_order_id=coalesce(p_order,gateway_order_id),
     verified_at=case when p_state='PURCHASED' then coalesce(verified_at,now()) else verified_at end, updated_at=now()
   where id=result;
 end if;
 insert into public.google_play_purchases(token_hash,purchase_token,user_id,batch_id,product_id,payment_id,state)
 values(p_hash,p_token,p_user,p_batch,p_product,result,p_state)
 on conflict(token_hash) do update set state=excluded.state, checked_at=now();
 if p_state='PURCHASED' and existing.state is distinct from 'PURCHASED' then
   insert into public.enrollments(user_id,batch_id,status,access_type,payment_id)
   values(p_user,p_batch,'active','paid',result)
   on conflict(user_id,batch_id) do update set status='active',access_type='paid',payment_id=excluded.payment_id;
 end if;
 return result;
end $$;
revoke all on function public.record_google_play_purchase(text,text,uuid,uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.record_google_play_purchase(text,text,uuid,uuid,text,text,text,boolean) to service_role;

-- Any surviving verified payment supports the single shared enrollment.
create or replace function public.has_active_batch_access(p_user_id uuid,p_batch_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
select (coalesce(auth.role(),'')='service_role' or p_user_id=auth.uid()) and exists(
 select 1 from public.batches b where b.id=p_batch_id and (
 exists(select 1 from public.profiles where id=p_user_id and role='admin') or
 (b.is_active and exists(select 1 from public.enrollments e where e.user_id=p_user_id and e.batch_id=b.id and e.status='active' and (
 not b.is_paid or (e.access_type='paid' and exists(select 1 from public.payments p
 where p.user_id=e.user_id and p.batch_id=e.batch_id and p.status='success' and p.verified_at is not null and (
 (coalesce(p.payment_gateway,'razorpay')='razorpay' and p.amount>0 and p.currency='INR' and coalesce(p.razorpay_order_id,'')<>'' and coalesce(p.razorpay_payment_id,'')<>'') or
 (p.payment_gateway='google_play' and exists(select 1 from public.google_play_purchases g where g.payment_id=p.id and g.state='PURCHASED'))
 )))))))
);
$$;

revoke all on function public.has_active_batch_access(uuid,uuid) from public,anon;
grant execute on function public.has_active_batch_access(uuid,uuid) to authenticated,service_role;
