import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import { useToast } from '@/components/ui/Toast';
import { createEvent, getEventsByTeacher, type CloudEvent } from '@/lib/events';
import { getTeacherDashboard, type TeacherDashboard } from '@/lib/dashboard';
import { formatDateShort, formatTime, getEventPhase } from '@/lib/format';
import ScreenHeader from '@/components/ui/ScreenHeader';
import NotificationBell from '@/components/notifications/NotificationBell';
import StatCard from '@/components/ui/StatCard';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';
import EventCard from '@/components/dashboard/EventCard';

function nextHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export default function TeacherScreen() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const router = useRouter();
  const toast = useToast();

  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [formOpen, setFormOpen] = useState(false);

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

  if (role !== 'teacher') {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Events" />
        <View style={styles.lockBox}>
          <Ionicons name="lock-closed-outline" size={44} color={COLORS.muted} />
          <Text style={styles.lockTitle}>Teachers only</Text>
          <Text style={styles.muted}>
            Only teacher accounts can create and manage attendance events.
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

  const upcoming = events
    .filter((e) => getEventPhase(e) === 'upcoming' || getEventPhase(e) === 'live')
    .slice(0, 4);
  const past = events.filter((e) => {
    const phase = getEventPhase(e);
    return phase === 'ended' || phase === 'closed';
  });

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Events"
        subtitle="Create and manage attendance events"
        right={<NotificationBell />}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statRow}>
          <StatCard label="Total events" value={dashboard.totalEvents} icon="albums-outline" />
          <StatCard
            label="Active"
            value={dashboard.liveEvents}
            icon="radio-outline"
            tone="info"
          />
          <StatCard
            label="Completed"
            value={dashboard.finishedEvents}
            icon="checkmark-done-outline"
            tone="warning"
          />
        </View>
        <View style={styles.statRow}>
          <StatCard
            label="Attendance scans"
            value={dashboard.totalScans}
            icon="scan-outline"
            tone="primary"
          />
          <StatCard
            label="Events with attendees"
            value={dashboard.eventsWithAttendance}
            icon="people-outline"
            tone="neutral"
          />
          <View style={styles.spacer} />
        </View>

        <View style={styles.createBox}>
          <View style={styles.createText}>
            <Text style={styles.createTitle}>New attendance event</Text>
            <Text style={styles.createSubtitle}>
              Create an event to generate a scannable attendance QR code.
            </Text>
          </View>
          <AppButton
            variant="primary"
            title="Create Event"
            icon="add-circle-outline"
            onPress={() => setFormOpen(true)}
          />
        </View>

        <SectionHeader title="Upcoming & live" />
        {upcoming.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title="No upcoming events"
            message="Tap Create Event to schedule your first attendance session."
          />
        ) : (
          <View style={styles.list}>
            {upcoming.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/event/${event.id}`)}
              />
            ))}
          </View>
        )}

        <SectionHeader title="Past events" />
        {past.length === 0 ? (
          <EmptyState
            icon="time-outline"
            title="No past events"
            message="Events that have ended or been closed will appear here."
          />
        ) : (
          <View style={styles.list}>
            {past.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onPress={() => router.push(`/event/${event.id}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <CreateEventModal
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={async (event) => {
          setFormOpen(false);
          toast.show('Event created successfully.', 'success');
          await load();
          if (event) router.push(`/event/${event.id}`);
        }}
      />
    </View>
  );
}

type CreateEventModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreated: (event: CloudEvent | null) => void;
};

function CreateEventModal({ visible, onClose, onCreated }: CreateEventModalProps) {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [room, setRoom] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState(nextHour);
  const [end, setEnd] = useState(() => new Date(nextHour().getTime() + 3600000));
  const [picker, setPicker] = useState<{
    target: 'start' | 'end';
    part: 'date' | 'time';
  } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setSubject('');
    setRoom('');
    setDescription('');
    const next = nextHour();
    setStart(next);
    setEnd(new Date(next.getTime() + 3600000));
    setFieldError(null);
  };

  const applyQuickDuration = (minutes: number) => {
    setEnd(new Date(start.getTime() + minutes * 60000));
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      setPicker(null);
      return;
    }
    if (selected && picker) {
      const current = picker.target === 'start' ? start : end;
      const next = new Date(current);
      if (picker.part === 'date') {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      if (picker.target === 'start') {
        setStart(next);
        if (next >= end) setEnd(new Date(next.getTime() + 3600000));
      } else {
        setEnd(next);
      }
    }
    if (Platform.OS === 'android' && picker?.part === 'date') {
      setPicker({ target: picker.target, part: 'time' });
    } else {
      setPicker(null);
    }
  };

  const handleCreate = async () => {
    setFieldError(null);
    if (!title.trim()) {
      setFieldError('Event name is required.');
      return;
    }
    if (start >= end) {
      setFieldError('End time must be after the start time.');
      return;
    }
    setSaving(true);
    const { error, event } = await createEvent({
      title,
      subject,
      room,
      description,
      start: start.toISOString(),
      end: end.toISOString(),
    });
    setSaving(false);
    if (error) {
      setFieldError('Could not save the event. Please try again.');
      return;
    }
    reset();
    onCreated(event);
  };

  const pickerValue = useMemo(() => {
    if (!picker) return start;
    const base = picker.target === 'start' ? start : end;
    if (picker.part === 'date') return base;
    return base;
  }, [picker, start, end]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Attendance Event</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.form}>
              <Field label="Event Name *">
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Database Systems Lecture"
                  placeholderTextColor={COLORS.muted}
                />
              </Field>

              <Field label="Subject / Course">
                <TextInput
                  style={styles.input}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Database Management"
                  placeholderTextColor={COLORS.muted}
                />
              </Field>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Field label="Date">
                    <Pressable
                      style={styles.input}
                      onPress={() => setPicker({ target: 'start', part: 'date' })}
                    >
                      <Text style={styles.inputText}>{formatDateShort(start.toISOString())}</Text>
                    </Pressable>
                  </Field>
                </View>
                <View style={styles.fieldHalf}>
                  <Field label="Room / Location">
                    <TextInput
                      style={styles.input}
                      value={room}
                      onChangeText={setRoom}
                      placeholder="Laboratory 103"
                      placeholderTextColor={COLORS.muted}
                    />
                  </Field>
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Field label="Start Time">
                    <Pressable
                      style={styles.input}
                      onPress={() => setPicker({ target: 'start', part: 'time' })}
                    >
                      <Text style={styles.inputText}>{formatTime(start.toISOString())}</Text>
                    </Pressable>
                  </Field>
                </View>
                <View style={styles.fieldHalf}>
                  <Field label="End Time">
                    <Pressable
                      style={styles.input}
                      onPress={() => setPicker({ target: 'end', part: 'time' })}
                    >
                      <Text style={styles.inputText}>{formatTime(end.toISOString())}</Text>
                    </Pressable>
                  </Field>
                </View>
              </View>

              <View style={styles.chipRow}>
                <Pressable style={styles.chip} onPress={() => applyQuickDuration(30)}>
                  <Text style={styles.chipText}>+30 min</Text>
                </Pressable>
                <Pressable style={styles.chip} onPress={() => applyQuickDuration(60)}>
                  <Text style={styles.chipText}>+1 hour</Text>
                </Pressable>
                <Pressable style={styles.chip} onPress={() => applyQuickDuration(120)}>
                  <Text style={styles.chipText}>+2 hours</Text>
                </Pressable>
                <Pressable
                  style={styles.chip}
                  onPress={() => setEnd(new Date(start.getTime() + 90 * 60000))}
                >
                  <Text style={styles.chipText}>+1.5 hours</Text>
                </Pressable>
              </View>

              <Field label="Description">
                <TextInput
                  style={[styles.input, styles.textarea]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional details for students"
                  placeholderTextColor={COLORS.muted}
                  multiline
                />
              </Field>

              {fieldError ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
                  <Text style={styles.errorText}>{fieldError}</Text>
                </View>
              ) : null}

              <AppButton
                variant="primary"
                size="lg"
                title="Create & Generate QR"
                icon="qr-code-outline"
                onPress={handleCreate}
                loading={saving}
              />
            </View>
          </ScrollView>
        </View>

        {picker ? (
          <DateTimePicker
            value={pickerValue}
            mode={Platform.OS === 'android' ? picker.part : 'datetime'}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
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
  statRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  spacer: {
    flex: 1,
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
  list: {
    gap: SPACING.md,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '92%',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  field: {
    gap: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  input: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 48,
    justifyContent: 'center',
  },
  textarea: {
    minHeight: 84,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  inputText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.danger,
    padding: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '600',
  },
});
