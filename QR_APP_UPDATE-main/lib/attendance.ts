import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import {
  eventMatchesStudent,
  getEventByCode,
  getQrState,
  type CloudEvent,
} from './events';
import { getProfile, type Profile } from './profiles';
import {
  computeAttendanceStatus,
  evaluateScan,
  DEFAULT_GRACE_MINUTES,
  type AttendanceEvaluation,
  type AttendanceStatus,
} from './format';

export type AttendanceRecord = {
  id: string;
  /** Event code (legacy name kept for existing consumers). */
  eventId: string;
  /** Real UUID for navigating to /event/[id]. */
  eventUuid?: string | null;
  eventTitle: string;
  scannedAt: string;
  status: AttendanceStatus;
  lateBySeconds?: number;
  almostLate?: boolean;
  graceMinutes?: number | null;
  subject?: string | null;
  room?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
};

export type ScanRecord = {
  eventCode: string;
  title: string;
  subject?: string | null;
  room?: string | null;
  scannedAt: string;
  status: AttendanceStatus;
  lateBySeconds: number;
  almostLate: boolean;
  startTime?: string | null;
  endTime?: string | null;
};

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
  record?: ScanRecord;
};

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;
  attendees: {
    studentId: string;
    studentName: string | null;
    studentCode?: string | null;
    scannedAt: string;
    status?: AttendanceStatus;
  }[];
};

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export type EventAttendanceRow = {
  id: string;
  studentId: string;
  studentName: string | null;
  studentCode: string | null;
  scannedAt: string;
  status: AttendanceStatus;
  lateBySeconds: number;
  department?: string | null;
  yearLevel?: string | null;
  block?: string | null;
};

export type GroupStatRow = {
  department: string;
  yearLevel: string;
  block: string;
  attended: number;
  total: number;
  percent: number;
};

export type StudentAttendanceSummary = {
  present: number;
  late: number;
  absent: number;
  totalRecords: number;
  endedEvents: number;
  attendedEnded: number;
};

async function fetchTeacherNames(
  ids: (string | null | undefined)[]
): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (unique.length === 0) return {};
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', unique);
  const map: Record<string, string> = {};
  ((data as { id: string; full_name: string | null }[] | null) ?? []).forEach(
    (row) => {
      if (row.full_name) map[row.id] = row.full_name;
    }
  );
  return map;
}

// ---------------------------------------------------------------------------
// Record a scan
// ---------------------------------------------------------------------------
export async function registerAttendance(
  rawPayload: string,
  studentId: string,
  profileOverride?: Profile | null
): Promise<RegisterResult> {
  const parsed = parseQRPayload(rawPayload);
  if (!parsed.ok) {
    return { success: false, message: parsed.message };
  }
  const payload = parsed.payload;

  const event = await getEventByCode(payload.event);
  if (!event) {
    return { success: false, message: 'This QR code is invalid.' };
  }

  // Legacy rows from the removed approval flow can never be scanned.
  if (event.status === 'pending') {
    return {
      success: false,
      message: 'This event is not active.',
      eventTitle: event.title,
    };
  }
  if (event.status === 'rejected') {
    return {
      success: false,
      message: 'This event is no longer active.',
      eventTitle: event.title,
    };
  }
  if (event.status === 'closed') {
    return {
      success: false,
      message: 'This attendance event has already been closed.',
      eventTitle: event.title,
    };
  }

  // QR switch + QR expiry controlled by the admin.
  const qr = getQrState(event);
  if (!qr.enabled) {
    return {
      success: false,
      message: 'The QR code for this event is currently disabled.',
      eventTitle: event.title,
    };
  }
  if (qr.expired) {
    return {
      success: false,
      message: 'This QR code has expired and can no longer be scanned.',
      eventTitle: event.title,
    };
  }

  const now = Date.now();
  const start = event.start_time
    ? new Date(event.start_time).getTime()
    : payload.start
      ? new Date(payload.start).getTime()
      : null;
  const end = event.end_time
    ? new Date(event.end_time).getTime()
    : payload.end
      ? new Date(payload.end).getTime()
      : null;

  // Students can ONLY scan once the event has started.
  if (start !== null && now < start) {
    return {
      success: false,
      message: 'This event has not started yet. You can scan once it begins.',
      eventTitle: event.title,
    };
  }
  if (end !== null && now > end) {
    return {
      success: false,
      message: 'This attendance event has already ended.',
      eventTitle: event.title,
    };
  }

  const scannedAt = new Date().toISOString();
  const grace = event.late_grace_minutes ?? DEFAULT_GRACE_MINUTES;
  const evaluation = evaluateScan(scannedAt, event.start_time, grace);
  const status = evaluation.status;

  // Snapshot the student's department / year / block so records stay
  // grouped correctly even if the profile changes later.
  const profile = profileOverride ?? (await getProfile(studentId));

  const row: Record<string, unknown> = {
    student_id: studentId,
    event_id: event.id,
    scanned_at: scannedAt,
    status,
    late_by_seconds: evaluation.lateBySeconds,
    department: profile?.department ?? null,
    year_level: profile?.year_level ?? null,
    block: profile?.block ?? null,
  };

  const { error: attError } = await supabase.from('attendance').insert([row]);

  if (attError) {
    if (attError.code === '23505') {
      return {
        success: false,
        message: 'You have already recorded attendance for this event.',
        eventTitle: event.title,
      };
    }
    if (attError.code === '42703') {
      const { error: retryError } = await supabase.from('attendance').insert([
        {
          student_id: studentId,
          event_id: event.id,
          scanned_at: scannedAt,
        },
      ]);
      if (retryError && retryError.code !== '23505') {
        return { success: false, message: 'Unable to save attendance. Please try again.' };
      }
      if (retryError?.code === '23505') {
        return {
          success: false,
          message: 'You have already recorded attendance for this event.',
          eventTitle: event.title,
        };
      }
    } else {
      return { success: false, message: 'Unable to save attendance. Please try again.' };
    }
  }

  supabase
    .from('notifications')
    .insert([
      {
        user_id: studentId,
        type: 'attendance',
        title: 'Attendance recorded',
        body: `Your attendance for "${event.title}" was recorded as ${status.toUpperCase()}.`,
        event_id: event.id,
        dedupe_key: `attendance:${event.id}:${studentId}`,
      },
    ])
    .then(() => {});

  const record: ScanRecord = {
    eventCode: event.event_code,
    title: event.title,
    subject: event.subject ?? null,
    room: event.room ?? null,
    scannedAt,
    status,
    lateBySeconds: evaluation.lateBySeconds,
    almostLate: evaluation.almostLate,
    startTime: event.start_time,
    endTime: event.end_time,
  };

  return {
    success: true,
    message: 'Attendance recorded!',
    eventTitle: event.title,
    record,
  };
}

// ---------------------------------------------------------------------------
// Student history
// ---------------------------------------------------------------------------
export async function getAttendanceHistory(
  studentId: string,
  limit?: number
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select(
      'id, scanned_at, status, late_by_seconds, events ( id, event_code, title, subject, room, start_time, end_time, late_grace_minutes, created_by )'
    )
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as {
    id: string;
    scanned_at: string;
    status?: AttendanceStatus | null;
    late_by_seconds?: number | null;
    events: {
      id: string;
      event_code: string;
      title: string;
      subject?: string | null;
      room?: string | null;
      start_time: string | null;
      end_time: string | null;
      late_grace_minutes?: number | null;
      created_by: string | null;
    } | null;
  }[];

  // Missed events: ended, meant for this student (audience match), never scanned.
  const [endedResult, profile] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .not('end_time', 'is', null)
      .lte('end_time', new Date().toISOString())
      .order('start_time', { ascending: false }),
    getProfile(studentId),
  ]);

  const scannedCodes = new Set(
    rows.map((r) => r.events?.event_code).filter((c): c is string => !!c)
  );
  const missedEvents = ((endedResult.data ?? []) as CloudEvent[]).filter(
    (e) =>
      !scannedCodes.has(e.event_code) &&
      e.status !== 'rejected' &&
      eventMatchesStudent(e, profile)
  );

  const teacherNames = await fetchTeacherNames([
    ...rows.map((r) => r.events?.created_by),
    ...missedEvents.map((e) => e.created_by),
  ]);

  const scannedRecords: AttendanceRecord[] = rows.map((row) => {
    const grace = row.events?.late_grace_minutes ?? DEFAULT_GRACE_MINUTES;
    const evaluation: AttendanceEvaluation =
      row.status ?? row.late_by_seconds
        ? {
            status: row.status === 'late' ? 'late' : 'present',
            lateBySeconds: row.late_by_seconds ?? 0,
            almostLate: false,
            secondsToLate: 0,
          }
        : evaluateScan(row.scanned_at, row.events?.start_time ?? null, grace);

    return {
      id: row.id,
      eventId: row.events?.event_code ?? '',
      eventUuid: row.events?.id ?? null,
      eventTitle: row.events?.title ?? '',
      scannedAt: row.scanned_at,
      status: evaluation.status,
      lateBySeconds: evaluation.lateBySeconds,
      almostLate: evaluation.almostLate,
      graceMinutes: row.events?.late_grace_minutes ?? null,
      subject: row.events?.subject ?? null,
      room: row.events?.room ?? null,
      startTime: row.events?.start_time ?? null,
      endTime: row.events?.end_time ?? null,
      teacherId: row.events?.created_by ?? null,
      teacherName: row.events?.created_by
        ? teacherNames[row.events.created_by] ?? null
        : null,
    };
  });

  const missedRecords: AttendanceRecord[] = missedEvents.map((e) => ({
    id: `absent-${e.id}`,
    eventId: e.event_code,
    eventUuid: e.id,
    eventTitle: e.title,
    scannedAt: e.end_time ?? e.start_time ?? new Date().toISOString(),
    status: 'absent' as const,
    graceMinutes: e.late_grace_minutes ?? null,
    subject: e.subject ?? null,
    room: e.room ?? null,
    startTime: e.start_time ?? null,
    endTime: e.end_time ?? null,
    teacherId: e.created_by ?? null,
    teacherName: e.created_by ? teacherNames[e.created_by] ?? null : null,
  }));

  const merged = [...scannedRecords, ...missedRecords].sort(
    (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
  );
  return limit ? merged.slice(0, limit) : merged;
}

export async function getStudentAttendanceSummary(
  studentId: string
): Promise<StudentAttendanceSummary> {
  const now = Date.now();
  const [attendanceResult, eventsResult, profile] = await Promise.all([
    supabase
      .from('attendance')
      .select('id, scanned_at, status, events ( id, start_time, end_time )')
      .eq('student_id', studentId),
    supabase
      .from('events')
      .select('*')
      .not('end_time', 'is', null)
      .lte('end_time', new Date().toISOString()),
    getProfile(studentId),
  ]);

  const rows = (attendanceResult.data as unknown as {
    scanned_at: string;
    status?: AttendanceStatus | null;
    events: {
      id: string;
      start_time: string | null;
      end_time: string | null;
    } | null;
  }[]) ?? [];

  // Only ended events that targeted this student count toward the rate.
  const relevantEnded = ((eventsResult.data ?? []) as CloudEvent[]).filter(
    (e) => e.status !== 'rejected' && eventMatchesStudent(e, profile)
  );
  const relevantIds = new Set(relevantEnded.map((e) => e.id));

  let present = 0;
  let late = 0;
  let attendedEnded = 0;

  rows.forEach((row) => {
    const status =
      row.status ??
      computeAttendanceStatus(row.scanned_at, row.events?.start_time ?? null);
    if (status === 'late') late += 1;
    else present += 1;

    const end = row.events?.end_time
      ? new Date(row.events.end_time).getTime()
      : null;
    if (
      end !== null &&
      end <= now &&
      row.events?.id &&
      relevantIds.has(row.events.id)
    ) {
      attendedEnded += 1;
    }
  });

  const endedEvents = relevantEnded.length;
  const absent = Math.max(0, endedEvents - attendedEnded);

  return {
    present,
    late,
    absent,
    totalRecords: rows.length,
    endedEvents,
    attendedEnded,
  };
}

export type MyEventRecord = {
  id: string;
  scanned_at: string;
  status?: AttendanceStatus | null;
  late_by_seconds?: number | null;
};

/**
 * The signed-in student's own row for one event (RLS only allows reading
 * your own attendance), used by the event screen's "Your attendance" card.
 */
export async function getMyEventRecord(
  eventId: string,
  studentId: string
): Promise<MyEventRecord | null> {
  const { data } = await supabase
    .from('attendance')
    .select('id, scanned_at, status, late_by_seconds')
    .eq('event_id', eventId)
    .eq('student_id', studentId)
    .maybeSingle();
  return (data as MyEventRecord | null) ?? null;
}

// ---------------------------------------------------------------------------
// Per-event records
// ---------------------------------------------------------------------------
export async function getEventAttendanceRecords(
  eventId: string
): Promise<EventAttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, student_id, scanned_at, status, late_by_seconds, department, year_level, block')
    .eq('event_id', eventId)
    .order('scanned_at', { ascending: true });

  if (error || !data) return [];

  const rows = data as {
    id: string;
    student_id: string;
    scanned_at: string;
    status?: AttendanceStatus | null;
    late_by_seconds?: number | null;
    department?: string | null;
    year_level?: string | null;
    block?: string | null;
  }[];

  const ids = [...new Set(rows.map((r) => r.student_id))];
  let profiles: {
    id: string;
    full_name: string | null;
    student_id: string | null;
    department?: string | null;
    year_level?: string | null;
    block?: string | null;
  }[] = [];
  if (ids.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, full_name, student_id, department, year_level, block')
      .in('id', ids);
    profiles = (profData as typeof profiles | null) ?? [];
  }
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return rows.map((row) => {
    const profile = profileMap.get(row.student_id);
    return {
      id: row.id,
      studentId: row.student_id,
      studentName: profile?.full_name ?? null,
      studentCode: profile?.student_id ?? null,
      scannedAt: row.scanned_at,
      status: row.status ?? 'present',
      lateBySeconds: row.late_by_seconds ?? 0,
      department: row.department ?? profile?.department ?? null,
      yearLevel: row.year_level ?? profile?.year_level ?? null,
      block: row.block ?? profile?.block ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// Analytics: "BSIT - 1st Year - Block A: 20% (20 of 100)"
// ---------------------------------------------------------------------------
export async function getEventGroupStats(eventId: string): Promise<GroupStatRow[]> {
  const { data, error } = await supabase.rpc('event_group_stats', {
    p_event: eventId,
  });

  if (error || !data) return [];

  return ((data as {
    department: string;
    year_level: string;
    block: string;
    attended: number;
    total: number;
    percent: number;
  }[]) ?? []).map((row) => ({
    department: row.department,
    yearLevel: row.year_level,
    block: row.block,
    attended: Number(row.attended ?? 0),
    total: Number(row.total ?? 0),
    percent: Number(row.percent ?? 0),
  }));
}

export type DepartmentSummaryRow = {
  department: string;
  students: number;
  scans: number;
};

export async function getDepartmentSummary(): Promise<DepartmentSummaryRow[]> {
  const { data, error } = await supabase.rpc('department_summary');
  if (error || !data) return [];
  return ((data as {
    department: string;
    students: number;
    scans: number;
  }[]) ?? []).map((row) => ({
    department: row.department,
    students: Number(row.students ?? 0),
    scans: Number(row.scans ?? 0),
  }));
}

// ---------------------------------------------------------------------------
// Teacher views
// ---------------------------------------------------------------------------
/** Shared loader for event + attendee history; optionally limited to one creator. */
async function fetchEventAttendance(
  createdBy: string | null
): Promise<TeacherEventAttendance[]> {
  const base = supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time');
  const { data: events, error: eventError } = await (createdBy
    ? base.eq('created_by', createdBy)
    : base
  ).order('created_at', { ascending: false });

  if (eventError || !events) return [];

  const eventIds = (events as { id: string }[]).map((e) => e.id);
  if (eventIds.length === 0) return [];

  const { data: attendance, error: attError } = await supabase
    .from('attendance')
    .select('student_id, scanned_at, event_id, status')
    .in('event_id', eventIds)
    .order('scanned_at', { ascending: false });

  if (attError || !attendance) {
    return (events as CloudEventLite[]).map((e) => ({
      eventId: e.id,
      eventCode: e.event_code,
      title: e.title,
      startTime: e.start_time,
      endTime: e.end_time,
      attendeeCount: 0,
      attendees: [],
    }));
  }

  const studentIds = [
    ...new Set((attendance as { student_id: string }[]).map((a) => a.student_id)),
  ];
  let nameMap: Record<string, string | null> = {};
  if (studentIds.length > 0) {
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', studentIds);
    ((profs as { id: string; full_name: string | null }[] | null) ?? []).forEach(
      (p) => {
        nameMap[p.id] = p.full_name ?? null;
      }
    );
  }

  return (events as CloudEventLite[]).map((e) => {
    const rows = (attendance as AttendanceLite[]).filter(
      (a) => a.event_id === e.id
    );
    return {
      eventId: e.id,
      eventCode: e.event_code,
      title: e.title,
      startTime: e.start_time,
      endTime: e.end_time,
      attendeeCount: rows.length,
      attendees: rows.map((a) => ({
        studentId: a.student_id,
        studentName: nameMap[a.student_id] ?? null,
        scannedAt: a.scanned_at,
        status: a.status ?? 'present',
      })),
    };
  });
}

/** Teacher: only the events they created. */
export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  return fetchEventAttendance(teacherId);
}

/** Admin: every event in the system with its attendees (RLS lets admins read all). */
export async function getAllEventAttendance(): Promise<TeacherEventAttendance[]> {
  return fetchEventAttendance(null);
}

type CloudEventLite = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
};

type AttendanceLite = {
  student_id: string;
  scanned_at: string;
  event_id: string;
  status?: AttendanceStatus | null;
};

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventError || !events) return [];

  const eventIds = (events as { id: string }[]).map((e) => e.id);
  if (eventIds.length === 0) return [];

  const { data: attRows, error: attError } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError || !attRows) {
    return (events as { id: string; event_code: string; title: string }[]).map(
      (e) => ({
        eventId: e.id,
        eventCode: e.event_code,
        title: e.title,
        attendeeCount: 0,
      })
    );
  }

  const counts: Record<string, number> = {};
  (attRows as { event_id: string }[]).forEach((r) => {
    counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
  });

  return (events as { id: string; event_code: string; title: string }[]).map(
    (e) => ({
      eventId: e.id,
      eventCode: e.event_code,
      title: e.title,
      attendeeCount: counts[e.id] ?? 0,
    })
  );
}
