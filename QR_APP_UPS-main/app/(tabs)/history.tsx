import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import {
  getAttendanceHistory,
  getStudentAttendanceSummary,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import { getEventPhase, type AttendanceStatus } from '@/lib/format';
import ScreenHeader from '@/components/ui/ScreenHeader';
import NotificationBell from '@/components/notifications/NotificationBell';
import SearchBar from '@/components/ui/SearchBar';
import FilterTabs, { type FilterOption } from '@/components/ui/FilterTabs';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import AttendanceRecordCard from '@/components/attendance/AttendanceRecordCard';
import EventCard from '@/components/dashboard/EventCard';

type StudentFilter = 'all' | AttendanceStatus;
type TeacherFilter = 'all' | 'upcoming' | 'live' | 'ended';
type SortOrder = 'newest' | 'oldest';

export default function HistoryScreen() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [events, setEvents] = useState<TeacherEventAttendance[]>([]);
  const [summary, setSummary] = useState<{
    present: number;
    late: number;
    absent: number;
    endedEvents: number;
    attendedEnded: number;
    totalRecords: number;
  } | null>(null);

  const [query, setQuery] = useState('');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');
  const [teacherFilter, setTeacherFilter] = useState<TeacherFilter>('all');
  const [sort, setSort] = useState<SortOrder>('newest');

  const role = profile?.role ?? 'student';

  const load = useCallback(async () => {
    if (!user || profileLoading) return;
    setLoading(true);
    if (role === 'teacher') {
      const data = await getTeacherEventAttendance(user.id);
      setEvents(data);
      setRecords([]);
      setSummary(null);
    } else {
      const [history, stats] = await Promise.all([
        getAttendanceHistory(user.id),
        getStudentAttendanceSummary(user.id),
      ]);
      setRecords(history);
      setEvents([]);
      setSummary(stats);
    }
    setLoading(false);
  }, [user, role, profileLoading]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const studentOptions: FilterOption<StudentFilter>[] = useMemo(
    () => [
      { value: 'all', label: 'All', count: records.length },
      {
        value: 'present',
        label: 'Present',
        count: records.filter((r) => r.status === 'present').length,
      },
      {
        value: 'late',
        label: 'Late',
        count: records.filter((r) => r.status === 'late').length,
      },
      {
        value: 'absent',
        label: 'Absent',
        count: records.filter((r) => r.status === 'absent').length,
      },
    ],
    [records]
  );

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = records.filter((r) => {
      const matchesFilter =
        studentFilter === 'all' || r.status === studentFilter;
      const matchesQuery =
        !q ||
        r.eventTitle.toLowerCase().includes(q) ||
        (r.subject ?? '').toLowerCase().includes(q) ||
        (r.teacherName ?? '').toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
    return sort === 'newest'
      ? list
      : [...list].sort(
          (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
        );
  }, [records, query, studentFilter, sort]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = events.filter((e) => {
      const phase = getEventPhase({
        start_time: e.startTime,
        end_time: e.endTime,
      });
      const matchesFilter =
        teacherFilter === 'all' ||
        (teacherFilter === 'ended' && (phase === 'ended' || phase === 'closed')) ||
        phase === teacherFilter;
      const matchesQuery =
        !q ||
        e.title.toLowerCase().includes(q) ||
        e.eventCode.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
    return sort === 'newest' ? list : [...list].reverse();
  }, [events, query, teacherFilter, sort]);

  const header = (
    <ScreenHeader
      title="History"
      subtitle={
        role === 'teacher' ? 'Your attendance events' : 'Your attendance records'
      }
      right={<NotificationBell />}
    />
  );

  const controls = (
    <View style={styles.controls}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={role === 'teacher' ? 'Search events...' : 'Search records...'}
      />
      <View style={styles.controlRow}>
        <View style={styles.filterWrap}>
          {role === 'teacher' ? (
            <FilterTabs<TeacherFilter>
              options={[
                { value: 'all', label: 'All', count: events.length },
                {
                  value: 'upcoming',
                  label: 'Upcoming',
                  count: events.filter(
                    (e) =>
                      getEventPhase({
                        start_time: e.startTime,
                        end_time: e.endTime,
                      }) === 'upcoming'
                  ).length,
                },
                {
                  value: 'live',
                  label: 'Live',
                  count: events.filter(
                    (e) =>
                      getEventPhase({
                        start_time: e.startTime,
                        end_time: e.endTime,
                      }) === 'live'
                  ).length,
                },
                {
                  value: 'ended',
                  label: 'Ended',
                  count: events.filter((e) => {
                    const phase = getEventPhase({
                      start_time: e.startTime,
                      end_time: e.endTime,
                    });
                    return phase === 'ended' || phase === 'closed';
                  }).length,
                },
              ]}
              value={teacherFilter}
              onChange={setTeacherFilter}
            />
          ) : (
            <FilterTabs<StudentFilter>
              options={studentOptions}
              value={studentFilter}
              onChange={setStudentFilter}
            />
          )}
        </View>
        <Pressable
          style={styles.sortButton}
          onPress={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
        >
          <Ionicons
            name={sort === 'newest' ? 'arrow-down' : 'arrow-up'}
            size={14}
            color={COLORS.textSecondary}
          />
          <Text style={styles.sortText}>
            {sort === 'newest' ? 'Newest' : 'Oldest'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading records...</Text>
        </View>
      </View>
    );
  }

  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        {header}
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.eventId}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.statRow}>
                <StatCard
                  label="Events"
                  value={events.length}
                  icon="clipboard-outline"
                />
                <StatCard
                  label="Total scans"
                  value={events.reduce((sum, e) => sum + e.attendeeCount, 0)}
                  icon="scan-outline"
                  tone="info"
                />
                <StatCard
                  label="With attendees"
                  value={events.filter((e) => e.attendeeCount > 0).length}
                  icon="people-outline"
                  tone="warning"
                />
              </View>
              {controls}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-outline"
              title="No events found"
              message="Create an event in the Events tab, or adjust your filters."
            >
              <Pressable style={styles.emptyAction} onPress={() => router.push('/(tabs)/teacher')}>
                <Text style={styles.emptyActionText}>Create Event</Text>
              </Pressable>
            </EmptyState>
          }
          renderItem={({ item }) => (
            <EventCard
              event={{
                title: item.title,
                start_time: item.startTime,
                end_time: item.endTime,
              }}
              onPress={() => router.push(`/event/${item.eventId}`)}
              right={
                <View style={styles.attendeeRow}>
                  <Ionicons name="people-outline" size={15} color={COLORS.success} />
                  <Text style={styles.attendeeText}>
                    {item.attendeeCount} student
                    {item.attendeeCount === 1 ? '' : 's'} attended
                  </Text>
                </View>
              }
            />
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {header}
      <FlatList
        data={filteredRecords}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.statRow}>
              <StatCard
                label="Attendance rate"
                value={
                  summary && summary.endedEvents > 0
                    ? `${Math.round(
                        (summary.attendedEnded / summary.endedEvents) * 100
                      )}%`
                    : '—'
                }
                icon="trending-up-outline"
              />
              <StatCard
                label="Present"
                value={summary?.present ?? 0}
                icon="checkmark-circle-outline"
                tone="info"
              />
              <StatCard
                label="Late"
                value={summary?.late ?? 0}
                icon="time-outline"
                tone="warning"
              />
            </View>
            <View style={styles.statRow}>
              <StatCard
                label="Absent"
                value={summary?.absent ?? 0}
                icon="close-circle-outline"
                tone="danger"
              />
              <StatCard
                label="Scans"
                value={summary?.totalRecords ?? 0}
                icon="scan-outline"
                tone="neutral"
              />
              <View style={styles.spacer} />
            </View>
            {controls}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="file-tray-outline"
            title="No attendance records yet"
            message="Your attendance records will appear here after you scan an event QR code."
          >
            <Pressable style={styles.emptyAction} onPress={() => router.push('/scan')}>
              <Text style={styles.emptyActionText}>Scan QR Code</Text>
            </Pressable>
          </EmptyState>
        }
        renderItem={({ item }) => <AttendanceRecordCard record={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  listContent: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 120,
    gap: SPACING.md,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  spacer: {
    flex: 1,
  },
  controls: {
    gap: SPACING.md,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  filterWrap: {
    flex: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attendeeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.success,
  },
  emptyAction: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  emptyActionText: {
    color: '#04140D',
    fontWeight: '800',
    fontSize: 14,
  },
});
