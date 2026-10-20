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
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { useToast } from '@/components/ui/Toast';
import { getAllEvents, type CloudEvent } from '@/lib/events';
import { getAdminDashboard, type AdminDashboard } from '@/lib/dashboard';
import ScreenHeader from '@/components/ui/ScreenHeader';
import NotificationBell from '@/components/notifications/NotificationBell';
import StatCard from '@/components/ui/StatCard';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EventCard from '@/components/dashboard/EventCard';
import CreateEventModal from '@/components/events/CreateEventModal';

export default function AdminScreen() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const router = useRouter();
  const toast = useToast();
  const COLORS = useColors();
  const styles = useStyles();

  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [formOpen, setFormOpen] = useState(false);

  const role = profile?.role ?? null;
  const loading = profileLoading || (!!role && role === 'admin' && !dashboard);

  const load = useCallback(async () => {
    if (!user || role !== 'admin') return;
    const [stats, all] = await Promise.all([
      getAdminDashboard(),
      getAllEvents(100),
    ]);
    setDashboard(stats);
    setEvents(all);
  }, [user, role]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (profileLoading || role === null) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <ScreenHeader title="Admin" subtitle="Checking your account..." />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.muted, { color: COLORS.textSecondary }]}>
            Checking your account...
          </Text>
        </View>
      </View>
    );
  }

  if (role !== 'admin') {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <ScreenHeader title="Admin" />
        <View style={styles.center}>
          <View style={[styles.lockCircle, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <Ionicons name="lock-closed-outline" size={40} color={COLORS.muted} />
          </View>
          <Text style={[styles.lockTitle, { color: COLORS.textPrimary }]}>Admins only</Text>
          <Text style={[styles.muted, { color: COLORS.textSecondary }]}>
            Only admin accounts can view analytics and manage the app.
          </Text>
        </View>
      </View>
    );
  }

  if (loading || !dashboard) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <ScreenHeader
          title="Admin"
          subtitle="Analytics, events and QR control"
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

  const live = events.filter((e) => e.status === 'active');
  const closed = events.filter((e) => e.status === 'closed');

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <ScreenHeader
        title="Admin"
        subtitle="Analytics, events and QR control"
        right={<NotificationBell />}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statRow}>
          <StatCard
            label="Total events"
            value={dashboard.totalEvents}
            icon="albums-outline"
            tone="neutral"
          />
          <StatCard label="Live events" value={dashboard.activeEvents} icon="radio-outline" />
          <StatCard label="Total scans" value={dashboard.totalScans} icon="scan-outline" tone="info" />
        </View>
        <View style={styles.statRow}>
          <StatCard label="Students" value={dashboard.totalStudents} icon="people-outline" tone="primary" />
          <StatCard label="Teachers" value={dashboard.totalTeachers} icon="clipboard-outline" tone="warning" />
          <StatCard label="Closed events" value={dashboard.closedEvents} icon="checkmark-done-outline" tone="neutral" />
        </View>

        <View style={[styles.createBox, { backgroundColor: COLORS.card, borderColor: COLORS.cardBorderNeon }]}>
          <View style={styles.createText}>
            <Text style={[styles.createTitle, { color: COLORS.textPrimary }]}>
              Create an event
            </Text>
            <Text style={[styles.createSubtitle, { color: COLORS.textSecondary }]}>
              Admin events go live instantly and include the QR code, the late
              window and an optional QR expiry.
            </Text>
          </View>
          <AppButton
            variant="primary"
            title="Create Event"
            icon="add-circle-outline"
            onPress={() => setFormOpen(true)}
          />
        </View>

        <SectionHeader title="Attendance by department" />
        {dashboard.departments.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="No students yet"
            message="Department analytics appear once students register with a department."
          />
        ) : (
          <View style={[styles.deptCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            {dashboard.departments.map((dept) => {
              const pct =
                dept.students > 0
                  ? Math.min(100, Math.round((dept.scans / dept.students) * 100))
                  : 0;
              return (
                <View key={dept.department} style={styles.deptRow}>
                  <View style={styles.deptTop}>
                    <Text style={[styles.deptName, { color: COLORS.textPrimary }]}>
                      {dept.department}
                    </Text>
                    <Text style={[styles.deptValue, { color: COLORS.textSecondary }]}>
                      {dept.scans} scan{dept.scans === 1 ? '' : 's'} · {dept.students}{' '}
                      student{dept.students === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <View style={[styles.track, { backgroundColor: COLORS.inputBackground }]}>
                    <View
                      style={[
                        styles.fill,
                        { width: `${pct}%`, backgroundColor: COLORS.primary },
                      ]}
                    />
                  </View>
                  <Text style={[styles.deptPct, { color: COLORS.muted }]}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}

        <SectionHeader title="All events" />
        {events.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No events yet"
            message="Events created by teachers and admins will appear here."
          />
        ) : (
          <View style={styles.list}>
            {live.map((event) => (
              <EventCard key={event.id} event={event} onPress={() => router.push(`/event/${event.id}`)} />
            ))}
            {closed.map((event) => (
              <EventCard key={event.id} event={event} onPress={() => router.push(`/event/${event.id}`)} />
            ))}
          </View>
        )}
      </ScrollView>

      <CreateEventModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={async (event) => {
          setFormOpen(false);
          toast.show('Event created and published.', 'success');
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
    },
    content: {
      paddingHorizontal: SPACING.xxl,
      paddingBottom: 120,
      gap: SPACING.md,
      maxWidth: 900,
      width: '100%',
      alignSelf: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xxl,
      gap: 10,
    },
    lockCircle: {
      width: 66,
      height: 66,
      borderRadius: 33,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    lockTitle: {
      fontSize: 19,
      fontWeight: '800',
    },
    muted: {
      fontSize: 14,
      textAlign: 'center',
      maxWidth: 320,
      lineHeight: 20,
    },
    statRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    createBox: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
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
    },
    createSubtitle: {
      fontSize: 13,
      lineHeight: 18,
    },
    list: {
      gap: SPACING.md,
    },
    deptCard: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    deptRow: {
      gap: 6,
    },
    deptTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    deptName: {
      fontSize: 14,
      fontWeight: '800',
    },
    deptValue: {
      fontSize: 12,
      fontWeight: '600',
    },
    track: {
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 4,
    },
    deptPct: {
      fontSize: 11,
      fontWeight: '700',
    },
  })
);
