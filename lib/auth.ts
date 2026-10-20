import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import {
  DEPARTMENT_LABELS,
  isMissingColumn,
  type Department,
} from './profiles';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;
let globalUser: User | null = null;
let globalLoading = true;
let initialized = false;
let listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

async function initAuth() {
  if (initialized) return;
  initialized = true;
  try {
    const { data } = await supabase.auth.getSession();
    globalSession = data.session;
    globalUser = data.session?.user ?? null;
    if (globalUser) {
      // Repair a role that the old signup bug left at the default,
      // before any screen reads the profile.
      await reconcileRole(globalUser.id);
    }
  } catch {
    globalSession = null;
    globalUser = null;
  } finally {
    globalLoading = false;
    notify();
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    globalSession = session;
    globalUser = session?.user ?? null;
    globalLoading = false;
    notify();
  });
}

export function setAuth(session: Session | null) {
  globalSession = session;
  globalUser = session?.user ?? null;
  globalLoading = false;
  notify();
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    initAuth();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

export type SignUpProfile = {
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  student_id?: string | null;
  department?: string | null;
  year_level?: string | null;
  block?: string | null;
  is_class_officer?: boolean;
  officer_position?: string | null;
  skills?: string[];
};

const PENDING_PROFILE_KEY = 'qratt.pendingProfile';

/**
 * Build the profiles row from the registration form. Department doubles as
 * the course (e.g. BSIT -> "BS Information Technology") so we never store
 * two conflicting values for the same thing.
 */
function buildProfileRow(profile: SignUpProfile): Record<string, unknown> {
  const row: Record<string, unknown> = {
    full_name: profile.full_name,
    role: profile.role,
  };
  if (profile.student_id) row.student_id = profile.student_id.trim();
  if (profile.role === 'student') {
    if (profile.department) {
      row.department = profile.department;
      row.course =
        DEPARTMENT_LABELS[profile.department as Department] ?? profile.department;
    }
    if (profile.year_level) row.year_level = profile.year_level;
    if (profile.block) {
      row.block = profile.block;
      row.section = profile.block.replace(/^Block\s*/i, '') || profile.block;
    }
    row.is_class_officer = !!profile.is_class_officer;
    row.officer_position = profile.is_class_officer
      ? profile.officer_position ?? null
      : null;
    row.skills = profile.skills ?? [];
  }
  return row;
}

/**
 * Write the profile row. Upserts so it works whether or not the signup
 * trigger has created the row yet, and falls back to the pre-0003 columns
 * when the new columns have not been migrated.
 *
 * `email` must be part of every upsert: it is NOT NULL in profiles and
 * the signup trigger usually creates the row first, so an upsert without
 * it dies on the not-null constraint (the row already exists, but
 * Postgres still checks the proposed insert tuple).
 */
export async function applyProfileRow(
  userId: string,
  row: Record<string, unknown>,
  email: string
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {
    id: userId,
    email,
    ...row,
  };

  let { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error && isMissingColumn(error)) {
    const safe: Record<string, unknown> = { id: userId, email };
    for (const key of ['full_name', 'role', 'student_id', 'course', 'section']) {
      if (payload[key] !== undefined) safe[key] = payload[key];
    }
    ({ error } = await supabase.from('profiles').upsert(safe, { onConflict: 'id' }));
  }

  return { error: error?.message ?? null };
}

/**
 * If the user registered while email confirmation was ON, the profile
 * payload is parked here and flushed the first time they sign in.
 */
async function savePendingProfile(
  email: string,
  row: Record<string, unknown>
): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      `${PENDING_PROFILE_KEY}:${email.toLowerCase()}`,
      JSON.stringify(row)
    );
  } catch {
    // Non-fatal: the student can still fill things in from Profile later.
  }
}

export async function applyPendingProfile(
  userId: string,
  email: string | undefined | null
): Promise<void> {
  if (!email) return;
  const key = `${PENDING_PROFILE_KEY}:${email.toLowerCase()}`;
  try {
    const stored = await SecureStore.getItemAsync(key);
    if (!stored) return;
    const row = JSON.parse(stored) as Record<string, unknown>;
    const { error } = await applyProfileRow(userId, row, email);
    if (!error) {
      // Only clear the parked data once it actually reached the database.
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // Keep whatever is parked — it will be retried on the next sign-in.
  }
}

/**
 * Self-heal for accounts registered before the signup write was fixed:
 * their profile row stayed at the trigger default ('student') even though
 * the user chose Teacher. The chosen role is stored on the auth user's
 * metadata, so compare and repair — never touching admins.
 */
async function reconcileRole(userId: string): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const metaRole = (auth.user?.user_metadata?.role ?? null) as string | null;
    if (metaRole !== 'teacher') return;

    const { data: row } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle();
    if (row && row.role !== 'teacher' && row.role !== 'admin') {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'teacher' })
        .eq('id', userId);
      if (!error) notify();
    }
  } catch {
    // Best effort: a failed heal never blocks sign-in.
  }
}

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Also stored on the auth user — a backup of who this
      // account is, even if the profile row write fails.
      data: profile
        ? { full_name: profile.full_name, role: profile.role }
        : undefined,
    },
  });
  if (!error && data.user && profile) {
    const row = buildProfileRow(profile);
    if (data.session) {
      // Confirmation disabled: write the profile right away. If the write
      // fails for any reason, park it so the next sign-in retries it —
      // nothing the user typed is ever silently lost.
      const { error: rowError } = await applyProfileRow(
        data.user.id,
        row,
        email.trim()
      );
      if (rowError) await savePendingProfile(email, row);
    } else {
      // Email confirmation enabled: park the profile and apply it on
      // the first sign-in, so nothing the student typed is lost.
      await savePendingProfile(email, row);
    }
  }
  if (!error && data.session) {
    setAuth(data.session);
  }
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (!error && data.session) {
    setAuth(data.session);
    // Flush anything parked during a confirmation-required signup.
    await applyPendingProfile(data.session.user.id, data.session.user.email ?? email);
    // Repair a role that the old signup bug left at the default.
    await reconcileRole(data.session.user.id);
  }
  return { data, error };
}

export async function signOut() {
  setAuth(null);
  supabase.auth.signOut().catch(() => {});
  return { error: null };
}
