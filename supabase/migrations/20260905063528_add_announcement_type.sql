alter table public.announcements
  add column if not exists type text not null default 'notice';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_type_check'
      and conrelid = 'public.announcements'::regclass
  ) then
    alter table public.announcements
      add constraint announcements_type_check
      check (type in ('notice', 'update', 'maintenance', 'course'));
  end if;
end;
$$;
