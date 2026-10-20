-- ============================================================
-- QR-ATT Migration (v4) — FIX: infinite policy recursion
--
-- PROBLEM (error 42P17):
--   "infinite recursion detected in policy for relation
--    \"profiles\"" (and \"attendance\")
--
--   Migration 0003 added policies that contain subqueries on
--   the SAME table they protect (e.g. "Admins can read all
--   profiles" checks the profiles table). Postgres then
--   re-applies the policies inside the subquery -> forever.
--   Every SELECT on profiles/attendance returns HTTP 500,
--   so the app can never load a profile (Profile screen
--   skeleton forever, stats empty, etc).
--
-- FIX:
--   SECURITY DEFINER helper functions run with the privileges
--   of the function owner (postgres / table owner), which
--   BYPASSES row level security inside the function, so no
--   policies are evaluated and no recursion can happen.
--   All cross-table policy logic is moved into these helpers.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> paste this ENTIRE
--   file -> Run.
--
-- IDEMPOTENT: safe to run multiple times.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SECURITY DEFINER helpers
-- ------------------------------------------------------------

-- The signed-in user's role, read without RLS.
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

-- Is the signed-in user an admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin'
       from public.profiles p
      where p.id = auth.uid()),
    false
  );
$$;

-- Is the signed-in user a teacher or admin?
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('teacher', 'admin')
       from public.profiles p
      where p.id = auth.uid()),
    false
  );
$$;

-- Consolidated READ rules for a profile row:
--   * the owner can always read their own row
--   * any signed-in user can read student/teacher/admin rows
--     (needed for chat + showing names)
--   * a user can read the profile of anyone they share an
--     event with (teacher sees attendees, student sees the
--     teacher of events they attended)
create or replace function public.can_read_profile(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = p_id
    or (
      auth.role() = 'authenticated'
      and exists (
        select 1
        from public.profiles p
        where p.id = p_id
          and p.role in ('student', 'teacher', 'admin')
      )
    )
    or exists (
      select 1
      from public.attendance a
      join public.events e on e.id = a.event_id
      where (a.student_id = p_id      and e.created_by = auth.uid())
         or (a.student_id = auth.uid() and e.created_by = p_id)
    );
$$;

-- Consolidated UPDATE rules: the owner, or an admin.
create or replace function public.can_update_profile(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = p_id or public.is_admin();
$$;

-- ------------------------------------------------------------
-- 2. PROFILES — rebuild select/update policies with helpers
-- ------------------------------------------------------------

drop policy if exists "Profiles are viewable by owner" on public.profiles;
drop policy if exists "Teachers can view profiles of their attendees" on public.profiles;
drop policy if exists "Students can view teachers of their attended events" on public.profiles;
drop policy if exists "Signed-in users can find teachers and admins" on public.profiles;
drop policy if exists "Signed-in users can read student profiles" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Profiles are readable" on public.profiles;

create policy "Profiles are readable"
  on public.profiles for select
  using (public.can_read_profile(id));

drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
drop policy if exists "Profiles are updatable" on public.profiles;

create policy "Profiles are updatable"
  on public.profiles for update
  using (public.can_update_profile(id))
  with check (public.can_update_profile(id));

-- INSERT policy from schema.sql ("Users can insert their own
-- profile": with check auth.uid() = id) has no subquery and is
-- kept as-is.

-- ------------------------------------------------------------
-- 3. ATTENDANCE — replace profiles subqueries with is_admin()
-- ------------------------------------------------------------

drop policy if exists "Admins can view all attendance" on public.attendance;
create policy "Admins can view all attendance"
  on public.attendance for select
  using (public.is_admin());

drop policy if exists "Teachers can view attendance for their events" on public.attendance;
create policy "Teachers can view attendance for their events"
  on public.attendance for select
  using (
    exists (
      select 1
      from public.events e
      where e.id = attendance.event_id
        and e.created_by = auth.uid()
    )
    or public.is_admin()
  );

-- ------------------------------------------------------------
-- 4. EVENTS — replace profiles subqueries with helpers
-- ------------------------------------------------------------

drop policy if exists "Events are readable by any authenticated user" on public.events;
create policy "Events are readable by any authenticated user"
  on public.events for select
  using (
    status in ('active', 'closed')
    or created_by = auth.uid()
    or public.is_admin()
  );

drop policy if exists "Users can insert events" on public.events;
create policy "Users can insert events"
  on public.events for insert
  with check (
    auth.role() = 'authenticated'
    and created_by = auth.uid()
    and public.is_staff()
  );

drop policy if exists "Users can update their own events" on public.events;
create policy "Users can update their own events"
  on public.events for update
  using (
    auth.uid() = created_by
    or public.is_admin()
  );

drop policy if exists "Users can delete their own events" on public.events;
create policy "Users can delete their own events"
  on public.events for delete
  using (
    auth.uid() = created_by
    or public.is_admin()
  );

-- ------------------------------------------------------------
-- END OF MIGRATION
-- ------------------------------------------------------------
