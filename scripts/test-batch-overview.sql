begin;
do $$
begin
  if not public.valid_batch_overview('{}') then raise exception 'Legacy default rejected'; end if;
  if not public.valid_batch_overview('{"pageTitle":"Custom overview","stats":[],"features":[],"sections":[{"title":"Faculty","body":"Our teachers","items":["One","Two"]}]}') then raise exception 'Valid content rejected'; end if;
  if public.valid_batch_overview('{"stats":{}}') or public.valid_batch_overview('{"features":[{"text":4,"icon":"book"}]}')
    or public.valid_batch_overview('{"stats":[{"label":"x","value":"y","icon":"script"}]}')
    or public.valid_batch_overview('{"sections":[{"title":"x","body":"y","items":[null]}]}')
    or public.valid_batch_overview('{"enrollment_status":"active"}') then raise exception 'Malformed content accepted'; end if;
end $$;
-- Exercise existing authenticated admin and student policies; all edits roll back.
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where role = 'admin' limit 1), true);
set local role authenticated;
do $$
declare target uuid; affected integer;
begin
  if not public.is_admin() then raise exception 'Admin fixture missing'; end if;
  select id into target from public.batches limit 1;
  if target is null then raise exception 'Batch fixture missing'; end if;
  update public.batches set overview_content = '{"pageTitle":"Rollback synchronization test","stats":[],"features":[],"sections":[{"title":"Test section","body":"Text","items":["Bullet"]}]}' where id = target;
  get diagnostics affected = row_count;
  if affected <> 1 or not exists(select 1 from public.batches where id=target and overview_content->>'pageTitle'='Rollback synchronization test') then raise exception 'Admin save/read failed'; end if;
  begin
    update public.batches set overview_content = '{"features":false}' where id = target;
    raise exception 'Invalid content saved';
  exception when check_violation then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', (select id::text from public.profiles where role = 'student' limit 1), true);
set local role authenticated;
do $$
declare affected integer;
begin
  if auth.uid() is null or public.is_admin() then raise exception 'Student fixture missing'; end if;
  if not exists(select 1 from public.batches where is_active and overview_content is not null) then raise exception 'Student catalog read failed'; end if;
  update public.batches set overview_content = '{"pageTitle":"Unauthorized edit"}';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Student modified batches'; end if;
end $$;
rollback;
select 'PASS: validation, admin save/read, student read and denied write; all test mutations rolled back' as result;
