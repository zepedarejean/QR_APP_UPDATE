-- ============================================================
-- QR-ATT Upgrade Migration (v3)
--
-- Adds everything requested for the Admin + Approval + Chat upgrade:
--
--   * profiles: 'admin' role, department / block / class-officer /
--     skills / bio fields
--   * events:   approval workflow (pending -> active/rejected),
--     QR on/off switch, QR expiry, late-grace window, optional
--     audience targeting (department / year / block)
--   * attendance: how many seconds late the student was + a snapshot
--     of the student's department / year / block at scan time
--   * messages: 1:1 chat between students <-> teachers <-> admin
--   * event_group_stats(): per department/year/block attendance
--     percentages (20% out of 100 style)
--   * tighter Row Level Security, including full admin access
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard -> SQL Editor
--   2. Paste this ENTIRE file
--   3. Click "Run"
--
-- IDEMPOTENT: safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES — admin role + student academic extras
-- ------------------------------------------------------------

-- Allow the new 'admin' role.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('student', 'teacher', 'admin'));

alter table public.profiles add column if not exists department text;
alter table public.profiles add column if not exists block text;
alter table public.profiles add column if not exists is_class_officer boolean not null default false;
alter table public.profiles add column if not exists officer_position text;
alter table public.profiles add column if not exists skills text[] not null default '{}';
alter table public.profiles add column if not exists bio text;

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_group_idx
  on public.profiles (department, year_level, block);

-- ------------------------------------------------------------
-- 2. EVENTS — approval workflow + QR control
-- ------------------------------------------------------------

-- pending   : teacher submitted, waiting for admin approval
-- active    : approved and visible/scannable
-- rejected  : admin declined it
-- closed    : manually closed by teacher/admin
alter table public.events drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
  check (status in ('pending', 'active', 'rejected', 'closed'));

-- Teacher-created events now start as "pending" so the admin approves them.
-- Existing rows are already live, so keep them active.
update public.events set status = 'active' where status is null;

alter table public.events add column if not exists approved_by uuid references auth.users (id) on delete set null;
alter table public.events add column if not exists approved_at timestamptz;

-- QR switch: when false students cannot scan even inside the time window.
alter table public.events add column if not exists qr_active boolean not null default true;

-- Optional hard expiry for the QR code itself.
alter table public.events add column if not exists qr_expires_at timestamptz;

-- How many minutes after the start time a student is still "present".
alter table public.events add column if not exists late_grace_minutes integer not null default 5;

-- Optional audience targeting. NULL = everyone can see/scan.
alter table public.events add column if not exists target_departments text[];
alter table public.events add column if not exists target_year_levels text[];
alter table public.events add column if not exists target_blocks text[];

create index if not exists events_status_idx on public.events (status);

-- ------------------------------------------------------------
-- 3. ATTENDANCE — late seconds + group snapshot
-- ------------------------------------------------------------
alter table public.attendance add column if not exists late_by_seconds integer not null default 0;
alter table public.attendance add column if not exists department text;
alter table public.attendance add column if not exists year_level text;
alter table public.attendance add column if not exists block text;

-- ------------------------------------------------------------
-- 4. MESSAGES — 1:1 chat (student <-> teacher <-> admin)
-- ------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  receiver_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) <= 1000),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id)
);

create index if not exists messages_pair_idx
  on public.messages (sender_id, receiver_id, created_at desc);
create index if not exists messages_receiver_idx
  on public.messages (receiver_id, read, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "Participants can read their messages" on public.messages;
create policy "Participants can read their messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Users can send messages as themselves" on public.messages;
create policy "Users can send messages as themselves"
  on public.messages for insert
  with check (auth.uid() = sender_id);

-- The RECEIVER of a message may mark it as read.
drop policy if exists "Receivers can mark messages read" on public.messages;
create policy "Receivers can mark messages read"
  on public.messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

drop policy if exists "Senders can delete their own messages" on public.messages;
create policy "Senders can delete their own messages"
  on public.messages for delete
  using (auth.uid() = sender_id);

-- ------------------------------------------------------------
-- 5. ROW LEVEL SECURITY updates
-- ------------------------------------------------------------

-- 5a. Profiles: everyone signed in can find teachers/admins (chat + names),
--     and admins can read everything.
drop policy if exists "Signed-in users can find teachers and admins" on public.profiles;
create policy "Signed-in users can find teachers and admins"
  on public.profiles for select
  using (auth.role() = 'authenticated' and role in ('teacher', 'admin'));

drop policy if exists "Signed-in users can read student profiles" on public.profiles;
create policy "Signed-in users can read student profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated' and role = 'student');

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 5b. Events: students only see approved events, teachers see their own,
--     admins see everything.
drop policy if exists "Events are readable by any authenticated user" on public.events;
create policy "Events are readable by any authenticated user"
  on public.events for select
  using (
    status in ('active', 'closed')
    or created_by = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Teachers AND admins may create events.
drop policy if exists "Users can insert events" on public.events;
create policy "Users can insert events"
  on public.events for insert
  with check (
    auth.role() = 'authenticated'
    and created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('teacher', 'admin')
    )
  );

-- The creator or an admin may update (approve, retarget, QR settings...).
drop policy if exists "Users can update their own events" on public.events;
create policy "Users can update their own events"
  on public.events for update
  using (
    auth.uid() = created_by
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "Users can delete their own events" on public.events;
create policy "Users can delete their own events"
  on public.events for delete
  using (
    auth.uid() = created_by
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- 5c. Attendance: admins see every record (analytics).
drop policy if exists "Admins can view all attendance" on public.attendance;
create policy "Admins can view all attendance"
  on public.attendance for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events"
  on public.attendance for select
  using (
    exists (
      select 1 from public.events e
      where e.id = attendance.event_id
        and e.created_by = auth.uid()
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Teachers may create events on behalf of the flow (e.g. recording for a
-- group). Students may only record themselves.
drop policy if exists "Students can insert their own attendance" on public.attendance;
create policy "Students can insert their own attendance"
  on public.attendance for insert
  with check (auth.uid() = student_id);

-- ------------------------------------------------------------
-- 6. ANALYTICS — attendance percentage per department/year/block
--    "BSIT - 1st Year - Block A: 20 out of 100 students (20%)"
-- ------------------------------------------------------------
create or replace function public.event_group_stats(p_event uuid)
returns table (
  department text,
  year_level text,
  block text,
  attended bigint,
  total bigint,
  percent numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with roster as (
    select p.id, p.department, p.year_level, p.block
    from public.profiles p
    where p.role = 'student'
      and p.department is not null
      and coalesce(p.year_level, '') <> ''
      and coalesce(p.block, '') <> ''
  ),
  scanned as (
    select distinct a.student_id
    from public.attendance a
    where a.event_id = p_event
  )
  select
    r.department,
    r.year_level,
    r.block,
    count(*) filter (where r.id in (select student_id from scanned)) as attended,
    count(*) as total,
    round(
      coalesce(
        (count(*) filter (where r.id in (select student_id from scanned))::numeric
          / nullif(count(*), 0)) * 100,
        0
      ), 1
    ) as percent
  from roster r
  group by r.department, r.year_level, r.block
  order by r.department, r.year_level, r.block;
$$;

-- Overall summary per department (all approved events combined).
create or replace function public.department_summary()
returns table (
  department text,
  students bigint,
  scans bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.department,
    count(distinct p.id) filter (where p.role = 'student') as students,
    count(distinct a.id) as scans
  from public.profiles p
  left join public.attendance a on a.student_id = p.id
  where p.department is not null
  group by p.department
  order by p.department;
$$;

revoke all on function public.event_group_stats(uuid) from public;
revoke all on function public.department_summary() from public;
grant execute on function public.event_group_stats(uuid) to authenticated;
grant execute on function public.department_summary() to authenticated;

-- ------------------------------------------------------------
-- 7. Make sure a first admin exists
--    After running this file, promote yourself:
--
--    update public.profiles
--      set role = 'admin'
--      where email = 'your.admin@email.com';
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- END OF MIGRATION
-- ------------------------------------------------------------
