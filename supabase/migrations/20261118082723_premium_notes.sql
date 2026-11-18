-- External notes requests are not gateway payments or batch enrollments.
create table public.premium_note_products (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null check (length(trim(description)) between 1 and 10000),
  contents text not null default '' check (length(contents) <= 10000),
  kind text not null check (kind in ('note','bundle')),
  price_paise integer not null check (price_paise between 100 and 100000000),
  cover_url text not null default '',
  checkout_url text not null default '',
  delivery_instructions text not null default '' check (length(delivery_instructions) <= 5000),
  published boolean not null default false,
  sort_order integer not null default 0 check (abs(sort_order::bigint) <= 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  check (not published or checkout_url <> ''),
  check (checkout_url = '' or (length(checkout_url) <= 2048 and checkout_url ~ '^https://[^/@[:space:]\\]+([/?#]|$)' and checkout_url !~ '[[:space:]\\]')),
  check (cover_url = '' or (length(cover_url) <= 2048 and cover_url ~ '^https://[^/@[:space:]\\]+([/?#]|$)' and cover_url !~ '[[:space:]\\]'))
);
create table public.premium_note_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.premium_note_products(id),
  title_snapshot text not null,
  price_paise integer not null check (price_paise >= 100),
  status text not null default 'pending' check (status in ('pending','purchased','rejected')),
  delivery_status text not null default 'pending' check (delivery_status in ('pending','delivered')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (user_id, product_id),
  check (status = 'purchased' or delivery_status = 'pending')
);
create index premium_note_requests_review on public.premium_note_requests(status, created_at desc);
create index premium_note_requests_product on public.premium_note_requests(product_id);
create table public.premium_note_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.premium_note_requests(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  status text not null,
  delivery_status text not null,
  reason text not null,
  created_at timestamptz not null default clock_timestamp()
);
create index premium_note_events_request on public.premium_note_events(request_id, created_at desc);
create index premium_note_events_actor on public.premium_note_events(actor_id);
alter table public.premium_note_products enable row level security;
alter table public.premium_note_requests enable row level security;
alter table public.premium_note_events enable row level security;
-- All access goes through the verified Express API. No direct client writes or reads.
revoke all on public.premium_note_products, public.premium_note_requests, public.premium_note_events from public, anon, authenticated;
grant select, insert, update on public.premium_note_products, public.premium_note_requests to service_role;
grant select, insert on public.premium_note_events to service_role;

create function public.request_premium_note(p_product uuid, p_user uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare p public.premium_note_products; r public.premium_note_requests; fresh uuid;
begin
  select * into p from public.premium_note_products where id = p_product for share;
  if not found then raise exception 'Product unavailable'; end if;
  select * into r from public.premium_note_requests where product_id = p_product and user_id = p_user for update;
  if r.status = 'purchased' then return jsonb_build_object('request', to_jsonb(r), 'checkout_url', null); end if;
  if not p.published or p.checkout_url = '' then raise exception 'Product unavailable'; end if;
  insert into public.premium_note_requests(user_id,product_id,title_snapshot,price_paise)
    values(p_user,p_product,p.title,p.price_paise) on conflict (user_id,product_id) do nothing returning id into fresh;
  select * into r from public.premium_note_requests where product_id = p_product and user_id = p_user for update;
  if fresh is not null or r.status = 'rejected' then
    update public.premium_note_requests set status='pending', delivery_status='pending', title_snapshot=p.title, price_paise=p.price_paise, updated_at=clock_timestamp() where id=r.id returning * into r;
    insert into public.premium_note_events(request_id,actor_id,status,delivery_status,reason)
      values(r.id,p_user,'pending','pending',case when fresh is null then 'Customer reopened request' else 'Customer opened external checkout; submission and payment unverified' end);
  end if;
  return jsonb_build_object('request',to_jsonb(r),'checkout_url',case when r.status='purchased' then null else p.checkout_url end);
end $$;

create function public.review_premium_note(p_id uuid,p_actor uuid,p_status text,p_delivery text,p_reason text,p_expected timestamptz) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare r public.premium_note_requests;
begin
  if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Administrator required'; end if;
  if p_reason is null or length(trim(p_reason)) not between 1 and 2000 then raise exception 'Reason required'; end if;
  select * into r from public.premium_note_requests where id=p_id for update;
  if not found or r.updated_at is distinct from p_expected then raise exception 'Request changed'; end if;
  update public.premium_note_requests set status=p_status,delivery_status=p_delivery,updated_at=clock_timestamp() where id=p_id returning * into r;
  insert into public.premium_note_events(request_id,actor_id,status,delivery_status,reason) values(p_id,p_actor,p_status,p_delivery,trim(p_reason));
  return to_jsonb(r);
end $$;
revoke all on function public.request_premium_note(uuid,uuid), public.review_premium_note(uuid,uuid,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.request_premium_note(uuid,uuid), public.review_premium_note(uuid,uuid,text,text,text,timestamptz) to service_role;
