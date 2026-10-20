select jsonb_build_object(
  'columns', (select jsonb_agg(jsonb_build_object('name',column_name,'type',data_type)) from information_schema.columns where table_schema='public' and table_name='batches'),
  'rls_enabled', (select relrowsecurity from pg_class where oid='public.batches'::regclass),
  'policies', (select jsonb_agg(jsonb_build_object('name',policyname,'command',cmd,'roles',roles,'using',qual,'check',with_check)) from pg_policies where schemaname='public' and tablename='batches')
) as inspection;
