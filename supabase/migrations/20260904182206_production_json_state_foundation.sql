-- Replaces JSON-backed progress state with Supabase-backed relational storage.

alter table public.lecture_progress
  add column if not exists watch_percentage smallint not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'lecture_progress_watch_percentage_check'
      and conrelid = 'public.lecture_progress'::regclass
  ) then
    alter table public.lecture_progress
      add constraint lecture_progress_watch_percentage_check
      check (watch_percentage between 0 and 100);
  end if;
end;
$$;

create table if not exists public.watch_history (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lecture_id uuid not null references public.lectures(id) on delete cascade,
  playback_seconds integer not null default 0 check (playback_seconds >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, lecture_id)
);

create index if not exists idx_watch_history_user_updated
  on public.watch_history (user_id, updated_at desc);

alter table public.watch_history enable row level security;
grant select, insert, update, delete on public.watch_history to authenticated;

drop policy if exists users_can_view_own_watch_history on public.watch_history;
create policy users_can_view_own_watch_history
  on public.watch_history for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists users_can_insert_own_watch_history on public.watch_history;
create policy users_can_insert_own_watch_history
  on public.watch_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists users_can_update_own_watch_history on public.watch_history;
create policy users_can_update_own_watch_history
  on public.watch_history for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists admins_can_manage_watch_history on public.watch_history;
create policy admins_can_manage_watch_history
  on public.watch_history for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.daily_streaks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  streak_count integer not null default 0 check (streak_count >= 0),
  last_active_date date not null default current_date,
  updated_at timestamptz not null default now()
);

alter table public.daily_streaks enable row level security;
grant select, insert, update, delete on public.daily_streaks to authenticated;

drop policy if exists users_can_view_own_daily_streak on public.daily_streaks;
create policy users_can_view_own_daily_streak
  on public.daily_streaks for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists users_can_insert_own_daily_streak on public.daily_streaks;
create policy users_can_insert_own_daily_streak
  on public.daily_streaks for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists users_can_update_own_daily_streak on public.daily_streaks;
create policy users_can_update_own_daily_streak
  on public.daily_streaks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists admins_can_manage_daily_streaks on public.daily_streaks;
create policy admins_can_manage_daily_streaks
  on public.daily_streaks for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
