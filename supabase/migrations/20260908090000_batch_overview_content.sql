begin;
-- Additive presentation metadata. Existing batch RLS remains authoritative.
alter table public.batches add column if not exists overview_content jsonb not null default '{}'::jsonb;

create or replace function public.valid_batch_overview(content jsonb)
returns boolean language plpgsql immutable set search_path = pg_catalog as $$
declare item jsonb; section jsonb; key text;
begin
  if jsonb_typeof(content) <> 'object' or octet_length(content::text) > 100000 then return false; end if;
  for key in select jsonb_object_keys(content) loop
    if key not in ('pageTitle','overviewTitle','featuresTitle','priceLabel','startLabel','freeLabel','stats','features','sections') then return false; end if;
  end loop;
  foreach key in array array['pageTitle','overviewTitle','featuresTitle','priceLabel','startLabel','freeLabel'] loop
    if content ? key and (jsonb_typeof(content->key) <> 'string' or length(content->>key) > 200) then return false; end if;
  end loop;
  foreach key in array array['stats','features','sections'] loop
    if content ? key and jsonb_typeof(content->key) <> 'array' then return false; end if;
  end loop;
  if jsonb_array_length(coalesce(content->'stats','[]')) > 12 or jsonb_array_length(coalesce(content->'features','[]')) > 50
    or jsonb_array_length(coalesce(content->'sections','[]')) > 30 then return false; end if;
  for item in select value from jsonb_array_elements(coalesce(content->'stats','[]')) loop
    if jsonb_typeof(item) <> 'object' or not (item ?& array['label','value','icon'])
      or jsonb_typeof(item->'label') <> 'string' or length(item->>'label') > 200
      or jsonb_typeof(item->'value') <> 'string' or length(item->>'value') > 200
      or coalesce(item->>'icon','') not in ('clock','book','star','sparkles','award','shield') then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(content->'features','[]')) loop
    if jsonb_typeof(item) <> 'object' or not (item ?& array['text','icon'])
      or jsonb_typeof(item->'text') <> 'string' or length(item->>'text') > 2000
      or coalesce(item->>'icon','') not in ('clock','book','star','sparkles','award','shield') then return false; end if;
  end loop;
  for section in select value from jsonb_array_elements(coalesce(content->'sections','[]')) loop
    if jsonb_typeof(section) <> 'object' or not (section ?& array['title','body','items'])
      or jsonb_typeof(section->'title') <> 'string' or length(section->>'title') > 200
      or jsonb_typeof(section->'body') <> 'string' or length(section->>'body') > 10000
      or jsonb_typeof(section->'items') <> 'array' then return false; end if;
    if jsonb_array_length(section->'items') > 50 then return false; end if;
    for item in select value from jsonb_array_elements(section->'items') loop
      if jsonb_typeof(item) <> 'string' or length(item #>> '{}') > 2000 then return false; end if;
    end loop;
  end loop;
  return true;
end $$;
alter table public.batches add constraint batches_overview_content_valid check (public.valid_batch_overview(overview_content));
comment on column public.batches.overview_content is 'Admin-managed Android presentation only; never an entitlement, price or checkout authority.';
-- Preserve the three previously hard-coded feature bullets for existing batches only.
-- Do not invent statistics or rewrite existing titles, descriptions, prices or media.
update public.batches set overview_content = '{"features":[{"icon":"sparkles","text":"Complete syllabus coverage for MPPSC Mains & Prelims"},{"icon":"award","text":"Detailed study notes PDFs uploaded directly by instructors"},{"icon":"shield","text":"Verified content and structured daily learning streaks"}]}'::jsonb
where overview_content = '{}'::jsonb;
commit;
