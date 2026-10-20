import { supabase } from './supabase';
import {
  getAttendanceHistory,
  getStudentAttendanceSummary,
  type AttendanceRecord,
  type StudentAttendanceSummary,
} from './attendance';
import {
  countTeacherEvents,
  getEventsByTeacher,
  getUpcomingEvents,
  type CloudEvent,
} from './events';

export type StudentDashboard = {
  summary: StudentAttendanceSummary;
  recent: AttendanceRecord[];
  upcoming: CloudEvent[];
};

export type TeacherDashboard = {
  totalEvents: number;
  liveEvents: number;
  finishedEvents: number;
  totalScans: number;
  eventsWithAttendance: number;
  upcoming: CloudEvent[];
  recent: CloudEvent[];
};

export async function getStudentDashboard(
  userId: string
): Promise<StudentDashboard> {
  const [summary, recent, upcoming] = await Promise.all([
    getStudentAttendanceSummary(userId),
    getAttendanceHistory(userId, 4),
    getUpcomingEvents(4),
  ]);
  return { summary, recent, upcoming };
}

export async function getTeacherDashboard(
  userId: string
): Promise<TeacherDashboard> {
  const [counts, events] = await Promise.all([
    countTeacherEvents(userId),
    getEventsByTeacher(userId),
  ]);

  const upcoming = events
    .filter((e) => {
      const end = e.end_time ? new Date(e.end_time).getTime() : null;
      return e.status !== 'closed' && (end === null || end >= Date.now());
    })
    .slice(0, 4);

  const recent = events.slice(0, 4);

  let totalScans = 0;
  let eventsWithAttendance = 0;
  if (events.length > 0) {
    const ids = events.map((e) => e.id);
    const { data } = await supabase
      .from('attendance')
      .select('event_id')
      .in('event_id', ids);
    const rows = (data as { event_id: string }[] | null) ?? [];
    totalScans = rows.length;
    eventsWithAttendance = new Set(rows.map((r) => r.event_id)).size;
  }

  return {
    totalEvents: counts.total,
    liveEvents: counts.live,
    finishedEvents: counts.finished,
    totalScans,
    eventsWithAttendance,
    upcoming,
    recent,
  };
}
