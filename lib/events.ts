import { supabase } from './supabase';
import { isMissingColumn } from './profiles';
import type { Profile } from './profiles';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
};

/**
 * active    -> live, students can see + scan it
 * closed    -> manually closed, nobody can scan anymore
 * pending   -> legacy state from the removed approval flow; the app no
 *              longer creates events in this state
 * rejected  -> legacy state from the removed approval flow; the app no
 *              longer creates events in this state
 */
export type EventStatus = 'pending' | 'active' | 'rejected' | 'closed';

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
  subject?: string | null;
  description?: string | null;
  room?: string | null;
  status?: EventStatus | null;
  approved_by?: string | null;
  approved_at?: string | null;
  /** Admin/owner switch: when false the QR cannot be scanned at all. */
  qr_active?: boolean | null;
  /** Hard expiry for the QR code. After this the QR is dead until reset. */
  qr_expires_at?: string | null;
  /** Minutes after the start time a student is still "present". */
  late_grace_minutes?: number | null;
  target_departments?: string[] | null;
  target_year_levels?: string[] | null;
  target_blocks?: string[] | null;
};

export type CreateEventInput = {
  title: string;
  eventId?: string;
  start?: string | null;
  end?: string | null;
  subject?: string | null;
  description?: string | null;
  room?: string | null;
  lateGraceMinutes?: number;
  targetDepartments?: string[] | null;
  targetYearLevels?: string[] | null;
  targetBlocks?: string[] | null;
};

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateEventCode(): string {
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  const year = new Date().getFullYear();
  return `EVT-${year}-${code}`;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export async function createEvent(
  input: CreateEventInput
): Promise<{ error: string | null; event: CloudEvent | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const base: Record<string, unknown> = {
    event_code: input.eventId?.trim() || generateEventCode(),
    title: input.title.trim(),
    start_time: input.start ?? null,
    end_time: input.end ?? null,
    created_by: user?.id ?? null,
  };

  const extended: Record<string, unknown> = {
    ...base,
    subject: input.subject?.trim() || null,
    description: input.description?.trim() || null,
    room: input.room?.trim() || null,
    // Events go live immediately — there is no approval step.
    status: 'active',
    qr_active: true,
    late_grace_minutes: Math.max(0, Math.round(input.lateGraceMinutes ?? 5)),
    target_departments:
      input.targetDepartments && input.targetDepartments.length > 0
        ? input.targetDepartments
        : null,
    target_year_levels:
      input.targetYearLevels && input.targetYearLevels.length > 0
        ? input.targetYearLevels
        : null,
    target_blocks:
      input.targetBlocks && input.targetBlocks.length > 0 ? input.targetBlocks : null,
  };

  const { data, error } = await supabase
    .from('events')
    .upsert(extended, { onConflict: 'event_code' })
    .select('*')
    .single();

  if (error && isMissingColumn(error)) {
    const retry = await supabase
      .from('events')
      .upsert(base, { onConflict: 'event_code' })
      .select('*')
      .single();
    if (retry.error) {
      return { error: retry.error.message, event: null };
    }
    return { error: null, event: retry.data as CloudEvent };
  }

  if (error) {
    return { error: error.message, event: null };
  }

  return { error: null, event: data as CloudEvent };
}

// ---------------------------------------------------------------------------
// QR control (admin / owner)
// ---------------------------------------------------------------------------
export async function updateQrSettings(
  id: string,
  settings: { qr_active?: boolean; qr_expires_at?: string | null }
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {};
  if (settings.qr_active !== undefined) patch.qr_active = settings.qr_active;
  if (settings.qr_expires_at !== undefined) patch.qr_expires_at = settings.qr_expires_at;
  const { error } = await supabase.from('events').update(patch).eq('id', id);
  return { error: error?.message ?? null };
}

export type QrState = {
  /** QR is switched on. */
  enabled: boolean;
  /** A hard expiry is set and it has already passed. */
  expired: boolean;
  /** Can a student scan this QR right now (ignoring start/end window)? */
  scannable: boolean;
};

export function getQrState(event: CloudEvent, now = Date.now()): QrState {
  const enabled = event.qr_active !== false;
  const expiresAt = event.qr_expires_at ? new Date(event.qr_expires_at).getTime() : null;
  const expired = expiresAt !== null && now > expiresAt;
  return { enabled, expired, scannable: enabled && !expired };
}

/** True when the QR should still be drawn on screen. */
export function isQrVisible(event: CloudEvent, now = Date.now()): boolean {
  return getQrState(event, now).scannable;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------
export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as CloudEvent[];
}

export async function getAllEvents(limit = 200): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as CloudEvent[];
}

export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CloudEvent;
}

export async function getEventById(id: string): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CloudEvent;
}

export async function updateEventStatus(
  id: string,
  status: EventStatus
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('events')
    .update({ status })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export type UpdateEventInput = {
  title?: string;
  subject?: string | null;
  description?: string | null;
  room?: string | null;
  start?: string | null;
  end?: string | null;
  lateGraceMinutes?: number;
  targetDepartments?: string[] | null;
  targetYearLevels?: string[] | null;
  targetBlocks?: string[] | null;
};

export async function updateEvent(
  id: string,
  input: UpdateEventInput
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.subject !== undefined) patch.subject = input.subject?.trim() || null;
  if (input.description !== undefined)
    patch.description = input.description?.trim() || null;
  if (input.room !== undefined) patch.room = input.room?.trim() || null;
  if (input.start !== undefined) patch.start_time = input.start;
  if (input.end !== undefined) patch.end_time = input.end;
  if (input.lateGraceMinutes !== undefined)
    patch.late_grace_minutes = Math.max(0, Math.round(input.lateGraceMinutes));
  if (input.targetDepartments !== undefined)
    patch.target_departments =
      input.targetDepartments && input.targetDepartments.length > 0
        ? input.targetDepartments
        : null;
  if (input.targetYearLevels !== undefined)
    patch.target_year_levels =
      input.targetYearLevels && input.targetYearLevels.length > 0
        ? input.targetYearLevels
        : null;
  if (input.targetBlocks !== undefined)
    patch.target_blocks =
      input.targetBlocks && input.targetBlocks.length > 0 ? input.targetBlocks : null;

  const { error } = await supabase.from('events').update(patch).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteEvent(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function getUpcomingEvents(limit = 5): Promise<CloudEvent[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .or(`end_time.is.null,end_time.gte.${now}`)
    .order('start_time', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data as CloudEvent[];
}

/**
 * Events a student should see: matching their department / year / block
 * when the event targets a specific group.
 */
export async function getEventsForStudent(
  profile: Profile | null | undefined,
  limit = 20
): Promise<CloudEvent[]> {
  const all = await getUpcomingEvents(150);
  return all.filter((e) => eventMatchesStudent(e, profile)).slice(0, limit);
}

export function eventMatchesStudent(
  event: CloudEvent,
  profile: Profile | null | undefined
): boolean {
  if (!profile) return true;
  const deps = event.target_departments;
  const years = event.target_year_levels;
  const blocks = event.target_blocks;
  if (
    (!deps || deps.length === 0) &&
    (!years || years.length === 0) &&
    (!blocks || blocks.length === 0)
  ) {
    return true;
  }
  if (deps && deps.length > 0 && !(profile.department && deps.includes(profile.department)))
    return false;
  if (years && years.length > 0 && !(profile.year_level && years.includes(profile.year_level)))
    return false;
  if (blocks && blocks.length > 0 && !(profile.block && blocks.includes(profile.block)))
    return false;
  return true;
}

export async function countTeacherEvents(teacherId: string): Promise<{
  total: number;
  live: number;
  finished: number;
}> {
  const { data } = await supabase
    .from('events')
    .select('id, start_time, end_time, status')
    .eq('created_by', teacherId);

  const rows = (data as CloudEvent[] | null) ?? [];
  const now = Date.now();
  let live = 0;
  let finished = 0;
  rows.forEach((e) => {
    // Legacy rows from the removed approval flow never went live.
    if (e.status === 'pending' || e.status === 'rejected') return;
    const end = e.end_time ? new Date(e.end_time).getTime() : null;
    const closed = e.status === 'closed' || (end !== null && now > end);
    if (closed) finished += 1;
    else live += 1;
  });
  return { total: rows.length, live, finished };
}
