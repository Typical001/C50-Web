create or replace function public.protect_google_play_product_binding() returns trigger language plpgsql set search_path='' as $$ begin if new.batch_id<>old.batch_id or new.product_id<>old.product_id then raise exception 'Google Play product bindings are immutable'; end if; return new; end $$;
create trigger immutable_google_play_binding before update on public.google_play_products for each row execute function public.protect_google_play_product_binding();
create index google_play_purchases_user_id on public.google_play_purchases(user_id);
create index google_play_purchases_batch_id on public.google_play_purchases(batch_id);
create index google_play_purchases_product_id on public.google_play_purchases(product_id);
insert into public.google_play_products(batch_id,product_id,enabled)
select id,'c50_batch_'||replace(id::text,'-',''),false from public.batches
where is_active and is_paid and catalog_visible and payment_enabled on conflict(batch_id) do nothing;
