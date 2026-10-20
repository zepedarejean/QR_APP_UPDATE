-- ============================================================
-- QR-ATT Migration (v6) — Signup trigger creates the real role
--
--   BUG: handle_new_user() only inserted (id, email), so every
--   new account was born with the default role 'student'. The app
--   then tried to upsert the chosen role, but that upsert failed
--   (profiles.email is NOT NULL and the proposed insert row had
--   no email — Postgres checks the proposed tuple even on
--   conflict), so teacher registrations ended up as students.
--
--   The app now writes email + role correctly (and repairs old
--   accounts on sign-in), and this trigger is also fixed so an
--   account is born with the role the user picked at signup.
--   full_name from user metadata is stored too, so profiles are
--   complete even before the client's first write.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> paste this ENTIRE
--   file -> Run.
--
-- IDEMPOTENT: safe to run multiple times.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Repair any existing teacher accounts that the bug left as
-- students: their chosen role is stored on the auth user.
update public.profiles p
   set role = 'teacher'
  from auth.users u
 where u.id = p.id
   and u.raw_user_meta_data->>'role' = 'teacher'
   and p.role = 'student';

-- ------------------------------------------------------------
-- END OF MIGRATION
-- ------------------------------------------------------------
