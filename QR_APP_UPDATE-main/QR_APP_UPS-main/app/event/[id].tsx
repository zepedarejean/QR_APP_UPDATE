import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import {
  deleteEvent,
  getEventById,
  updateEventStatus,
  type CloudEvent,
} from '@/lib/events';
import { buildQRPayload } from '@/lib/qr';
import {
  getEventAttendanceRecords,
  type EventAttendanceRow,
} from '@/lib/attendance';
import {
  formatClock,
  formatDate,
  formatTime,
  getEventPhase,
  type AttendanceStatus,
} from '@/lib/format';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Badge from '@/components/ui/Badge';
import SearchBar from '@/components/ui/SearchBar';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';

type Segment = 'qr' | 'records';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [event, setEvent] = useState<CloudEvent | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [segment, setSegment] = useState<Segment>('qr');
  const [payload, setPayload] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [records, setRecords] = useState<EventAttendanceRow[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const isOwner = !!user && event?.created_by === user.id;

  const load = useCallback(async () => {
    if (!id) return;
    const found = await getEventById(id);
    if (!found) {
      setNotFound(true);
      return;
    }
    setEvent(found);
    setPayload(
      buildQRPayload({
        eventId: found.event_code,
        title: found.title,
        start: found.start_time ?? undefined,
        end: found.end_time ?? undefined,
      })
    );
  }, [id]);

  const loadRecords = useCallback(async () => {
    if (!id) return;
    setRecordsLoading(true);
    const rows = await getEventAttendanceRecords(id);
    setRecords(rows);
    setRecordsLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (segment === 'records') loadRecords();
  }, [segment, loadRecords]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClose = () => {
    if (!event) return;
    const closing = event.status !== 'closed';
    Alert.alert(
      closing ? 'Close event?' : 'Reopen event?',
      closing
        ? 'Students will no longer be able to scan this event.'
        : 'Students will be able to scan this event again within its time window.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: closing ? 'Close Event' : 'Reopen',
          style: closing ? 'destructive' : 'default',
          onPress: async () => {
            setBusy(true);
            const { error } = await updateEventStatus(
              event.id,
              closing ? 'closed' : 'active'
            );
            setBusy(false);
            if (error) {
              toast.show('Unable to update the event.', 'error');
            } else {
              toast.show(closing ? 'Event closed.' : 'Event reopened.', 'success');
              load();
            }
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    if (!event) return;
    Alert.alert(
      'Delete event?',
      'This permanently removes the event and all of its attendance records.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const { error } = await deleteEvent(event.id);
            setBusy(false);
            if (error) {
              toast.show('Unable to delete the event.', 'error');
            } else {
              toast.show('Event deleted.', 'success');
              router.back();
            }
          },
        },
      ]
    );
  };

  const countdown = useMemo(() => {
    if (!event) return null;
    const target = event.end_time ?? event.start_time;
    if (!target) return null;
    const diff = new Date(target).getTime() - now;
    if (event.status === 'closed') return { label: 'Closed', value: '—' };
    if (diff <= 0) return { label: 'Time remaining', value: '00:00' };
    if (event.start_time && new Date(event.start_time).getTime() > now) {
      return { label: 'Starts in', value: formatClock(diff / 1000) };
    }
    return { label: 'Time remaining', value: formatClock(diff / 1000) };
  }, [event, now]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = records.filter(
      (r) =>
        !q ||
        (r.studentName ?? '').toLowerCase().includes(q) ||
        (r.studentCode ?? '').toLowerCase().includes(q)
    );
    return [...list].sort(
      (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
    );
  }, [records, query]);

  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;

  if (notFound) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Event" showBack />
        <EmptyState
          icon="alert-circle-outline"
          title="Event not found"
          message="This event may have been deleted."
        />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Event" showBack />
        <ScrollView contentContainerStyle={styles.content}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </ScrollView>
      </View>
    );
  }

  const phase = getEventPhase(event);
  const statusBadge =
    phase === 'live'
      ? { label: 'Live now', tone: 'success' as const }
      : phase === 'upcoming'
        ? { label: 'Upcoming', tone: 'info' as const }
        : phase === 'closed'
          ? { label: 'Closed', tone: 'danger' as const }
          : { label: 'Ended', tone: 'neutral' as const };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={event.title}
        subtitle={event.subject ?? event.event_code}
        showBack
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <View style={styles.titles}>
              <Text style={styles.infoTitle}>{event.title}</Text>
              {event.subject ? (
                <Text style={styles.infoSubject}>{event.subject}</Text>
              ) : null}
            </View>
            <Badge label={statusBadge.label} tone={statusBadge.tone} />
          </View>

          <View style={styles.infoGrid}>
            <InfoItem icon="calendar-outline" label="Date" value={formatDate(event.start_time ?? event.end_time)} />
            <InfoItem
              icon="time-outline"
              label="Time"
              value={
                event.start_time || event.end_time
                  ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
                  : '—'
              }
            />
            <InfoItem
              icon="location-outline"
              label="Room"
              value={event.room || '—'}
            />
            <InfoItem icon="barcode-outline" label="Event code" value={event.event_code} />
          </View>

          {event.description ? (
            <Text style={styles.description}>{event.description}</Text>
          ) : null}
        </View>

        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segment, segment === 'qr' && styles.segmentActive]}
            onPress={() => setSegment('qr')}
          >
            <Ionicons
              name="qr-code-outline"
              size={16}
              color={segment === 'qr' ? '#04140D' : COLORS.textSecondary}
            />
            <Text style={[styles.segmentText, segment === 'qr' && styles.segmentTextActive]}>
              QR Code
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, segment === 'records' && styles.segmentActive]}
            onPress={() => setSegment('records')}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={segment === 'records' ? '#04140D' : COLORS.textSecondary}
            />
            <Text
              style={[styles.segmentText, segment === 'records' && styles.segmentTextActive]}
            >
              Attendance ({records.length})
            </Text>
          </Pressable>
        </View>

        {segment === 'qr' ? (
          isOwner ? (
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>{event.title.toUpperCase()}</Text>
              <Text style={styles.qrMeta}>
                {formatDate(event.start_time ?? event.end_time)} ·{' '}
                {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </Text>
              {event.room ? <Text style={styles.qrMeta}>{event.room}</Text> : null}

              <View style={styles.qrWhite}>
                {payload ? (
                  <QRCode value={payload} size={220} />
                ) : (
                  <ActivityIndicator color={COLORS.primary} />
                )}
              </View>

              {countdown ? (
                <View style={styles.countdownBox}>
                  <Text style={styles.countdownLabel}>{countdown.label}</Text>
                  <Text style={styles.countdownValue}>{countdown.value}</Text>
                </View>
              ) : null}

              <View style={styles.attendancePill}>
                <Ionicons name="people-outline" size={16} color={COLORS.success} />
                <Text style={styles.attendancePillText}>
                  {records.length} student{records.length === 1 ? '' : 's'} attended
                </Text>
              </View>

              <Text style={styles.qrHint}>
                Students can scan this code with their own account during the
                event window.
              </Text>

              <View style={styles.qrActions}>
                <AppButton
                  variant="secondary"
                  title="Refresh QR"
                  icon="refresh-outline"
                  onPress={() => {
                    setPayload(
                      buildQRPayload({
                        eventId: event.event_code,
                        title: event.title,
                        start: event.start_time ?? undefined,
                        end: event.end_time ?? undefined,
                      })
                    );
                    toast.show('QR code refreshed.', 'info');
                  }}
                />
                <AppButton
                  variant="primary"
                  title={event.status === 'closed' ? 'Reopen Event' : 'Close Event'}
                  icon={event.status === 'closed' ? 'lock-open-outline' : 'lock-closed-outline'}
                  onPress={handleClose}
                  loading={busy}
                />
                <AppButton
                  variant="ghost"
                  title="View Attendance"
                  icon="people-outline"
                  onPress={() => setSegment('records')}
                />
                <AppButton
                  variant="danger"
                  title="Delete Event"
                  icon="trash-outline"
                  onPress={handleDelete}
                  disabled={busy}
                />
              </View>
            </View>
          ) : (
            <View style={styles.qrCard}>
              <EmptyState
                icon="lock-closed-outline"
                title="QR code is visible to the event creator"
                message="Only the teacher who created this event can display its attendance QR code."
              />
            </View>
          )
        ) : (
          <View style={styles.recordsCard}>
            <View style={styles.recordsStats}>
              <View style={styles.recordsStat}>
                <Text style={styles.recordsStatValue}>{records.length}</Text>
                <Text style={styles.recordsStatLabel}>Total</Text>
              </View>
              <View style={styles.recordsStat}>
                <Text style={[styles.recordsStatValue, { color: COLORS.success }]}>
                  {presentCount}
                </Text>
                <Text style={styles.recordsStatLabel}>Present</Text>
              </View>
              <View style={styles.recordsStat}>
                <Text style={[styles.recordsStatValue, { color: COLORS.warning }]}>
                  {lateCount}
                </Text>
                <Text style={styles.recordsStatLabel}>Late</Text>
              </View>
              <Pressable style={styles.refreshBtn} onPress={loadRecords} hitSlop={8}>
                <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search students..."
            />

            {recordsLoading ? (
              <ActivityIndicator
                color={COLORS.primary}
                style={{ marginTop: SPACING.xl }}
              />
            ) : filteredRecords.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title={records.length === 0 ? 'No attendance yet' : 'No matches'}
                message={
                  records.length === 0
                    ? 'Student scans will appear here in real time.'
                    : 'Try a different search.'
                }
              />
            ) : (
              <View style={styles.recordList}>
                {filteredRecords.map((row, index) => (
                  <View key={row.id} style={styles.recordRow}>
                    <View style={styles.recordIndex}>
                      <Text style={styles.recordIndexText}>{index + 1}</Text>
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={styles.recordName} numberOfLines={1}>
                        {row.studentName ?? 'Unnamed student'}
                      </Text>
                      <Text style={styles.recordCode} numberOfLines={1}>
                        {row.studentCode ?? row.studentId.slice(0, 8)}
                      </Text>
                    </View>
                    <View style={styles.recordRight}>
                      <Text style={styles.recordTime}>{formatTime(row.scannedAt)}</Text>
                      <Badge
                        label={row.status === 'late' ? 'Late' : 'Present'}
                        tone={row.status === 'late' ? 'warning' : 'success'}
                        small
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoItem}>
      <Ionicons name={icon} size={15} color={COLORS.textSecondary} />
      <View style={styles.infoItemText}>
        <Text style={styles.infoItemLabel}>{label}</Text>
        <Text style={styles.infoItemValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
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
    gap: SPACING.lg,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  infoTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  infoSubject: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  infoGrid: {
    gap: SPACING.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoItemText: {
    flex: 1,
  },
  infoItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  infoItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.md,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: 11,
  },
  segmentActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: '#04140D',
  },
  qrCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorderNeon,
    padding: SPACING.xl,
    gap: SPACING.md,
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  qrMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  qrWhite: {
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginVertical: SPACING.sm,
  },
  countdownBox: {
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 26,
    gap: 2,
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  countdownValue: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.success,
    fontVariant: ['tabular-nums'],
  },
  attendancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: COLORS.successSoft,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.cardBorderNeon,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  attendancePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.success,
  },
  qrHint: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 17,
  },
  qrActions: {
    width: '100%',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  recordsCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  recordsStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  },
  recordsStat: {
    alignItems: 'center',
    gap: 1,
    minWidth: 56,
  },
  recordsStatValue: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  recordsStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  refreshBtn: {
    marginLeft: 'auto',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordList: {
    gap: SPACING.sm,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  recordIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordIndexText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.muted,
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  recordCode: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  recordRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  recordTime: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
