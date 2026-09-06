begin;
-- Keep amount in rupees for existing history UI; freeze exact provider subunits separately.
alter table public.payments add column if not exists amount_paise bigint,
  add column if not exists gateway_mode text;
alter table public.payments add constraint payment_provider_snapshot_valid check (
  (amount_paise is null and gateway_mode is null) or
  (amount_paise is not null and amount_paise > 0 and amount_paise <= 9007199254740991
    and gateway_mode is not null and gateway_mode in ('test','live') and currency = 'INR'
    and amount * 100 = amount_paise)
);
-- Concurrent Buy Now requests cannot create separate open checkout intents.
-- Historical records remain untouched and outside this new-intent index.
create unique index payments_one_pending_purchase on public.payments(user_id,batch_id)
  where status = 'pending' and amount_paise is not null;

create or replace function public.finalize_razorpay_payment(
  p_payment_id uuid, p_razorpay_payment_id text, p_razorpay_signature text,
  p_payment_method text default null
)
returns table (payment_id uuid, enrollment_id uuid, payment_status text, enrollment_status text)
language plpgsql security definer set search_path = '' as $$
declare payment_row public.payments%rowtype; enrollment_row public.enrollments%rowtype;
begin
  select * into payment_row from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if payment_row.amount_paise is null or payment_row.gateway_mode is null
    or payment_row.razorpay_order_id is null or payment_row.razorpay_order_id !~ '^order_[A-Za-z0-9]+$'
    or p_razorpay_payment_id is null or p_razorpay_payment_id !~ '^pay_[A-Za-z0-9]+$' then
    raise exception 'Payment lacks a valid provider snapshot';
  end if;
  if payment_row.razorpay_payment_id is not null and payment_row.razorpay_payment_id <> p_razorpay_payment_id then
    raise exception 'Payment has a different provider payment ID';
  end if;
  -- A failed attempt may be followed by a captured retry for the same order.
  -- Only trusted Express verification can invoke this transaction.
  update public.payments set status = 'success', verified_at = coalesce(verified_at, now()),
    razorpay_payment_id = p_razorpay_payment_id,
    razorpay_signature = coalesce(razorpay_signature, p_razorpay_signature),
    payment_method = coalesce(payment_method, p_payment_method),
    failure_code = null, failure_description = null
  where id = p_payment_id;
  insert into public.enrollments(user_id,batch_id,payment_id,status,access_type,enrolled_at)
  values(payment_row.user_id,payment_row.batch_id,p_payment_id,'active','paid',now())
  on conflict(user_id,batch_id) do update set payment_id=excluded.payment_id,
    status='active',access_type='paid',enrolled_at=coalesce(public.enrollments.enrolled_at,excluded.enrolled_at)
  returning * into enrollment_row;
  return query select p_payment_id,enrollment_row.id,'success'::text,enrollment_row.status;
end;
$$;
revoke all on function public.finalize_razorpay_payment(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finalize_razorpay_payment(uuid,text,text,text) to service_role;
commit;
