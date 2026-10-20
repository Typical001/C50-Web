begin;
-- Remove the verified anonymous/student upload grant. Public image reads stay intact.
drop policy if exists "Allow read and write access for all 16v3daf_1" on storage.objects;
-- A restrictive guard prevents other permissive policies from reopening this bucket.
create policy thumbnails_admin_insert_guard on storage.objects as restrictive
for insert to anon, authenticated
with check (bucket_id <> 'thumbnails' or case when auth.role() = 'authenticated' then public.is_admin() else false end);
create policy thumbnails_admin_update_guard on storage.objects as restrictive
for update to anon, authenticated
using (bucket_id <> 'thumbnails' or case when auth.role() = 'authenticated' then public.is_admin() else false end)
with check (bucket_id <> 'thumbnails' or case when auth.role() = 'authenticated' then public.is_admin() else false end);
create policy thumbnails_admin_delete_guard on storage.objects as restrictive
for delete to anon, authenticated
using (bucket_id <> 'thumbnails' or case when auth.role() = 'authenticated' then public.is_admin() else false end);
commit;
