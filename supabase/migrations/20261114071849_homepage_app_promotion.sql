-- Additive CMS configuration; existing homepage content is retained.
create or replace function public.valid_app_promotion(p jsonb)
returns boolean language plpgsql immutable security invoker set search_path = '' as $$
declare k text; lim integer; s jsonb; u text;
begin
  if p is null or jsonb_typeof(p) <> 'object' or jsonb_typeof(p->'visible') is distinct from 'boolean' then return false; end if;
  for k, lim in select * from (values ('badge',40),('heading',120),('description',600),('phone_name',60),('phone_caption',80)) as limits(key, maximum) loop
    if jsonb_typeof(p->k) is distinct from 'string' or length(btrim(p->>k)) = 0 or length(p->>k) > lim then return false; end if;
  end loop;
  foreach k in array array['google_play','app_store'] loop
    s := p->k;
    if jsonb_typeof(s) is distinct from 'object' or coalesce(s->>'status','') not in ('hidden','coming_soon','available') or jsonb_typeof(s->'url') is distinct from 'string' then return false; end if;
    u := s->>'url';
    if s->>'status' = 'available' or u <> '' then
      if length(u) > 2048 or u ~ '[[:space:]\\]' then return false; end if;
      if k = 'google_play' then
        if u !~ '^https://play[.]google[.]com(:443)?/store/apps/details[?]' or u !~ '[?&]id=[A-Za-z0-9_]+([.][A-Za-z0-9_]+)+(&|#|$)' then return false; end if;
      else
        if u !~ '^https://apps[.]apple[.]com(:443)?/([^?#]*/)?id[0-9]+/?([?#].*)?$' then return false; end if;
      end if;
    end if;
  end loop;
  return true;
end;
$$;

alter table public.homepage_settings add column app_promotion jsonb not null default '{"visible":true,"badge":"Mobile App","heading":"Study Anytime. Anywhere.","description":"Explore courses, watch lectures and open study notes with the Carrier-50 app.","phone_name":"Carrier-50","phone_caption":"Active learning","google_play":{"status":"coming_soon","url":""},"app_store":{"status":"coming_soon","url":""}}'::jsonb;
alter table public.homepage_settings add constraint homepage_app_promotion_valid check (public.valid_app_promotion(app_promotion));

-- Keep public reads and make the existing administrator write boundary explicit.
alter policy "Admins can manage homepage settings" on public.homepage_settings to authenticated using (public.is_admin()) with check (public.is_admin());
