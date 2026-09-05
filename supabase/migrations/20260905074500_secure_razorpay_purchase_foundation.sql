-- Secure Razorpay purchase foundation. This migration is additive and preserves
-- the existing batch, payment, and enrollment records.

alter table public.batches
  add column if not exists payment_enabled boolean not null default false,
  add column if not exists razorpay_payment_button_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'batches_payment_enabled_requires_paid_batch'
      and conrelid = 'public.batches'::regclass
  ) then
    alter table public.batches
      add constraint batches_payment_enabled_requires_paid_batch
      check (
        not payment_enabled
        or (is_paid = true and coalesce(is_free, false) = false and coalesce(discount_price, price, 0) > 0)
      );
  end if;
end;
$$;

alter table public.payments
  add column if not exists currency text not null default 'INR',
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_signature text,
  add column if not exists payment_method text,
  add column if not exists failure_code text,
  add column if not exists failure_description text,
  add column if not exists updated_at timestamptz not null default now();

-- Preserve historical mock/legacy records while making the Razorpay names the
-- canonical fields for all new production payment flows.
update public.payments
set razorpay_order_id = nullif(gateway_order_id, '')
where razorpay_order_id is null
  and nullif(gateway_order_id, '') is not null;

update public.payments
set razorpay_payment_id = nullif(gateway_payment_id, '')
where razorpay_payment_id is null
  and nullif(gateway_payment_id, '') is not null;

create unique index if not exists payments_razorpay_order_id_unique
  on public.payments (razorpay_order_id)
  where razorpay_order_id is not null;

create unique index if not exists payments_razorpay_payment_id_unique
  on public.payments (razorpay_payment_id)
  where razorpay_payment_id is not null;

alter table public.enrollments
  add column if not exists payment_id uuid references public.payments(id) on delete restrict,
  add column if not exists enrolled_at timestamptz not null default now();

update public.enrollments
set enrolled_at = created_at
where enrolled_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'paid_enrollment_requires_payment'
      and conrelid = 'public.enrollments'::regclass
  ) then
    alter table public.enrollments
      add constraint paid_enrollment_requires_payment
      check (access_type <> 'paid' or payment_id is not null);
  end if;
end;
$$;

create table if not exists public.payment_webhook_events (
  id uuid primary key default uuid_generate_v4(),
  razorpay_event_id text not null unique,
  event_type text not null,
  payload_hash text not null,
  payment_id uuid references public.payments(id) on delete set null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  processing_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists payment_webhook_events_payment_id_idx
  on public.payment_webhook_events(payment_id);

alter table public.payment_webhook_events enable row level security;

drop policy if exists admins_can_manage_payment_webhook_events on public.payment_webhook_events;
create policy admins_can_manage_payment_webhook_events
  on public.payment_webhook_events
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Keep payment timestamps trustworthy even when future server flows update a
-- payment from pending to successful or failed.
create or replace function public.set_payment_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_payment_updated_at() from public, anon, authenticated;

drop trigger if exists set_payment_updated_at on public.payments;
create trigger set_payment_updated_at
  before update on public.payments
  for each row execute function public.set_payment_updated_at();

-- Called only after Express has verified Razorpay's checkout signature or a
-- signed webhook. Row locking plus the unique constraints makes retries safe:
-- a captured payment with a missing enrollment is repaired, not duplicated.
create or replace function public.finalize_razorpay_payment(
  p_payment_id uuid,
  p_razorpay_payment_id text,
  p_razorpay_signature text,
  p_payment_method text default null
)
returns table (
  payment_id uuid,
  enrollment_id uuid,
  payment_status text,
  enrollment_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_row public.payments%rowtype;
  enrollment_row public.enrollments%rowtype;
begin
  select * into payment_row
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found';
  end if;

  if payment_row.status = 'failed' then
    raise exception 'A failed payment cannot be finalized';
  end if;

  if payment_row.status = 'success'
    and payment_row.razorpay_payment_id is not null
    and payment_row.razorpay_payment_id <> p_razorpay_payment_id then
    raise exception 'Payment is already finalized with a different Razorpay payment ID';
  end if;

  update public.payments
  set status = 'success',
      razorpay_payment_id = coalesce(razorpay_payment_id, p_razorpay_payment_id),
      razorpay_signature = coalesce(razorpay_signature, p_razorpay_signature),
      payment_method = coalesce(payment_method, p_payment_method)
  where id = p_payment_id;

  insert into public.enrollments (
    user_id, batch_id, payment_id, status, access_type, enrolled_at
  )
  values (
    payment_row.user_id, payment_row.batch_id, p_payment_id, 'active', 'paid', now()
  )
  on conflict (user_id, batch_id) do update
  set payment_id = excluded.payment_id,
      status = 'active',
      access_type = 'paid',
      enrolled_at = coalesce(public.enrollments.enrolled_at, excluded.enrolled_at)
  returning * into enrollment_row;

  return query
  select p_payment_id, enrollment_row.id, 'success'::text, enrollment_row.status;
end;
$$;

revoke all on function public.finalize_razorpay_payment(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_razorpay_payment(uuid, text, text, text)
  to service_role;
