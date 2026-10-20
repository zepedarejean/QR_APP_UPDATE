-- ============================================================
-- QR-ATT Migration (v5) — No approval workflow + admin guard
--
--   1) Events: the approval workflow is removed. Teacher events
--      go live immediately, so any legacy 'pending' events are
--      flipped to 'active'. The app never creates 'pending'
--      anymore ('pending'/'rejected' remain valid legacy states
--      only).
--
--   2) Security: owners could update their own profile row and
--      set role = 'admin' themselves (self-promotion through the
--      REST API). This migration blocks any non-admin from
--      writing role = 'admin'. Only an existing admin (or SQL
--      in the dashboard) can grant the admin role.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> paste this ENTIRE
--   file -> Run.
--
-- IDEMPOTENT: safe to run multiple times.
-- ============================================================

-- 1) Existing waiting-for-approval events go live.
update public.events
   set status = 'active'
 where status = 'pending';

-- 2) Nobody may promote themselves to admin.
--    (Signup/upserts keep working: teacher/student stay allowed.)
drop policy if exists "Profiles are updatable" on public.profiles;
create policy "Profiles are updatable"
  on public.profiles for update
  using (public.can_update_profile(id))
  with check (
    public.can_update_profile(id)
    and (
      coalesce(role, 'student') <> 'admin'
      or public.current_profile_role() = 'admin'
      or public.is_admin()
    )
  );

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (
    auth.uid() = id
    and (
      coalesce(role, 'student') <> 'admin'
      or public.current_profile_role() = 'admin'
    )
  );

-- ------------------------------------------------------------
-- END OF MIGRATION
-- ------------------------------------------------------------
