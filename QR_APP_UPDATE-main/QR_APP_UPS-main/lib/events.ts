import { supabase } from './supabase';
import { isMissingColumn } from './profiles';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
};

export type EventStatus = 'active' | 'closed';

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
};

export type CreateEventInput = {
  title: string;
  eventId?: string;
  start?: string | null;
  end?: string | null;
  subject?: string | null;
  description?: string | null;
  room?: string | null;
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
    status: 'active',
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
    const end = e.end_time ? new Date(e.end_time).getTime() : null;
    const closed = e.status === 'closed' || (end !== null && now > end);
    if (closed) finished += 1;
    else live += 1;
  });
  return { total: rows.length, live, finished };
}
