-- SECURITY DEFINER functions must not inherit a caller-controlled search path.
-- New signups always receive the student role; administrators are assigned only
-- through an explicit trusted administrative process.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, full_name, role, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', 'Student'),
    coalesce(new.raw_user_meta_data ->> 'name', 'Student'),
    'student',
    coalesce(new.created_at, now())
  )
  on conflict (id) do update set
    name = excluded.name,
    full_name = excluded.full_name;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;
