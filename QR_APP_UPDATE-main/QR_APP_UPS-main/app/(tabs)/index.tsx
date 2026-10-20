import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import {
  getStudentDashboard,
  getTeacherDashboard,
  type StudentDashboard,
  type TeacherDashboard,
} from '@/lib/dashboard';
import { ensureReminders } from '@/lib/notifications';
import { greeting, formatDate } from '@/lib/format';
import Avatar from '@/components/ui/Avatar';
import StatCard from '@/components/ui/StatCard';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import QuickActionCard from '@/components/dashboard/QuickActionCard';
import EventCard from '@/components/dashboard/EventCard';
import AttendanceRecordCard from '@/components/attendance/AttendanceRecordCard';
import NotificationBell from '@/components/notifications/NotificationBell';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const [student, setStudent] = useState<StudentDashboard | null>(null);
  const [teacher, setTeacher] = useState<TeacherDashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const role = profile?.role ?? null;
  const loading = profileLoading || (!!role && !student && !teacher);

  const load = useCallback(
    async (silent = false) => {
      if (!user || !role) return;
      if (!silent) setRefreshing(true);
      ensureReminders(user.id);
      if (role === 'teacher') {
        const data = await getTeacherDashboard(user.id);
        setTeacher(data);
        setStudent(null);
      } else {
        const data = await getStudentDashboard(user.id);
        setStudent(data);
        setTeacher(null);
      }
      setRefreshing(false);
    },
    [user, role]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const firstName = (profile?.full_name ?? user?.email ?? '').split(' ')[0];

  const header = (
    <View style={styles.header}>
      <Avatar
        name={profile?.full_name ?? user?.email}
        uri={profile?.avatar_url}
        size={46}
      />
      <View style={styles.headerText}>
        <Text style={styles.greeting}>
          {greeting()}
          {firstName ? `, ${firstName}!` : ''}
        </Text>
        <Text style={styles.date}>{formatDate(new Date().toISOString())}</Text>
      </View>
      <NotificationBell />
    </View>
  );

  const subtitle = (
    <Text style={styles.pageSubtitle}>
      {role === 'teacher'
        ? 'Here is an overview of your attendance events.'
        : "Here's your attendance overview."}
    </Text>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          {subtitle}
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </ScrollView>
      </View>
    );
  }

  if (role === 'teacher' && teacher) {
    const rate =
      teacher.totalEvents > 0
        ? Math.round((teacher.finishedEvents / teacher.totalEvents) * 100)
        : null;
    return (
      <View style={styles.container}>
        {header}
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={COLORS.primary}
            />
          }
        >
          {subtitle}

          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.heroLabel}>Teacher overview</Text>
                <Text style={styles.heroValue}>{teacher.totalEvents}</Text>
                <Text style={styles.heroCaption}>Total events created</Text>
              </View>
              <View style={styles.heroIcon}>
                <Ionicons name="clipboard-outline" size={26} color={COLORS.success} />
              </View>
            </View>
            <View style={styles.heroProgressTrack}>
              <View
                style={[
                  styles.heroProgressFill,
                  { width: `${Math.min(100, rate ?? 0)}%` },
                ]}
              />
            </View>
            <Text style={styles.heroHint}>
              {rate !== null
                ? `${teacher.finishedEvents} of ${teacher.totalEvents} events completed`
                : 'Create your first event to get started'}
            </Text>
          </View>

          <View style={styles.statRow}>
            <StatCard
              label="Live events"
              value={teacher.liveEvents}
              icon="radio-outline"
              tone="primary"
            />
            <StatCard
              label="Completed"
              value={teacher.finishedEvents}
              icon="checkmark-done-outline"
              tone="info"
            />
            <StatCard
              label="Attendance scans"
              value={teacher.totalScans}
              icon="scan-outline"
              tone="warning"
            />
          </View>

          <SectionHeader title="Quick actions" />
          <View style={styles.actionRow}>
            <QuickActionCard
              label="Create Event"
              caption="New QR session"
              icon="add-circle-outline"
              tone="primary"
              onPress={() => router.push('/(tabs)/teacher')}
            />
            <QuickActionCard
              label="Manage Events"
              caption="Open & close"
              icon="clipboard-outline"
              tone="info"
              onPress={() => router.push('/(tabs)/teacher')}
            />
            <QuickActionCard
              label="Records"
              caption="Attendance lists"
              icon="people-outline"
              tone="warning"
              onPress={() => router.push('/history')}
            />
          </View>

          <SectionHeader
            title="Upcoming events"
            actionLabel="Manage"
            onAction={() => router.push('/(tabs)/teacher')}
          />
          {teacher.upcoming.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No upcoming events"
              message="Events you create will show up here."
            />
          ) : (
            <View style={styles.list}>
              {teacher.upcoming.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() => router.push(`/event/${event.id}`)}
                />
              ))}
            </View>
          )}

          <SectionHeader
            title="Recent events"
            actionLabel="View all"
            onAction={() => router.push('/history')}
          />
          {teacher.recent.length === 0 ? (
            <EmptyState
              icon="file-tray-outline"
              title="No events yet"
              message="Create an attendance event to generate a QR code."
            />
          ) : (
            <View style={styles.list}>
              {teacher.recent.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onPress={() => router.push(`/event/${event.id}`)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  const summary = student?.summary;
  const ended = summary?.endedEvents ?? 0;
  const attended = summary?.attendedEnded ?? 0;
  const rate = ended > 0 ? Math.round((attended / ended) * 100) : null;

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={COLORS.primary}
          />
        }
      >
        {subtitle}

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>Attendance rate</Text>
              <Text style={styles.heroValue}>
                {rate !== null ? `${rate}%` : '—'}
              </Text>
              <Text style={styles.heroCaption}>
                {ended > 0
                  ? `${attended} of ${ended} past events attended`
                  : 'No past events yet'}
              </Text>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="trending-up-outline" size={26} color={COLORS.success} />
            </View>
          </View>
          <View style={styles.heroProgressTrack}>
            <View
              style={[
                styles.heroProgressFill,
                { width: `${Math.min(100, rate ?? 0)}%` },
              ]}
            />
          </View>
        </View>

        <View style={styles.statRow}>
          <StatCard
            label="Present"
            value={summary?.present ?? 0}
            icon="checkmark-circle-outline"
            tone="primary"
          />
          <StatCard
            label="Late"
            value={summary?.late ?? 0}
            icon="time-outline"
            tone="warning"
          />
          <StatCard
            label="Absent"
            value={summary?.absent ?? 0}
            icon="close-circle-outline"
            tone="danger"
          />
        </View>

        <SectionHeader title="Quick actions" />
        <View style={styles.actionRow}>
          <QuickActionCard
            label="Scan QR"
            caption="Record attendance"
            icon="qr-code-outline"
            tone="primary"
            onPress={() => router.push('/scan')}
          />
          <QuickActionCard
            label="History"
            caption="Your records"
            icon="time-outline"
            tone="info"
            onPress={() => router.push('/history')}
          />
          <QuickActionCard
            label="Profile"
            caption="Your account"
            icon="person-outline"
            tone="neutral"
            onPress={() => router.push('/profile')}
          />
        </View>

        <SectionHeader title="Upcoming events" />
        {student && student.upcoming.length > 0 ? (
          <View style={styles.list}>
            {student.upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="calendar-outline"
            title="No upcoming events"
            message="Events created by your teachers will appear here."
          />
        )}

        <SectionHeader
          title="Recent attendance"
          actionLabel="View all"
          onAction={() => router.push('/history')}
        />
        {student && student.recent.length > 0 ? (
          <View style={styles.list}>
            {student.recent.map((record) => (
              <AttendanceRecordCard key={record.id} record={record} />
            ))}
          </View>
        ) : (
          <EmptyState
            icon="scan-outline"
            title="No attendance yet"
            message="Your attendance records will appear here after you scan an event QR code."
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  headerText: {
    flex: 1,
  },
  greeting: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  content: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 120,
    maxWidth: 900,
    width: '100%',
    alignSelf: 'center',
  },
  pageSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorderNeon,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: 44,
    fontWeight: '900',
    color: COLORS.textPrimary,
    letterSpacing: -1.5,
    marginTop: 2,
  },
  heroCaption: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: COLORS.cardBorderNeon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.inputBackground,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  heroHint: {
    fontSize: 12,
    color: COLORS.muted,
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    flexWrap: 'wrap',
  },
  list: {
    gap: SPACING.md,
  },
});
