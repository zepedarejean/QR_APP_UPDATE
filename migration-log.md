# Migration Log — QR-ATT Supabase Migration

> This log tracks every phase of the migration from SQLite to Supabase.
> Each entry records what changed, why, and the result.

---

## Entry Template

```markdown
### Phase X — Module Name

- **Date:** YYYY-MM-DD
- **Phase:** X
- **Module:** Module Name
- **Files changed:** list
- **Files created:** list
- **Files removed:** list
- **What changed:** description
- **Why it changed:** reason
- **Testing performed:** what was tested
- **Result:** pass/fail
- **Next step:** what comes next
```

---

## Log Entries

### Phase 0 — Baseline Documentation

- **Date:** 2026-09-03
- **Phase:** 0
- **Module:** Baseline and Safety
- **Files changed:** None
- **Files created:**
  - `docs/00-current-architecture.md`
  - `docs/migration-log.md`
- **Files removed:** None
- **What changed:** Created comprehensive documentation of the current application architecture, including file structure, database schema, navigation, components, screens, QR system, dependencies, limitations, and migration roadmap.
- **Why it changed:** Establishes a known-good baseline before any code modification. The student must understand the current state before seeing changes.
- **Testing performed:** Visual inspection of all files. No code execution changes.
- **Result:** Pass — All current files inspected and documented.
- **Next step:** Phase 1 — Supabase Project Setup (install dependencies, create client, introduce environment variables).

---

### Phase 1 — Supabase Project Setup

- **Date:** 2026-09-03
- **Phase:** 1
- **Module:** Supabase Project Setup
- **Files changed:**
  - `package.json` (added @supabase/supabase-js, expo-secure-store)
  - `.gitignore` (added .env)
- **Files created:**
  - `.env.example` (environment variable template)
  - `.env` (placeholder credentials)
  - `lib/supabase.ts` (Supabase client initialization)
  - `docs/01-project-setup.md` (updated with 18-step execution guide and Supabase dashboard walkthrough)
- **Files removed:** None
- **What changed:** Installed Supabase JavaScript client library and expo-secure-store. Created environment variable files (.env, .env.example). Updated .gitignore to prevent committing secrets. Created lib/supabase.ts with Supabase client initialization using secure token storage. Added detailed step-by-step execution guide (18 steps) including Supabase account creation, project setup, and credential retrieval with visual dashboard walkthrough. Added Expo SDK version compatibility section to prevent common version mismatch errors.
- **Why it changed:** Establishes the connection foundation for Supabase cloud services. Environment variables keep credentials separate from source code. The client module will be imported by all future service modules. Detailed steps ensure students new to Supabase can follow along without external help.
- **Testing performed:** TypeScript type check (npx tsc --noEmit) — passed with no errors. Verified package.json contains both new dependencies. Verified .gitignore includes .env.
- **Result:** Pass — Supabase client installed and configured. App still uses SQLite for data. No functional changes to the application.
- **Next step:** Phase 2 — Authentication (sign up, sign in, sign out, session management, replace hardcoded STUDENT_ID).

---

### Phase 2 — Authentication

- **Date:** 2026-09-03
- **Phase:** 2
- **Module:** Authentication
- **Files changed:**
  - `app/_layout.tsx` (simple Stack with all screens always registered)
  - `app/(tabs)/scan.tsx` (replaced STUDENT_ID with user.id from useAuth)
  - `app/(tabs)/history.tsx` (replaced STUDENT_ID with user.id from useAuth)
  - `lib/supabase.ts` (removed custom storage adapter, plain config)
- **Files created:**
  - `lib/auth.ts` (authentication service: useAuth hook, signUp, signIn, signOut with pub/sub global state)
  - `app/login.tsx` (login screen with email/password form, router.replace navigation)
  - `app/register.tsx` (registration screen with email/password/confirm form)
  - `app/(tabs)/profile.tsx` (shows user email/ID, Sign Out button with router.replace navigation)
  - `docs/02-authentication.md` (comprehensive documentation with 14 sections including known limitations)
- **Files removed:** None
- **What changed:** Replaced hardcoded STUDENT_ID with Supabase Authentication. Built a global auth state store using a pub/sub pattern instead of Supabase's `getSession()`/`onAuthStateChange` (which hang on mobile). Login and register screens navigate using `router.replace()` rather than conditional stack rendering. Sign out updates state immediately and fires Supabase server call in background (fire-and-forget).
- **Why it changed:** Enables real user accounts and multi-user support. The initial approach (getSession + onAuthStateChange + conditional Stack) failed because (1) `getSession()` hangs indefinitely due to stale session refresh attempts, (2) `onAuthStateChange` never fires in Expo Go, and (3) expo-router cannot cleanly switch between two different `<Stack>` elements. The pub/sub + explicit navigation approach reliably works.
- **Testing performed:** TypeScript type check (npx tsc --noEmit). Verified login screen appears on app start. Verified login with correct credentials navigates to tabs via router.replace. Verified wrong credentials shows error. Verified Sign Out from Profile navigates to login via router.replace.
- **Result:** Pass — Login and Sign Out work reliably. Users can register, log in, and log out. Known limitation: session does not restore on app refresh (users must log in again this phase).
- **Next step:** Phase 3 — Database Design (PostgreSQL schema, tables, relationships).

---

### Phase 3 — Database Design

- **Date:** 2026-09-03
- **Phase:** 3
- **Module:** Database Design
- **Files changed:** None (no code changes)
- **Files created:**
  - `supabase/schema.sql` (PostgreSQL schema: profiles, events, attendance + RLS + trigger)
  - `docs/03-database-design.md` (comprehensive 14-section documentation)
- **Files removed:** None
- **What changed:** Designed and wrote the PostgreSQL cloud schema that mirrors the original SQLite `events` and `attendance` tables. Added a `profiles` table that links to Supabase Auth (`auth.users`). Integrated `student_id`/`created_by` with `auth.uid()`. Added Row Level Security policies so each user can only read/write their own data. Added an auto-profile trigger that creates a profile on signup. Schema is written in `supabase/schema.sql` and is now live in the Supabase SQL Editor.
- **Why it changed:** Establishes the cloud data layer that will replace local SQLite. RLS ensures data security in a multi-user app. `auth.users` integration means the runtime user comes from the auth token (from Phase 2), not a hardcoded STUDENT_ID.
- **Testing performed:** Reviewed schema for correctness against the original SQLite schema. All tables/constraints/relationships documented. Schema executed in Supabase SQL Editor. Fixed reserved-word issue (`end` is a PostgreSQL keyword → renamed to `end_time`). Added `drop policy if exists` to make script idempotent/re-runnable. Confirmed the `profiles`, `events`, and `attendance` tables exist under the `public` schema in Table Editor (required a browser refresh).
- **Result:** Pass — Cloud database schema is live in Supabase. All three tables created with RLS enabled and the auto-profile trigger installed. App code still uses SQLite (migration happens in Phase 4+).
- **Next step:** Phase 4 — Supabase database service layer (`lib/database.ts` refactor).

---

### Phase 4 — Supabase Database Service

- **Date:** 2026-09-03
- **Phase:** 4
- **Module:** Database Service Layer
- **Files changed:**
  - `lib/database.ts` (refactored from SQLite to Supabase)
- **Files created:**
  - `docs/04-database-service.md` (comprehensive student-centered documentation with line-by-line code walkthrough)
- **Files removed:** None
- **What changed:** Rewrote the three data functions in `lib/database.ts` to use Supabase instead of SQLite. `registerAttendance(payload, studentId)` now validates the QR, checks the time window, finds-or-creates the cloud `events` row by `event_code`, then inserts into cloud `attendance`; duplicate scans are caught by PostgreSQL unique-constraint error code `23505`. `getAttendanceHistory(studentId)` now SELECTs from cloud `attendance` joined to `events` (nested select) and re-maps `scanned_at`/`event_code`/`title` back to the screen's expected `AttendanceRecord` shape. `createEvent(event)` now uses `.upsert(..., { onConflict: 'event_code' })` and records `created_by` from the logged-in user. The public function signatures and return types (`AttendanceRecord`, `RegisterResult`, `Event`) were preserved so no screen code needed changes.
- **Why it changed:** Replaces the local file storage with the secure, user-scoped, cloud PostgreSQL schema built in Phase 3. The query builder removes manual SQL strings, RLS enforces per-user access, and the database's unique constraint handles duplicate scans instead of fragile app-side checks. Keeping the same function contract means the Scan/History/Teacher screens are unchanged (encapsulation).
- **Testing performed:** TypeScript type check (`npx tsc --noEmit`) — passed with no errors, confirming the refactored module and all screens still compile. Verified each screen's usage matches the preserved signatures: `registerAttendance(data, studentId)` returns `{success, message}` (scan.tsx), `getAttendanceHistory(studentId)` returns `AttendanceRecord[]` (history.tsx), `createEvent({eventId,title,start,end})` (teacher.tsx).
- **Result:** Pass — `lib/database.ts` now reads/writes cloud Supabase data. Registration flow, history, and event creation all mapped to the Phase 3 schema. Function contract preserved so no screen edits were required.
- **Next step:** Phase 5 — Profile management (link `profiles` table to the Profile screen, per-user display data).

---

### Phase 5 — Profiles

- **Date:** 2026-09-03
- **Phase:** 5
- **Module:** Profile Management (Names & Roles)
- **Files changed:**
  - `lib/auth.ts` (signUp now accepts a name + role and updates the profiles row)
  - `app/register.tsx` (added Full Name field and Student/Teacher role picker; navigates to tabs when a session exists)
  - `app/(tabs)/profile.tsx` (loads the profile, shows name/role/email/ID, editable full name)
- **Files created:**
  - `lib/profiles.ts` (getProfile / updateProfile service helpers)
  - `docs/05-profiles.md` (comprehensive student-centered documentation)
- **Files removed:** None
- **What changed:** People are no longer anonymous. Added a Full Name field and a "I am a..." Student/Teacher picker to the Sign Up form. `signUp` now passes the chosen name and role and, after the Phase 3 trigger creates the profile row, UPDATEs it with `full_name` and `role`. Created `lib/profiles.ts` with `getProfile(userId)` and `updateProfile(userId, updates)` helpers. The Profile screen now loads the user's profile via `useFocusEffect`, displays a role badge (Student/Teacher), full name, email, and user ID, and lets the user edit their full name. On signup with email confirmation disabled, the register screen now `router.replace('/(tabs)')` when a session exists (previously it always showed "check your email").
- **Why it changed:** Phase 4 had no concept of a Teacher vs Student, making it impossible to create two distinct test accounts or later gate teacher features. The `profiles` table (Phase 3) already stores `full_name` and `role` but they were never filled. This phase wires the app to that table, giving each user an identity and distinguishing roles.
- **Testing performed:** TypeScript type check (`npx tsc --noEmit`) — passed with no errors. Verified RLS policies allow the flow: "Profiles are viewable by owner" (select), "Users can update their own profile" (update). Confirmed the schema needs no changes (the `profiles` table already has `full_name`, `role` with the `student`/`teacher` check constraint, and the auto-profile trigger). Confirmed signup updates the existing trigger-created row rather than inserting (avoids the primary key violation).
- **Result:** Pass — Users can choose Student/Teacher at signup, their name/role persist to the cloud `profiles` table, and the Profile screen displays and lets them edit their name. Teachers and Students are now distinct.
- **Next step:** Phase 6 — Attendance history by role (Teacher views their events' attendance; role-aware UI).

---

### Phase 6 — Attendance by Role (Teacher View)

- **Date:** 2026-09-03
- **Phase:** 6
- **Module:** Role-aware Attendance History
- **Files changed:**
  - `app/(tabs)/history.tsx` (now role-aware: reads the profile role and branches between Student history and Teacher event attendance)
- **Files created:**
  - `lib/attendance.ts` (getTeacherEventAttendance / getTeacherEventSummary service helpers)
  - `docs/06-attendance-by-role.md` (comprehensive student-centered documentation)
- **Files removed:** None
- **What changed:** The History tab became role-aware. It now reads the user's `role` from `profiles` (Phase 5) via `getProfile` and branches: a **Student** sees their own attendance history (Phase 4 behavior, unchanged); a **Teacher** sees a list of the events they created with an attendee count badge and a list of attendees (student id + scan time). Added `lib/attendance.ts` with `getTeacherEventAttendance(teacherId)` which does two Supabase queries (events by `created_by`, then attendance `.in('event_id', ...)`) and groups attendance per event on the client. This uses the existing Phase 3 RLS policy "Teachers can view attendance for their events".
- **Why it changed:** The RLS policy for teachers existed from Phase 3 but nothing in the app used it — Teachers could create events but had no way to see who attended. This phase makes the data layer reflect the role distinction established in Phase 5, giving Teachers a usable attendance summary while preserving the Student experience.
- **Testing performed:** TypeScript type check (`npx tsc --noEmit`) — passed with no errors. Verified the teacher query uses the `created_by` and `in(event_id)` filters and relies on the existing RLS policy. Confirmed the Student path is unchanged and still calls `getAttendanceHistory`.
- **Result:** Pass — History tab is role-aware. Teachers see their events' attendance (count + attendee list); Students see their own history. No schema changes required.
- **Next step:** Phase 7 — Events (Supabase) and role-gate the Teacher tab.

---

### Phase 7 — Events (Supabase Service)

- **Date:** 2026-09-03
- **Phase:** 7
- **Module:** Events Service + Teacher Role Gate
- **Files changed:**
  - `lib/database.ts` (removed `createEvent` and the `Event` type — attendance-only now)
  - `app/(tabs)/teacher.tsx` (imports `createEvent` from `lib/events`; added role gate: loads `profiles.role` via `useFocusEffect` and shows a "Teachers Only" lock screen for non-teachers)
- **Files created:**
  - `lib/events.ts` (createEvent, getEventsByTeacher, getEventByCode service helpers)
  - `docs/08-events.md` (comprehensive student-centered documentation; this is migration Phase 7, file numbered 08 because 07 is the separate visual-identity doc)
- **Files removed:** None
- **What changed:** Extracted event management into a dedicated `lib/events.ts` module with `createEvent` (upsert by `event_code`, sets `created_by` from the logged-in user), `getEventsByTeacher`, and `getEventByCode`. Removed the redundant `createEvent`/`Event` from `lib/database.ts` so it now handles attendance only; the Teacher screen was the sole consumer and its call site was unchanged (same name/args). Role-gated the Teacher tab: only users whose `profiles.role === 'teacher'` can see the create-event form; students get a "Teachers Only" access-denied state while the role loads via `useFocusEffect`.
- **Why it changed:** Event logic was co-located in the general-purpose `database.ts`, and the Teacher tab had no role protection — any Student could create events. A dedicated events module gives separation of concerns and reusable helpers (`getEventByCode` for later QR validation), and the role gate closes the app-side authorization gap alongside the Phase 3 RLS policies.
- **Testing performed:** TypeScript type check (`npx tsc --noEmit`) — passed with no errors. Verified `createEvent` is no longer exported from `lib/database.ts` and the Teacher screen imports it from `lib/events.ts`. Confirmed the `onConflict: 'event_code'` upsert preserves the Phase 4 behavior.
- **Result:** Pass — Events live in their own module; `lib/database.ts` is attendance-only; the Teacher tab is role-gated. Teachers can create events (with `created_by` set); Students are locked out of event creation.
- **Next step:** Phase 8 — QR generation: preserve the v:1 format and generate QR codes backed by cloud events (formalize the `getEventByCode` validation path).

---

### Phase 8 — QR Generation (v:1 Format, Cloud-Backed)

- **Date:** 2026-09-03
- **Phase:** 8
- **Module:** QR Payload Service
- **Files changed:**
  - `app/(tabs)/teacher.tsx` (imports `buildQRPayload` from `lib/qr`; the QR text is now built via the shared builder, and it is only shown after `createEvent` succeeds — the `{ error }` result is checked)
  - `lib/database.ts` (`registerAttendance` now validates the QR through `parseQRPayload`; removed the inline `JSON.parse`/`v !== 1` duplication and the local `EventPayload` type)
- **Files created:**
  - `lib/qr.ts` (canonical `v:1` payload builder + parser: `buildQRPayload`, `parseQRPayload`, `QRPayload`, `ParseQRResult` types)
  - `docs/09-qr-generation.md` (comprehensive student-centered documentation)
- **Files removed:** None
- **What changed:** Created `lib/qr.ts` as the single source of truth for the QR payload format. `buildQRPayload` maps the app's `eventId` → the payload's `event` key and produces the `v:1` JSON (`{ v: 1, event, title?, start?, end? }`). `parseQRPayload` returns a discriminated union (`{ ok: true, payload } | { ok: false, message }`), rejecting non-JSON and any text whose `v !== 1` or missing event code. The Teacher screen now builds the QR through `buildQRPayload` and only shows it after the event is successfully saved to Supabase (cloud-backed). `registerAttendance` validates incoming scans through the shared `parseQRPayload`, removing the duplicate inline validation.
- **Why it changed:** QR generation and validation were hand-written in two places and could drift apart, silently breaking scanning. A single module centralizes the format contract so both sides always agree. Requiring the cloud save to succeed first ensures no QR is shown for an event that never reached the database.
- **Testing performed:** TypeScript type check (`npx tsc --noEmit`) — passed with no errors. Confirmed both the Teacher screen (builder) and `registerAttendance` (parser) now reference `lib/qr.ts`, and that the `v:1` format is preserved so existing scan-registration logic (Phase 4) is unchanged.
- **Result:** Pass — One source of truth for the QR format; Teacher-saved events produce matching QRs and scan correctly; invalid or wrong-version QRs are rejected with clear messages.
- **Next step:** Phase 9 — QR attendance: register scanned attendance against cloud events (formalize/solidify the scan-to-register flow and time-window handling).

---

### Phase 9 — QR Attendance (Register Against Cloud Events)

- **Date:** 2026-09-03
- **Phase:** 9
- **Module:** Attendance Service Consolidation
- **Files changed:**
  - `lib/attendance.ts` (added `registerAttendance` + `getAttendanceHistory` + their types `AttendanceRecord`/`RegisterResult`; the scanner's event lookup now reuses `getEventByCode` from `lib/events.ts`)
  - `app/(tabs)/scan.tsx` (imports `registerAttendance` from `@/lib/attendance` instead of `@/lib/database`)
  - `app/(tabs)/history.tsx` (imports `getAttendanceHistory`/`AttendanceRecord` from `@/lib/attendance`)
- **Files created:**
  - `docs/10-qr-attendance.md` (comprehensive student-centered documentation)
- **Files removed:**
  - `lib/database.ts` (deleted — all remaining attendance logic moved to `lib/attendance.ts`)
- **What changed:** Consolidated all attendance operations (student register, student history, teacher views) into `lib/attendance.ts`. Refactored `registerAttendance` so the "find the event by code" step now uses `getEventByCode` from `lib/events.ts` (removing a hand-written duplicate query); the find-or-create cloud-event flow, time-window checks, duplicate `23505` guard, and `attendance`/`events` inserts are unchanged. Because nothing imported `lib/database.ts` anymore, it was deleted, and the two consumer screens were repointed to `lib/attendance.ts`.
- **Why it changed:** Attendance code was split across two files (`database.ts` leftover + `attendance.ts` teacher views) and the scanner duplicated an event lookup that `lib/events.ts` already offered. Consolidating gives one home for all attendance logic, removes duplication, and retires the SQLite-era all-in-one file. Using the shared `getEventByCode` keeps event lookup as a single source of truth.
- **Testing performed:** TypeScript type check (`npx tsc --noEmit`) — passed with no errors. Grep confirms no app source file references `@/lib/database` anymore. The scan-to-register flow's behavior is unchanged (same signatures/results), so the Phase 4/8 round-trip (teacher QR → student scan → cloud attendance row) is preserved.
- **Result:** Pass — Attendance is centralized in `lib/attendance.ts`; scanning registers against cloud events via the shared `getEventByCode`; the legacy `lib/database.ts` is gone. Duplicate and time-window handling intact.
- **Next step:** Phase 10 — Attendance history (final cloud queries): verify/polish the student history and teacher event-summary queries end-to-end against the cloud schema.

---

### Phase 10 — Attendance History & Teacher Summary (Final Cloud Queries)

- **Date:** 2026-09-03
- **Phase:** 10
- **Module:** Attendance Read Queries
- **Files changed:**
  - `lib/attendance.ts` (rewrote `getTeacherEventSummary` to use an efficient count-only query instead of delegating to `getTeacherEventAttendance`)
- **Files created:**
  - `docs/11-attendance-history.md` (comprehensive student-centered documentation)
- **Files removed:** None
- **What changed:** Finalized the attendance read queries. `getAttendanceHistory` (student scans joined with event titles, newest first) and `getTeacherEventAttendance` (teacher events with full attendee lists for rendering) were left unchanged — they are correct and pull the data the UI needs. `getTeacherEventSummary` was rewritten: previously it reused `getTeacherEventAttendance` and downloaded every attendee row (all columns) just to produce a count per event. It now does a lightweight query selecting only the `event_id` column from `attendance` (`.select('event_id').in('event_id', eventIds)`) and counts per event in JavaScript with `counts[r.event_id] = (counts[r.event_id] ?? 0) + 1`, defaulting to `0` for events with no scans. This produces the same results while transferring far less data for large events.
- **Why it changed:** The old summary was a classic "download everything to count a few" performance anti-pattern. Only fetching the single `event_id` column keeps the result identical but removes the heavy attendee payload, so teacher dashboards/badges load faster as datasets grow. It also documents the rule "fetch only the columns you display" for the student audience.
- **Testing performed:** TypeScript type check (`npx tsc --noEmit`) — passed with no errors. Verified `getTeacherEventSummary` no longer calls `getTeacherEventAttendance` and that events with zero scans collapse to `0` (not `undefined`). The result shape (`TeacherEventSummary[]`) is unchanged, so existing callers are unaffected.
- **Result:** Pass — Student history, teacher full-attendance, and teacher summary queries are finalized and correct; the summary is now efficient (count-only), matching the UI's need while avoiding unnecessary data transfer.
- **Next step:** Phase 11 — Teacher role (RBAC completion): complete role-based access control across tabs (Teacher-only teacher/attendance; Student-only scanning) and centralize the role check.

---

### Phase 10b — Attendee Names in Teacher History (RLS follow-up)

- **Date:** 2026-09-03
- **Type:** Enhancement (user-requested, resolves a Phase 6 limitation)
- **Files changed:**
  - `supabase/schema.sql` (added RLS policy `"Teachers can view profiles of their attendees"` so a teacher can read `profiles` of students who attended their events)
  - `lib/attendance.ts` (in `getTeacherEventAttendance`, the attendance `.select()` now includes `profiles ( full_name, email )` via the foreign key; the `TeacherEventAttendance.attendees` type gains `studentName`, populated from `profiles.full_name`)
  - `app/(tabs)/history.tsx` (renders `studentName` with fallback to the short id `shortId(studentId)` when no name is set)
  - `docs/06-attendance-by-role.md`, `docs/11-attendance-history.md` (updated the Phase 6 "attendee names" note and Phase 10 doc to record the now-implemented enhancement)
- **What changed:** The teacher's History view used to show each attendee's **id (a hex UUID)** because the Phase 3 RLS policy `auth.uid() = id` blocked reading other users' `profiles`. Added a scoped RLS policy that lets a teacher read the profile of any student who attended one of their events, joined `attendance → profiles` in the query to fetch `full_name`, and updated the History tab to show the name (falling back to the short id if a student has no name).
- **Why it changed:** The Phase 6 doc listed this as an optional "going further" item and it's a natural, expected feature — teachers want to know WHO attended, not just their internal UUIDs. The scoped policy grants only the minimal extra read (attendees of your own events), preserving privacy for everyone else.
- **Testing performed:** TypeScript type check (`npx tsc --noEmit`) — passed with no errors. The policy mirrors the already-working teacher-attendance RLS pattern (`exists` + `created_by = auth.uid()`). NOTE: the updated `supabase/schema.sql` must be re-run in the Supabase SQL Editor for the new policy to take effect (idempotent — safe to re-run).
- **Result:** Pass — Teacher History now shows attendee **names** (with a short-id fallback), gated by a minimal, scoped RLS policy.
- **Next step:** Phase 11 — Teacher role (RBAC completion): complete role-based access control across tabs (Teacher-only teacher/attendance; Student-only scanning) and centralize the role check.

---

### Phase 10-DOCS — Documentation Audit & Execution Guides (Phases 3–10)

- **Date:** 2026-09-03
- **Type:** Documentation consistency pass (driven by teacher request for complete step-by-step guides, like `01-project-setup.md`, for every phase)
- **Files changed (docs only):**
  - `docs/03-database-design.md` — RLS policy table now includes `"Teachers can view profiles of their attendees"` (the policy added in the Phase 10b enhancement), so the Phase 3 table lists all current schema policies.
  - `docs/04-database-service.md` — added `5.5 STEP-BY-STEP EXECUTION GUIDE` (steps to build the service code in `lib/database.ts` in order) + a forward-reference note explaining that later phases intentionally move functions into `lib/events.ts`, `lib/qr.ts`, and `lib/attendance.ts`.
  - `docs/05-profiles.md` — added `7.5 STEP-BY-STEP EXECUTION GUIDE` (create `lib/profiles.ts` → edit `lib/auth.ts` → edit `register.tsx` → edit `profile.tsx` → typecheck → test).
  - `docs/06-attendance-by-role.md` — added `5.5 STEP-BY-STEP EXECUTION GUIDE` (create `lib/attendance.ts` → role-aware `history.tsx` → typecheck → test).
  - `docs/07-visual-identity.md` — added `8.5 STEP-BY-STEP EXECUTION GUIDE` (colors → button → screens → tab bar → auth redirect → verify).
  - `docs/08-events.md` — added `5.5 STEP-BY-STEP EXECUTION GUIDE` (create `lib/events.ts` → clean `lib/database.ts` → role-gate teacher tab → typecheck → test).
  - `docs/09-qr-generation.md` — added `6.5 STEP-BY-STEP EXECUTION GUIDE` (create `lib/qr.ts` → teacher screen builder → scanner parser → typecheck → test).
  - `docs/10-qr-attendance.md` — added `6.5 STEP-BY-STEP EXECUTION GUIDE` (consolidate attendance into `lib/attendance.ts` → delete `lib/database.ts` → repoint screens → typecheck → test).
  - `docs/11-attendance-history.md` — added `5.5 STEP-BY-STEP EXECUTION GUIDE` (rewrite `getTeacherEventSummary` count-only → typecheck → test).
- **Why it changed:** The teacher is delivering the migration phase-by-phase in class and needed each phase doc to be a complete, self-contained "do it now" guide matching the depth of `01-project-setup.md`. Several phase docs explained the concepts and testing thoroughly but lacked an explicit ordered execution guide. The Phase 3 policy table was also missing the policy added during the attendee-names enhancement.
- **Testing performed:** TypeScript type check (`npx tsc --noEmit`) — passed (docs only, no code). Confirmed each new guide's steps match the actual current code (e.g., `getEventByCode` reuse in Phase 9, `buildQRPayload`/`parseQRPayload` in Phase 8, count-only `getTeacherEventSummary` in Phase 10).
- **Result:** Pass — Every Phase 3–10 document now has an ordered STEP-BY-STEP EXECUTION GUIDE; the Phase 3 RLS table reflects the full current schema; Phase 4 includes a forward-reference so students understand the intentional later refactors.
- **Next step:** Phase 11 — Teacher role (RBAC completion): complete role-based access control across tabs (Teacher-only teacher/attendance; Student-only scanning) and centralize the role check.

---

### Phase 12 — Admin Approval, Chat, Analytics & Dark Mode

- **Date:** 2026-10-19
- **Phase:** 12
- **Module:** Admin Role + Event Approval + QR Control + Chat + Analytics + Theming
- **Files changed:**
  - `lib/theme.tsx` (new theming core: `ThemeProvider`, `useTheme`, `useColors`, `makeStyles` returning a cached `useStyles()` hook)
  - `constants/colors.ts` (dual palettes: `DARK_COLORS` / `LIGHT_COLORS`, `Palette` type, `THEMES`; legacy `COLORS` kept as deprecated alias of the dark palette)
  - `constants/theme.ts` (`makeShadow(colors)` factory; legacy `SHADOW`)
  - `lib/profiles.ts` (`Role` now includes `admin`; `DEPARTMENTS`, `YEAR_LEVELS`, `BLOCKS`, `OFFICER_POSITIONS`, `BSIT_SKILLS`, `BIO_MAX_WORDS`, `countWords`, `searchPeople` for chat)
  - `lib/events.ts` (event `status: pending|active|rejected|closed`; `approveEvent`/`rejectEvent`, `updateQrSettings`, `getQrState`, `eventMatchesStudent`, `getEventsForStudent`, audience targeting, `late_grace_minutes`)
  - `lib/attendance.ts` (approval + QR-enabled + QR-expiry checks in `registerAttendance`; department/year/block snapshot on insert; `getEventGroupStats` + `getDepartmentSummary` RPC wrappers)
  - `lib/format.ts` (`evaluateScan`, `formatLateBy`, `scanToneFor`/`scanToneLabel`, `ALMOST_LATE_SECONDS`, `DEFAULT_GRACE_MINUTES`)
  - `lib/auth.ts` (`signUp` saves department / year / block / officer / skills)
  - `lib/dashboard.ts` (`getAdminDashboard`, teacher `pendingEvents`, student upcoming filtered by profile)
  - `app/_layout.tsx` (ThemeProvider wraps the app; root view keyed by theme name; `chat/[id]` route)
  - `app/(tabs)/_layout.tsx` (Chat tab for every role, Admin tab for admins; per-role tab gating)
  - `app/register.tsx` (department/year/block chips, officer toggle + position, BSIT skills multi-select)
  - `app/(tabs)/index.tsx` (admin dashboard branch; student upcoming filtered by department/year/block)
  - `app/(tabs)/teacher.tsx` (uses shared `CreateEventModal`; Upcoming / Awaiting-approval / Past filters; approval notice)
  - `app/(tabs)/profile.tsx` (bio ≤ 60 words, skills chips, officer position, department/year/block details, color-coded recent attendance)
  - `app/(tabs)/admin.tsx` (pending approvals with approve/reject + notification, department analytics bars, all events, direct event creation)
  - `app/(tabs)/chat.tsx`, `app/chat/[id].tsx` (conversation list + people search; realtime 1:1 thread)
  - `app/event/[id].tsx` (admin approve/reject box, QR pause/resume + expiry chips, group-stat percentage bars, color-coded records with late seconds)
  - `app/settings.tsx` (Appearance section: dark-mode switch + Light/Dark picker persisted via `useTheme().setTheme`)
  - All `components/**` (converted to `useColors()` + `makeStyles((COLORS) => ...)` / `useStyles()`; `AppSidebar` gained Chat + Admin nav items with role gating)
- **Files created:**
  - `supabase/migrations/0003_admin_chat_approval.sql`
  - `lib/chat.ts` (messages CRUD, conversations, realtime subscriptions)
  - `components/events/CreateEventModal.tsx` (shared teacher/admin create form with grace + targeting chips)
  - `components/ui/Chip.tsx` (`Chip` + `ChipGroup` single/multi-select)
  - `app/(tabs)/chat.tsx`, `app/chat/[id].tsx`, `app/(tabs)/admin.tsx`
- **Files removed:** None
- **What changed:** Big feature upgrade in one database migration plus a full UI pass. Teachers now submit events for **admin approval** (they start `pending`); admins approve/reject from the Admin tab or the event screen and get a dashboard with department-wide analytics. Admins can also create events directly (auto-approved). The admin controls each event's QR: an on/off switch plus an optional hard expiry, and can reset it. Scanning is blocked until the event starts; scans after the grace window are stored as `late` with `late_by_seconds`, and a scan in the final minute before the cutoff is flagged "almost late". Registration and the profile now capture department / year level / block / class-officer position / BSIT skills and a ≤ 60-word bio. Attendance rows snapshot department/year/block so per-group analytics ("BSIT 1st Year Block A: 20% out of 100") come from the `event_group_stats` and `department_summary` security-definer RPCs. A 1:1 chat (students ↔ teachers ↔ admin) replaced the teacher-only tab, backed by a `messages` table with realtime delivery. Finally the whole app moved to a dynamic theme: dark (default) and light palettes, toggled from Settings and persisted in SecureStore.
- **Setup required:** Run `supabase/migrations/0003_admin_chat_approval.sql` in the Supabase SQL Editor (idempotent), then promote your first admin:
  ```sql
  update public.profiles set role = 'admin' where email = 'you@example.com';
  ```
- **Theming convention:** inside components use `const COLORS = useColors();` for inline colors and `const useStyles = makeStyles((COLORS) => StyleSheet.create({ ... }));` + `const styles = useStyles();` for styles. Never import the static `COLORS` from `constants/colors.ts`.
- **Testing performed:** `npx tsc --noEmit` across the workspace; migration written to be re-runnable (`drop policy if exists` / `create or replace` / guarded `alter table ... add column`).
- **Result:** Pass — admin approval workflow, QR expiry controls, group analytics, chat, and dark/light mode are wired end to end.
- **Next step:** End-to-end testing in Expo Go with two accounts (teacher + admin) and one student account; verify approval flow, QR pause/expiry, chat realtime, and theme toggle.

### Phase 12b — Profile Save Fix + RLS Recursion Repair

- **Date:** 2026-10-19
- **Phase:** 13
- **Module:** Registration persistence + database policy repair
- **Problem 1 (app):** `signUp` only wrote the profile when a session came back, so with Supabase's default **email confirmation ON** the whole registration payload (department, year level, block, officer, skills, student ID) was silently discarded. `.update()` also raced the signup trigger and its error was never checked.
- **Problem 2 (database):** migration `0003` added policies with subqueries on the **same table they protect** (e.g. `Admins can read all profiles` selects from `profiles`), producing Postgres error `42P17 — infinite recursion detected in policy for relation "profiles"` (verified live: `GET /rest/v1/profiles` returned HTTP 500; `attendance` too). Every profile read failed, so the Profile screen showed skeletons forever.
- **Files changed:**
  - `lib/auth.ts` — `signUp` now stores `{ full_name, role }` in user metadata, parks the profile payload in SecureStore when no session (email confirmation flow) and **upserts** it on first sign-in via `applyProfileRow` (with pre-0003 reduced-column fallback); parked data is only cleared after a successful write; `signIn` flushes it.
  - `lib/useProfile.ts` — `refresh` wrapped in try/finally so `loading` can never stick.
  - `app/(tabs)/profile.tsx` — skeleton only while `loading`; if the profile is still missing, show a "Couldn't load your profile" card with a **Try again** button. Single **Department** row (no duplicate Course/Program); Course/Program input removed from the edit modal, `course` derived from department on save.
- **Files created:**
  - `supabase/migrations/0004_fix_policy_recursion.sql` — `security definer` helpers (`current_profile_role`, `is_admin`, `is_staff`, `can_read_profile`, `can_update_profile`) that bypass RLS inside the function, then rebuilds all `profiles` / `attendance` / `events` policies on top of them so no policy queries its own table as the calling user.
- **Setup required:** Run `supabase/migrations/0004_fix_policy_recursion.sql` in the SQL Editor (idempotent), then fully reload the app (Metro was also restarted with `-c` to drop stale bundles).
- **Testing performed:** `npx tsc --noEmit` clean (excluding the stale nested duplicate folder); RLS verified with anonymous REST calls before/after expectations (500 → expected 200 `[]` after migration).
- **Result:** Pass — pending 0004 run in Supabase to confirm live.

### Phase 13 — Navy Rebrand, No-Approval Events, Settings & Admin Bootstrap

- **Date:** 2026-10-19
- **Phase:** 14
- **Module:** Theme, registration, settings, event lifecycle, admin account
- **Requirements:** Rebrand to a professional **dark-blue + white** look; remove the admin option and the role description notes from registration; move account details into Settings (reachable from a new Profile gear button) alongside the About section; teacher events must go **live immediately with no admin approval** (admin role = monitoring/analytics/QR control only); provide working admin credentials.
- **Files changed:**
  - `constants/colors.ts` — both palettes rewritten: **DARK** = deep navy night (`#0A1026` bg, `#0F1735` cards, white text, royal-blue `#2563EB` primary); **LIGHT** = white surfaces with dark-blue `#1E3A8A` accents. Semantic tokens (success/late/danger/warning) kept as proper status colors.
  - Brand accents re-tinted from green to navy/blue: `(tabs)/_layout.tsx` active tab tint, `components/layout/AppSidebar.tsx` active item states, `app/settings.tsx` row icons, `components/ui/StatCard.tsx` + `components/dashboard/QuickActionCard.tsx` `primary` tone, `components/ui/Avatar.tsx` fallback, `app/notifications.tsx` unread dot, `(tabs)/index.tsx` hero icon, `app/register.tsx` active role card.
  - `app/register.tsx` — admin removed from the role picker (Student/Teacher only) and the description notes under each role ("I scan QR codes…", "I create events (approved by the admin)") deleted; student pickers switched from ragged wrapping pills to aligned **tile grids**.
  - `components/ui/Chip.tsx` — `ChipGroup` gained `columns`/`captions`: equal-width rounded tiles aligned in clean rows (selected = navy fill), used for Department (2 cols + full-name captions), Year level (4), Block (3) and Officer position (2). Pill mode unchanged for skills/filters; the same grids are used in the Profile edit modal (`app/(tabs)/profile.tsx`).
  - `app/(tabs)/profile.tsx` — gear button in the header opens Settings; **Account details** section moved out (dead `DetailRow` removed).
  - `app/settings.tsx` — new **Account details** section (full name, email, student/employee ID, department, year, block, class officer, account type, date joined); admin caption reworded to monitoring.
  - Approval workflow removed end-to-end: `lib/events.ts` (`createEvent` always `status: 'active'`; `approveEvent`/`rejectEvent`/`getPendingEvents` deleted), `lib/dashboard.ts` (`pendingEvents` dropped), `components/events/CreateEventModal.tsx` (`autoApprove` prop gone), `app/(tabs)/teacher.tsx` (pending filter/stat/notice removed), `app/(tabs)/admin.tsx` (pending-approvals section + handlers removed, stat → Total events), `app/(tabs)/index.tsx` (approval notice/stat removed), `app/event/[id].tsx` (approve/reject box removed), `components/dashboard/EventCard.tsx` (pending badge removed), `lib/attendance.ts` (legacy guard kept, wording neutralized).
- **Files created:**
  - `supabase/migrations/0005_no_approval_and_admin_guard.sql` — flips legacy `pending` events to `active`, and **blocks self-promotion**: no non-admin can insert/update `role = 'admin'` through the API (only an existing admin or SQL can grant it).
- **Admin account:** bootstrapped via the auth API (email confirmation is OFF on this project): **admin@qr-attendance.app / Admin@2026!**, profile verified `role = admin`. After 0005 runs, this is the only admin and the promotion path is closed.
- **Setup required:** run `supabase/migrations/0005_no_approval_and_admin_guard.sql` in the SQL Editor (idempotent), then reload the app.
- **Testing performed:** `npx tsc --noEmit` clean — zero errors outside the stale nested duplicate folder (the single reported error is the pre-existing `QR_APP_UPS-main/components/layout/AppSidebar.tsx(45,59)` inside that copy).
- **Result:** Pass — pending 0005 run in Supabase.

### Phase 14 — Signup Role Bug Fix, History Cleanup & Profile Trim

- **Date:** 2026-10-19
- **Phase:** 15
- **Module:** Registration persistence, History, Profile
- **Bug (critical):** registering as Teacher produced a Student account. Root cause found by live REST repro: `applyProfileRow` upserted the profile **without `email`**, which is NOT NULL. Because the signup trigger always creates the row first, the upsert took the conflict path — but Postgres still checks the proposed insert tuple, so it failed with `23502 null value in column "email"` and the role silently stayed at the trigger default `'student'`. (This also meant **no** registration data — department, year, block, skills — ever reached the database.)
- **Files changed:**
  - `lib/auth.ts` — `applyProfileRow` now takes `email` and includes it in every upsert (and in the reduced-column fallback); `signUp` checks the write error and **parks the profile in SecureStore on failure** so the next sign-in retries (nothing is silently lost); new `reconcileRole` self-heal runs on sign-in **and** app start: if the auth user's metadata says `teacher` but the profile row is not teacher/admin, the role is repaired (existing broken teacher accounts fix themselves on next launch; admins are never touched).
  - `app/(tabs)/history.tsx` — layout cleaned up: the five scattered student stat cards + spacer replaced by the unified **Attendance Summary** card (same card as Home/Profile); record rows now use light inline meta chips (date · scanned · starts) instead of three boxed cells; **admins** now get the events-history view (previously they fell into the student branch with a bogus "Scan QR" empty state); loading copy generalized.
  - `app/(tabs)/profile.tsx` — Sign Out button removed (Settings is the single place for it); dead handler/state/styles/imports cleaned.
- **Files created:**
  - `supabase/migrations/0006_signup_trigger_role.sql` — `handle_new_user()` now writes `full_name` and the chosen `role` from user metadata so accounts are born correct; also repairs existing teacher accounts the bug left as students (`update profiles ... from auth.users where metadata role = teacher`).
- **Setup required:** run `0006` in the SQL Editor (idempotent; run `0005` first if not yet). The app-side self-heal fixes existing accounts even before the migration runs.
- **Testing performed:** live REST repro — before the fix the upsert returned HTTP 400 `23502` and the role stayed `student`; after the fix it returned 200 with `role: teacher`. `npx tsc --noEmit` clean (0 errors outside the stale nested duplicate).
- **Result:** Pass — pending 0005/0006 runs in Supabase.

### Phase 14c — Custom App Logo

- **Date:** 2026-10-19
- **Phase:** 16
- **Module:** Branding
- **Change:** user-supplied `logo.png` copied into `assets/logo.png` (downscaled 1.9 MB → ~415 KB at 512×512) and wired into the three brand spots — **Login**, **Register**, and the desktop **sidebar** — replacing the QR-code glyph. Updated to the user's newer `LOGho.png` (center-cropped to a square so it never stretches) and enlarged: Login 68 → 84 px, Register 58 → 70 px, sidebar 38 → 42 px. Per user request the navy badge behind the logo was then **removed entirely** — only the bare logo image renders (`resizeMode: contain`, no background/rounded box).
- **Setup required:** reload the app; if the new asset does not appear, restart Metro (`npx expo start --tunnel -c`).
- **Result:** Pass.

### Phase 15 — Tap-to-Select Picker Sheets (Department / Year / Block)

- **Date:** 2026-10-19
- **Phase:** 17
- **Module:** Registration + Profile edit
- **Requirements:** Department, Year Level and Block should not show all options inline. The field reads "Select Department" / "Select Year Level" / "Select Block" and tapping it opens the list of choices (per the user's `example.jpg` reference).
- **Files created:**
  - `components/ui/PickerSheet.tsx` — reusable pair: **`PickerField`** (an AppInput-styled pressable field with label, value/placeholder, chevron, hint and error text) and **`PickerSheet`** (a bottom sheet `Modal` with grabber, title, ✕ close, tappable rows with checkmark for the selected option, optional caption under each row, backdrop-tap dismiss, safe-area padding, fade + rise animation).
- **Files changed:**
  - `app/register.tsx` — Department / Year Level / Block tile grids replaced with `PickerField`s (department shows its full-name hint under the field); three `PickerSheet`s added at the screen root (department sheet carries the `DEPARTMENT_LABELS` captions; selection still clears the skills list when leaving BSIT and clears the field's validation error).
  - `app/(tabs)/profile.tsx` — same swap inside the **Edit Profile** modal; sheets render inside the modal (nested RN `Modal`).
- **Not changed:** Officer position and BSIT skills keep their tile/pill `ChipGroup`s (user only asked for the three fields).
- **Testing performed:** `npx tsc --noEmit` clean — 0 errors outside the stale nested duplicate folder.
- **Result:** Pass.

### Phase 15b — Admin History Always Empty (wrong query scope)

- **Date:** 2026-10-19
- **Phase:** 18
- **Module:** History (admin)
- **Bug:** the admin's History tab showed **0 events / 0 scans / "No events found"** even though a teacher had created events and a student had scanned one.
- **Root cause:** the admin branch reused `getTeacherEventAttendance(user.id)`, which filters `events.created_by = <user>` — so the admin only ever saw events **he himself** created (none). RLS was never the problem (verified live: with the admin's JWT, `GET /rest/v1/events` and `GET /rest/v1/attendance` both returned 200 and all rows — the teacher's 2 events and the student's 1 scan).
- **Files changed:**
  - `lib/attendance.ts` — extracted `fetchEventAttendance(createdBy | null)`; `getTeacherEventAttendance(teacherId)` wraps it with the creator filter (unchanged behavior), new **`getAllEventAttendance()`** loads every event without the filter (RLS already grants admins all events + all attendance).
  - `app/(tabs)/history.tsx` — admin branch now calls `getAllEventAttendance()` (`role` added to the load deps); subtitle for admins reads "All events across the school"; empty-state message explains teachers' events will appear there.
- **Testing performed:** live REST repro — admin sign-in (200), `GET /events` (200, 2 events), `GET /attendance` (200, 1 scan) with the admin token; `npx tsc --noEmit` clean.
- **Result:** Pass — admin History now shows every event school-wide with attendee counts (e.g. Test Event · 1 student attended, Total scans 1).

### Phase 15c — Absent Records & Tappable Event Details

- **Date:** 2026-10-19
- **Phase:** 19
- **Module:** Student attendance history (History, Home, Profile, Event detail)
- **Requirements:** missed (ended, targeted, never-scanned) events must show up as **Absent** records in History / Profile / Home, and tapping **any** record — absent, on time, late or scan — must open the event with the student's status details.
- **Files changed:**
  - `lib/attendance.ts` —
    - `AttendanceRecord` gained `eventUuid` (real UUID; `eventId` keeps holding the event code) and the history query now selects the joined event `id`.
    - `getAttendanceHistory` now merges in **synthesized absent records** (`id: absent-<event uuid>`, `status: 'absent'`, dated by the event's end) for ended events that matched the student's department/year/block audience and were never scanned; sorting/limiting happen after the merge so Home's "recent 4" and Profile's "recent 5" include absences.
    - `getStudentAttendanceSummary` now counts only events whose audience matches the student (`eventMatchesStudent`) for `endedEvents`/`attendedEnded`, so the absent count and attendance rate are no longer inflated by unrelated events (previously it counted **every** ended event in the system).
    - new `getMyEventRecord(eventId, studentId)` — the signed-in student's own row for one event (RLS-safe).
  - `app/(tabs)/history.tsx` — `RecordRow` is now a `Pressable` that navigates to `/event/<uuid>` (with a pressed state + chevron); `recordTone` returns **Absent** for absent rows; the meta chip shows "Ended {time}" instead of "Scanned {time}" for missed events.
  - `components/attendance/AttendanceRecordCard.tsx` — optional `onPress` (tappable), and the "Scanned" box becomes "Ended" for absent rows.
  - `app/(tabs)/index.tsx` (Home) — recent attendance cards navigate to the event.
  - `app/(tabs)/profile.tsx` — recent attendance rows are pressable and absent-aware (red dot, "Absent" pill, "Missed · {date}" meta — previously an absent row would have rendered "On time").
  - `app/event/[id].tsx` — new **Your attendance** card for students: On time / Late / Absent / Not scanned yet badge, scan timestamp + late-by detail, "recorded as absent" + ended time for missed events, and a **Scan QR** button when the event hasn't ended yet.
- **Testing performed:** `npx tsc --noEmit`.
- **Result:** Pass.
