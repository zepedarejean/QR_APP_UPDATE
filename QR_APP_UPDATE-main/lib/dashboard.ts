import { supabase } from './supabase';
import {
  getAttendanceHistory,
  getStudentAttendanceSummary,
  getDepartmentSummary,
  type AttendanceRecord,
  type DepartmentSummaryRow,
  type StudentAttendanceSummary,
} from './attendance';
import {
  countTeacherEvents,
  getAllEvents,
  getEventsByTeacher,
  getEventsForStudent,
  type CloudEvent,
} from './events';
import type { Profile } from './profiles';

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

export type AdminDashboard = {
  totalEvents: number;
  activeEvents: number;
  closedEvents: number;
  totalStudents: number;
  totalTeachers: number;
  totalScans: number;
  departments: DepartmentSummaryRow[];
};

export async function getStudentDashboard(
  userId: string,
  profile?: Profile | null
): Promise<StudentDashboard> {
  const [summary, recent, upcoming] = await Promise.all([
    getStudentAttendanceSummary(userId),
    getAttendanceHistory(userId, 4),
    getEventsForStudent(profile, 4),
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
      return (
        e.status !== 'closed' &&
        e.status !== 'pending' &&
        e.status !== 'rejected' &&
        (end === null || end >= Date.now())
      );
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

export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [events, peopleCounts, scans, departments] = await Promise.all([
    getAllEvents(500),
    supabase
      .from('profiles')
      .select('role')
      .in('role', ['student', 'teacher']),
    supabase.from('attendance').select('id', { count: 'exact', head: true }),
    getDepartmentSummary(),
  ]);

  const rows = (peopleCounts.data as { role: string }[] | null) ?? [];

  return {
    totalEvents: events.length,
    activeEvents: events.filter((e) => e.status === 'active').length,
    closedEvents: events.filter((e) => e.status === 'closed').length,
    totalStudents: rows.filter((r) => r.role === 'student').length,
    totalTeachers: rows.filter((r) => r.role === 'teacher').length,
    totalScans: scans.count ?? 0,
    departments,
  };
}
