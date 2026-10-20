-- ============================================================
-- QR-ATT Upgrade Migration (v2)
--
-- Adds the columns/tables needed by the upgraded app:
--   * profiles: student_id, course, year_level, section, avatar_url
--   * events:   subject, description, room, status
--   * attendance: status (present / late / absent)
--   * notifications table (in-app notifications)
--   * avatars storage bucket (profile pictures)
--   * tighter Row Level Security policies
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard -> SQL Editor
--   2. Paste this ENTIRE file
--   3. Click "Run"
--
-- IDEMPOTENT: safe to run multiple times. No existing rows are
-- modified except a one-time default for events.status.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES — student/teacher academic details
-- ------------------------------------------------------------
alter table public.profiles add column if not exists student_id text;
alter table public.profiles add column if not exists course text;
alter table public.profiles add column if not exists year_level text;
alter table public.profiles add column if not exists section text;
alter table public.profiles add column if not exists avatar_url text;

-- ------------------------------------------------------------
-- 2. EVENTS — richer event details + lifecycle status
-- ------------------------------------------------------------
alter table public.events add column if not exists subject text;
alter table public.events add column if not exists description text;
alter table public.events add column if not exists room text;
alter table public.events add column if not exists status text
  default 'active'
  check (status in ('active', 'closed'));

update public.events set status = 'active' where status is null;

-- ------------------------------------------------------------
-- 3. ATTENDANCE — present / late / absent
-- ------------------------------------------------------------
alter table public.attendance add column if not exists status text
  default 'present'
  check (status in ('present', 'late', 'absent'));

update public.attendance set status = 'present' where status is null;

-- ------------------------------------------------------------
-- 4. NOTIFICATIONS — in-app notification/reminder inbox
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default 'reminder',
  title text not null,
  body text,
  event_id uuid references public.events (id) on delete cascade,
  read boolean not null default false,
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Notifications are readable by owner" on public.notifications;
create policy "Notifications are readable by owner"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own notifications" on public.notifications;
create policy "Users can create their own notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. STORAGE — avatars bucket for profile pictures
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ------------------------------------------------------------
-- 6. SECURITY — tighter policies
-- ------------------------------------------------------------

-- Only teachers may create events.
drop policy if exists "Users can insert events" on public.events;
create policy "Users can insert events"
  on public.events for insert
  with check (
    auth.role() = 'authenticated'
    and created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'teacher'
    )
  );

-- Creators may delete their own events.
drop policy if exists "Users can delete their own events" on public.events;
create policy "Users can delete their own events"
  on public.events for delete
  using (auth.uid() = created_by);

-- Students may read the profile of a teacher whose event they attended
-- (needed to show "Teacher: ..." in the attendance history).
drop policy if exists "Students can view teachers of their attended events"
  on public.profiles;
create policy "Students can view teachers of their attended events"
  on public.profiles for select
  using (
    exists (
      select 1
      from public.attendance a
      join public.events e on e.id = a.event_id
      where a.student_id = auth.uid()
        and e.created_by = profiles.id
    )
  );

-- No one may rewrite attendance rows (records are append-only).
drop policy if exists "Students can update their own attendance" on public.attendance;
drop policy if exists "Students can delete their own attendance" on public.attendance;

-- ------------------------------------------------------------
-- END OF MIGRATION
-- ------------------------------------------------------------
