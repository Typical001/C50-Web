insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-assets',
  'course-assets',
  true,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'application/zip']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists admins_can_upload_course_assets on storage.objects;
create policy admins_can_upload_course_assets
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-assets' and public.is_admin());

drop policy if exists admins_can_update_course_assets on storage.objects;
create policy admins_can_update_course_assets
  on storage.objects for update to authenticated
  using (bucket_id = 'course-assets' and public.is_admin())
  with check (bucket_id = 'course-assets' and public.is_admin());

drop policy if exists admins_can_delete_course_assets on storage.objects;
create policy admins_can_delete_course_assets
  on storage.objects for delete to authenticated
  using (bucket_id = 'course-assets' and public.is_admin());
