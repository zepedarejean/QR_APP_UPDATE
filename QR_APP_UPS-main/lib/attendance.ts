import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import { getEventByCode } from './events';
import { computeAttendanceStatus, type AttendanceStatus } from './format';

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
  status: AttendanceStatus;
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

export async function registerAttendance(
  rawPayload: string,
  studentId: string
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

  if (event.status === 'closed') {
    return {
      success: false,
      message: 'This attendance event has already been closed.',
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

  if (start !== null && now < start) {
    return {
      success: false,
      message: 'This event has not started yet.',
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
  const status = computeAttendanceStatus(scannedAt, event.start_time);

  const { error: attError } = await supabase.from('attendance').insert([
    {
      student_id: studentId,
      event_id: event.id,
      scanned_at: scannedAt,
      status,
    },
  ]);

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

export async function getAttendanceHistory(
  studentId: string,
  limit?: number
): Promise<AttendanceRecord[]> {
  let query = supabase
    .from('attendance')
    .select(
      'id, scanned_at, status, events ( event_code, title, subject, room, start_time, end_time, created_by )'
    )
    .eq('student_id', studentId)
    .order('scanned_at', { ascending: false });

  if (limit) query = query.limit(limit);

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const rows = data as unknown as {
    id: string;
    scanned_at: string;
    status?: AttendanceStatus | null;
    events: {
      event_code: string;
      title: string;
      subject?: string | null;
      room?: string | null;
      start_time: string | null;
      end_time: string | null;
      created_by: string | null;
    } | null;
  }[];

  const teacherNames = await fetchTeacherNames(
    rows.map((r) => r.events?.created_by)
  );

  return rows.map((row) => ({
    id: row.id,
    eventId: row.events?.event_code ?? '',
    eventTitle: row.events?.title ?? '',
    scannedAt: row.scanned_at,
    status:
      row.status ??
      computeAttendanceStatus(row.scanned_at, row.events?.start_time ?? null),
    subject: row.events?.subject ?? null,
    room: row.events?.room ?? null,
    startTime: row.events?.start_time ?? null,
    endTime: row.events?.end_time ?? null,
    teacherId: row.events?.created_by ?? null,
    teacherName: row.events?.created_by
      ? teacherNames[row.events.created_by] ?? null
      : null,
  }));
}

export async function getStudentAttendanceSummary(
  studentId: string
): Promise<StudentAttendanceSummary> {
  const [attendanceResult, eventsResult] = await Promise.all([
    supabase
      .from('attendance')
      .select('id, scanned_at, status, events ( start_time, end_time )')
      .eq('student_id', studentId),
    supabase
      .from('events')
      .select('id, end_time')
      .not('end_time', 'is', null)
      .lt('end_time', new Date().toISOString()),
  ]);

  const rows = (attendanceResult.data as unknown as {
    scanned_at: string;
    status?: AttendanceStatus | null;
    events: { start_time: string | null; end_time: string | null } | null;
  }[]) ?? [];

  let present = 0;
  let late = 0;
  let attendedEnded = 0;
  const now = Date.now();

  rows.forEach((row) => {
    const status =
      row.status ??
      computeAttendanceStatus(row.scanned_at, row.events?.start_time ?? null);
    if (status === 'late') late += 1;
    else present += 1;

    const end = row.events?.end_time
      ? new Date(row.events.end_time).getTime()
      : null;
    if (end !== null && end <= now) attendedEnded += 1;
  });

  const endedEvents = ((eventsResult.data as { id: string }[] | null) ?? []).length;
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

export async function getEventAttendanceRecords(
  eventId: string
): Promise<EventAttendanceRow[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('id, student_id, scanned_at, status')
    .eq('event_id', eventId)
    .order('scanned_at', { ascending: true });

  if (error || !data) return [];

  const rows = data as {
    id: string;
    student_id: string;
    scanned_at: string;
    status?: AttendanceStatus | null;
  }[];

  const ids = [...new Set(rows.map((r) => r.student_id))];
  let profiles: { id: string; full_name: string | null; student_id: string | null }[] = [];
  if (ids.length > 0) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('id, full_name, student_id')
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
    };
  });
}

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  const { data: events, error: eventError } = await supabase
    .from('events')
    .select('id, event_code, title, start_time, end_time')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

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
