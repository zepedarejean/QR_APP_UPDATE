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

import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import {
  getAllEventAttendance,
  getAttendanceHistory,
  getStudentAttendanceSummary,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';
import {
  ALMOST_LATE_SECONDS,
  DEFAULT_GRACE_MINUTES,
  evaluateScan,
  formatDateShort,
  formatLateBy,
  formatTime,
  getEventPhase,
  scanToneFor,
  scanToneLabel,
  type AttendanceEvaluation,
  type AttendanceStatus,
} from '@/lib/format';
import ScreenHeader from '@/components/ui/ScreenHeader';
import NotificationBell from '@/components/notifications/NotificationBell';
import SearchBar from '@/components/ui/SearchBar';
import FilterTabs, { type FilterOption } from '@/components/ui/FilterTabs';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import EventCard from '@/components/dashboard/EventCard';
import AttendanceSummaryCard from '@/components/dashboard/AttendanceSummaryCard';

type StudentFilter = 'all' | AttendanceStatus;
type TeacherFilter = 'all' | 'upcoming' | 'live' | 'ended';
type SortOrder = 'newest' | 'oldest';

export default function HistoryScreen() {
  const COLORS = useColors();
  const styles = useStyles();
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
  // Teachers and admins both look at event attendance history.
  const managesEvents = role === 'teacher' || role === 'admin';
  const eventsTab = role === 'admin' ? '/(tabs)/admin' : '/(tabs)/teacher';

  const load = useCallback(async () => {
    if (!user || profileLoading) return;
    setLoading(true);
    if (managesEvents) {
      // Admins monitor EVERY event; teachers only their own.
      const data =
        role === 'admin'
          ? await getAllEventAttendance()
          : await getTeacherEventAttendance(user.id);
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
  }, [user, role, managesEvents, profileLoading]);

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
        managesEvents
          ? role === 'admin'
            ? 'All events across the school'
            : 'Your attendance events'
          : 'Your attendance records'
      }
      right={<NotificationBell />}
    />
  );

  const controls = (
    <View style={styles.controls}>
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder={managesEvents ? 'Search events...' : 'Search records...'}
      />
      <View style={styles.controlRow}>
        <View style={styles.filterWrap}>
          {managesEvents ? (
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
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (managesEvents) {
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
              message={
                role === 'admin'
                  ? 'No events yet — events created by teachers will show up here.'
                  : 'Create an event in the Events tab, or adjust your filters.'
              }
            >
              <Pressable style={styles.emptyAction} onPress={() => router.push(eventsTab as never)}>
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
            <AttendanceSummaryCard
              rate={
                summary && summary.endedEvents > 0
                  ? Math.round(
                      (summary.attendedEnded / summary.endedEvents) * 100
                    )
                  : null
              }
              attended={summary?.attendedEnded ?? 0}
              ended={summary?.endedEvents ?? 0}
              onTime={summary?.present ?? 0}
              late={summary?.late ?? 0}
              absent={summary?.absent ?? 0}
              scans={summary?.totalRecords ?? 0}
            />
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
        renderItem={({ item }) => (
          <RecordRow
            record={item}
            onPress={() =>
              router.push(`/event/${item.eventUuid ?? item.eventId}`)
            }
          />
        )}
      />
    </View>
  );
}

/**
 * Tone for an attendance record:
 *   danger -> late (shows how late via formatLateBy)
 *   info   -> almost late (scanned within the last minute before the cutoff)
 *   success -> on time / present
 */
function recordTone(record: AttendanceRecord): {
  tone: 'success' | 'info' | 'danger';
  label: string;
} {
  if (record.status === 'absent') {
    return { tone: 'danger', label: 'Absent' };
  }
  const evaluation = record.startTime
    ? evaluateScan(
        record.scannedAt,
        record.startTime,
        record.graceMinutes ?? DEFAULT_GRACE_MINUTES
      )
    : null;

  const lateBySeconds = record.lateBySeconds ?? evaluation?.lateBySeconds ?? 0;
  const isLate =
    record.status === 'late' ||
    lateBySeconds > 0 ||
    evaluation?.status === 'late';
  const almostLate =
    !isLate &&
    (record.almostLate === true ||
      evaluation?.almostLate === true ||
      (evaluation != null && evaluation.secondsToLate <= ALMOST_LATE_SECONDS));

  const combined: AttendanceEvaluation = {
    status: isLate ? 'late' : 'present',
    lateBySeconds,
    almostLate,
    secondsToLate: evaluation?.secondsToLate ?? 0,
  };

  const tone = scanToneFor(combined);
  const label =
    isLate && lateBySeconds > 0
      ? formatLateBy(lateBySeconds)
      : scanToneLabel(combined);
  return { tone, label };
}

function RecordRow({
  record,
  onPress,
}: {
  record: AttendanceRecord;
  onPress?: () => void;
}) {
  const COLORS = useColors();
  const styles = useStyles();

  const { tone, label } = recordTone(record);
  const isAbsent = record.status === 'absent';
  const toneColor =
    tone === 'danger' ? COLORS.danger : tone === 'info' ? COLORS.info : COLORS.success;
  const toneSoft =
    tone === 'danger'
      ? COLORS.dangerSoft
      : tone === 'info'
        ? COLORS.infoSoft
        : COLORS.successSoft;
  const toneIcon = isAbsent
    ? 'close-circle'
    : tone === 'danger'
      ? 'time'
      : tone === 'info'
        ? 'flash-outline'
        : 'checkmark-circle';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.recordCard,
        pressed && styles.recordCardPressed,
      ]}
    >
      <View style={styles.recordHeader}>
        <View style={styles.recordTitles}>
          <Text style={styles.recordTitle} numberOfLines={2}>
            {record.eventTitle}
          </Text>
          {record.subject ? (
            <Text style={styles.recordSubject} numberOfLines={1}>
              {record.subject}
            </Text>
          ) : null}
        </View>
        <View
          style={[
            styles.recordChip,
            { backgroundColor: toneSoft, borderColor: toneColor },
          ]}
        >
          <Ionicons name={toneIcon} size={13} color={toneColor} />
          <Text style={[styles.recordChipText, { color: toneColor }]}>{label}</Text>
        </View>
      </View>

      {record.teacherName ? (
        <View style={styles.recordMetaRow}>
          <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.recordMeta}>Teacher: {record.teacherName}</Text>
        </View>
      ) : null}

      <View style={styles.metaChips}>
        <MetaChip icon="calendar-outline" text={formatDateShort(record.scannedAt)} />
        <MetaChip
          icon={isAbsent ? 'log-out-outline' : 'scan-outline'}
          text={
            isAbsent
              ? `Ended ${formatTime(record.endTime ?? record.scannedAt)}`
              : `Scanned ${formatTime(record.scannedAt)}`
          }
        />
        <MetaChip icon="flag-outline" text={`Starts ${formatTime(record.startTime)}`} />
        <Ionicons
          name="chevron-forward"
          size={14}
          color={COLORS.muted}
          style={{ marginLeft: 'auto' }}
        />
      </View>
    </Pressable>
  );
}

function MetaChip({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  const COLORS = useColors();
  const styles = useStyles();
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={12} color={COLORS.muted} />
      <Text style={styles.metaChipText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((COLORS) => StyleSheet.create({
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
    color: COLORS.textOnPrimary,
    fontWeight: '800',
    fontSize: 14,
  },
  recordCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 8,
    ...SHADOW.card,
  },
  recordCardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.995 }],
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  recordTitles: {
    flex: 1,
    gap: 2,
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  recordSubject: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  recordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recordChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  recordMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recordMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  metaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  metaChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
}));
