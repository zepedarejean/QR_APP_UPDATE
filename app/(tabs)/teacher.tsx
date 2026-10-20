import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '@/components/AppButton';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import { useToast } from '@/components/ui/Toast';
import { getEventsByTeacher, type CloudEvent } from '@/lib/events';
import { getTeacherDashboard, type TeacherDashboard } from '@/lib/dashboard';
import { getEventPhase } from '@/lib/format';
import ScreenHeader from '@/components/ui/ScreenHeader';
import NotificationBell from '@/components/notifications/NotificationBell';
import StatCard from '@/components/ui/StatCard';
import StatInfoModal, {
  type StatInfoData,
} from '@/components/ui/StatInfoModal';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EventCard from '@/components/dashboard/EventCard';
import CreateEventModal from '@/components/events/CreateEventModal';

type Filter = 'upcoming' | 'past';

export default function TeacherScreen() {
  const COLORS = useColors();
  const styles = useStyles();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const router = useRouter();
  const toast = useToast();

  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [statInfo, setStatInfo] = useState<StatInfoData | null>(null);

  const role = profile?.role ?? null;
  const loading = profileLoading || (!!role && role === 'teacher' && !dashboard);

  const load = useCallback(async () => {
    if (!user || role !== 'teacher') return;
    const [stats, list] = await Promise.all([
      getTeacherDashboard(user.id),
      getEventsByTeacher(user.id),
    ]);
    setDashboard(stats);
    setEvents(list);
  }, [user, role]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (profileLoading || role === null) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Events" subtitle="Checking your account..." />
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.muted}>Checking your account...</Text>
        </View>
      </View>
    );
  }

  if (role !== 'teacher' && role !== 'admin') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Events" />
        <View style={styles.lockBox}>
          <Ionicons name="lock-closed-outline" size={44} color={COLORS.muted} />
          <Text style={styles.lockTitle}>Teachers only</Text>
          <Text style={styles.muted}>
            Only teacher and admin accounts can create and manage attendance
            events.
          </Text>
        </View>
      </View>
    );
  }

  if (loading || !dashboard) {
    return (
      <View style={styles.container}>
        <ScreenHeader
          title="Events"
          subtitle="Manage attendance events"
          right={<NotificationBell />}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </ScrollView>
      </View>
    );
  }

  const upcoming = events.filter((e) => {
    const phase = getEventPhase(e);
    return (
      (phase === 'upcoming' || phase === 'live') && e.status === 'active'
    );
  });
  const past = events.filter((e) => {
    const phase = getEventPhase(e);
    return phase === 'ended' || phase === 'closed' || e.status === 'closed';
  });

  const visible = filter === 'past' ? past : upcoming;

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Upcoming & live', count: upcoming.length },
    { key: 'past', label: 'Past', count: past.length },
  ];

  const stats: StatInfoData[] = [
    {
      label: 'Total events',
      value: dashboard.totalEvents,
      icon: 'albums-outline',
      tone: 'info',
      description:
        'Every attendance event you have created — upcoming, live, and finished ones.',
      details: [
        'Counts all events regardless of status.',
        'Open the Events tab below to manage them.',
      ],
    },
    {
      label: 'Active',
      value: dashboard.liveEvents,
      icon: 'radio-outline',
      tone: 'success',
      description:
        'Events that are live right now and accepting student QR attendance scans.',
      details: [
        'Live means the event has started and is not yet closed.',
        'Students can scan the event QR code while it is active.',
      ],
    },
    {
      label: 'Attendance scans',
      value: dashboard.totalScans,
      icon: 'scan-outline',
      tone: 'warning',
      description:
        'The total number of QR scans recorded across all of your events.',
      details: [
        'Includes present, late, and absent records.',
        'Each student scan of your event QR code counts once.',
      ],
    },
    {
      label: 'Events with attendees',
      value: dashboard.eventsWithAttendance,
      icon: 'people-outline',
      tone: 'danger',
      description:
        'How many of your events already have at least one student attendance record.',
      details: [
        'Events with zero attendees are not counted.',
        'Tap an event below to see its full attendee list.',
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Events"
        subtitle="Create and manage attendance events"
        right={<NotificationBell />}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.statGridItem}>
              <StatCard
                label={stat.label}
                value={stat.value}
                icon={stat.icon}
                tone={stat.tone}
                onPress={() => setStatInfo(stat)}
              />
            </View>
          ))}
        </View>

        <View style={styles.createBox}>
          <View style={styles.createText}>
            <Text style={styles.createTitle}>New attendance event</Text>
            <Text style={styles.createSubtitle}>
              Create an event to generate a scannable attendance QR code. New
              events go live immediately.
            </Text>
          </View>
          <AppButton
            variant="primary"
            title="Create Event"
            icon="add-circle-outline"
            onPress={() => setFormOpen(true)}
          />
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f.label}
                  {f.count > 0 ? ` (${f.count})` : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={filter === 'past' ? 'No past events' : 'No upcoming events'}
            message={
              filter === 'past'
                ? 'Events that have ended or been closed will appear here.'
                : 'Tap Create Event to schedule your first attendance session.'
            }
          />
        ) : (
          <View style={styles.list}>
            {visible.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/event/${event.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <StatInfoModal stat={statInfo} onClose={() => setStatInfo(null)} />
      <CreateEventModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={async (event) => {
          setFormOpen(false);
          toast.show('Event created — it is now live for students.', 'success');
          setFilter('upcoming');
          await load();
          if (event) router.push(`/event/${event.id}`);
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
    content: {
      paddingHorizontal: SPACING.xxl,
      paddingBottom: 120,
      gap: SPACING.md,
      maxWidth: 900,
      width: '100%',
      alignSelf: 'center',
    },
    loadingBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    lockBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xxl,
      gap: 10,
    },
    lockTitle: {
      fontSize: 19,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    muted: {
      fontSize: 14,
      color: COLORS.textSecondary,
      textAlign: 'center',
      maxWidth: 320,
      lineHeight: 20,
    },
    statGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.md,
    },
    statGridItem: {
      flexDirection: 'row',
      flexGrow: 1,
      flexBasis: '46%',
      minWidth: 140,
    },
    createBox: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: COLORS.cardBorderNeon,
      padding: SPACING.xl,
      gap: SPACING.lg,
      marginTop: SPACING.sm,
    },
    createText: {
      gap: 4,
    },
    createTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    createSubtitle: {
      fontSize: 13,
      color: COLORS.textSecondary,
      lineHeight: 18,
    },
    filterRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      flexWrap: 'wrap',
      marginTop: SPACING.sm,
    },
    filterChip: {
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    filterChipActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    filterText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    filterTextActive: {
      color: COLORS.textOnPrimary,
    },
    list: {
      gap: SPACING.md,
    },
  })
);
