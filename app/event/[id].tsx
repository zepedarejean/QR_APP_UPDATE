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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import { useToast } from '@/components/ui/Toast';
import {
  deleteEvent,
  getEventById,
  getQrState,
  updateEventStatus,
  updateQrSettings,
  type CloudEvent,
} from '@/lib/events';
import { buildQRPayload } from '@/lib/qr';
import {
  getEventAttendanceRecords,
  getEventGroupStats,
  getMyEventRecord,
  type EventAttendanceRow,
  type GroupStatRow,
  type MyEventRecord,
} from '@/lib/attendance';
import {
  formatClock,
  formatDate,
  formatLateBy,
  formatTime,
  getEventPhase,
  scanToneFor,
  scanToneLabel,
  evaluateScan,
  DEFAULT_GRACE_MINUTES,
  type AttendanceEvaluation,
} from '@/lib/format';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import SearchBar from '@/components/ui/SearchBar';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/Skeleton';

type Segment = 'qr' | 'records';

const QR_EXPIRY_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: 'No expiry', minutes: null },
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const toast = useToast();
  const COLORS = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<CloudEvent | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [segment, setSegment] = useState<Segment>('qr');
  const [payload, setPayload] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [records, setRecords] = useState<EventAttendanceRow[]>([]);
  const [groupStats, setGroupStats] = useState<GroupStatRow[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [myRecord, setMyRecord] = useState<MyEventRecord | null>(null);
  const [myRecordLoaded, setMyRecordLoaded] = useState(false);

  const role = profile?.role ?? null;
  const isOwner = !!user && event?.created_by === user.id;
  const isAdmin = role === 'admin';
  const canManage = isOwner || isAdmin;

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
    const [rows, stats] = await Promise.all([
      getEventAttendanceRecords(id),
      getEventGroupStats(id),
    ]);
    setRecords(rows);
    setGroupStats(stats);
    setRecordsLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // The signed-in student's own attendance row for this event.
  useEffect(() => {
    if (!event || !user || role !== 'student') return;
    let alive = true;
    setMyRecordLoaded(false);
    getMyEventRecord(event.id, user.id)
      .then((row) => {
        if (!alive) return;
        setMyRecord(row);
        setMyRecordLoaded(true);
      })
      .catch(() => {
        if (alive) setMyRecordLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [event, user, role]);

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

  const setQrActive = async (active: boolean) => {
    if (!event) return;
    setBusy(true);
    const { error } = await updateQrSettings(event.id, { qr_active: active });
    setBusy(false);
    if (error) toast.show('Could not update the QR switch.', 'error');
    else {
      toast.show(
        active ? 'QR turned back on — students can scan.' : 'QR paused — scanning is blocked.',
        'success'
      );
      load();
    }
  };

  const setQrExpiry = async (minutes: number | null) => {
    if (!event) return;
    const expiresAt = minutes === null ? null : new Date(Date.now() + minutes * 60000).toISOString();
    setBusy(true);
    const { error } = await updateQrSettings(event.id, { qr_expires_at: expiresAt });
    setBusy(false);
    if (error) toast.show('Could not update the QR expiry.', 'error');
    else {
      toast.show(
        expiresAt ? `QR will expire in ${minutes} minutes.` : 'QR expiry removed.',
        'info'
      );
      load();
    }
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

  const qrState = event ? getQrState(event, now) : null;
  const qrCountdown = useMemo(() => {
    if (!event?.qr_expires_at) return null;
    const diff = new Date(event.qr_expires_at).getTime() - now;
    if (diff <= 0) return { label: 'QR expired', value: '00:00', expired: true };
    return { label: 'QR expires in', value: formatClock(diff / 1000), expired: false };
  }, [event, now]);

  const filteredRecords = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = records.filter(
      (r) =>
        !q ||
        (r.studentName ?? '').toLowerCase().includes(q) ||
        (r.studentCode ?? '').toLowerCase().includes(q) ||
        (r.department ?? '').toLowerCase().includes(q) ||
        (r.block ?? '').toLowerCase().includes(q)
    );
    return [...list].sort(
      (a, b) => new Date(a.scannedAt).getTime() - new Date(b.scannedAt).getTime()
    );
  }, [records, query]);

  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;

  if (notFound) {
    return (
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + SPACING.md }]}>
          <Pressable style={[styles.backBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={[styles.topTitle, { color: COLORS.textPrimary }]}>Event</Text>
        </View>
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
      <View style={[styles.container, { backgroundColor: COLORS.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + SPACING.md }]}>
          <Pressable style={[styles.backBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
          </Pressable>
          <Text style={[styles.topTitle, { color: COLORS.textPrimary }]}>Event</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </ScrollView>
      </View>
    );
  }

  const phase = getEventPhase(event);
  const statusBadge: { label: string; tone: BadgeTone } =
    event.status === 'rejected'
      ? { label: 'Rejected', tone: 'danger' }
      : phase === 'live'
        ? { label: 'Live now', tone: 'success' }
        : phase === 'upcoming'
          ? { label: 'Upcoming', tone: 'info' }
          : phase === 'closed'
            ? { label: 'Closed', tone: 'danger' }
            : { label: 'Ended', tone: 'neutral' };

  // --- The student's own status for this event ---------------------------
  const myEvaluation: AttendanceEvaluation | null = myRecord
    ? myRecord.status
      ? {
          status: myRecord.status === 'late' ? 'late' : 'present',
          lateBySeconds: myRecord.late_by_seconds ?? 0,
          almostLate: false,
          secondsToLate: 0,
        }
      : evaluateScan(
          myRecord.scanned_at,
          event.start_time,
          event.late_grace_minutes ?? DEFAULT_GRACE_MINUTES
        )
    : null;
  const hasScan = !!myRecord;
  const missedEvent =
    !hasScan && (phase === 'ended' || phase === 'closed');
  const imLate = !!myEvaluation && myEvaluation.status === 'late';
  const myBadge: { label: string; tone: BadgeTone } = !myRecordLoaded
    ? { label: 'Checking…', tone: 'neutral' }
    : hasScan
      ? imLate
        ? { label: 'Late', tone: 'warning' }
        : { label: 'On time', tone: 'success' }
      : missedEvent
        ? { label: 'Absent', tone: 'danger' }
        : { label: 'Not scanned yet', tone: 'info' };

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <View style={[styles.topBar, { borderBottomColor: COLORS.border, paddingTop: insets.top + SPACING.md }]}>
        <Pressable style={[styles.backBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <View style={styles.topTitles}>
          <Text style={[styles.topTitle, { color: COLORS.textPrimary }]} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={[styles.topSubtitle, { color: COLORS.textSecondary }]} numberOfLines={1}>
            {event.subject ?? event.event_code}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.infoCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
          <View style={styles.infoHeader}>
            <View style={styles.titles}>
              <Text style={[styles.infoTitle, { color: COLORS.textPrimary }]}>{event.title}</Text>
              {event.subject ? (
                <Text style={[styles.infoSubject, { color: COLORS.textSecondary }]}>{event.subject}</Text>
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
            <InfoItem icon="location-outline" label="Room" value={event.room || '—'} />
            <InfoItem icon="barcode-outline" label="Event code" value={event.event_code} />
            <InfoItem
              icon="hourglass-outline"
              label="Late after"
              value={`${event.late_grace_minutes ?? DEFAULT_GRACE_MINUTES} min`}
            />
            {(event.target_departments?.length ?? 0) > 0 ||
            (event.target_year_levels?.length ?? 0) > 0 ||
            (event.target_blocks?.length ?? 0) > 0 ? (
              <InfoItem
                icon="people-outline"
                label="For"
                value={[
                  event.target_departments?.join(', '),
                  event.target_year_levels?.join(', '),
                  event.target_blocks?.join(', '),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ) : null}
          </View>

          {event.description ? (
            <Text style={[styles.description, { color: COLORS.textSecondary, borderTopColor: COLORS.border }]}>
              {event.description}
            </Text>
          ) : null}
        </View>

        {role === 'student' && user ? (
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: COLORS.card,
                borderColor:
                  myBadge.tone === 'danger' ? COLORS.dangerSoft : COLORS.border,
              },
            ]}
          >
            <View style={styles.infoHeader}>
              <View style={styles.titles}>
                <Text style={[styles.infoTitle, { color: COLORS.textPrimary }]}>
                  Your attendance
                </Text>
              </View>
              <Badge small label={myBadge.label} tone={myBadge.tone} />
            </View>

            <Text style={[styles.myRecordText, { color: COLORS.textSecondary }]}>
              {!myRecordLoaded
                ? 'Checking your attendance for this event…'
                : hasScan && myRecord && myEvaluation
                  ? myEvaluation.status === 'late'
                    ? `Scanned ${formatDate(myRecord.scanned_at)} at ${formatTime(
                        myRecord.scanned_at
                      )} — ${formatLateBy(myEvaluation.lateBySeconds)}.`
                    : `Scanned ${formatDate(myRecord.scanned_at)} at ${formatTime(
                        myRecord.scanned_at
                      )} — recorded as on time.`
                  : missedEvent
                    ? 'You did not scan this event before it ended, so it is recorded as absent.'
                    : "You haven't scanned this event yet — scan the event QR code to record your attendance."}
            </Text>

            {myRecordLoaded && missedEvent ? (
              <Text style={[styles.myRecordSub, { color: COLORS.muted }]}>
                Ended {formatDate(event.end_time ?? event.start_time)} ·{' '}
                {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </Text>
            ) : null}

            {myRecordLoaded && !hasScan && !missedEvent ? (
              <AppButton
                variant="primary"
                size="sm"
                title="Scan QR"
                icon="qr-code-outline"
                onPress={() => router.push('/scan')}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segment, { backgroundColor: COLORS.card, borderColor: COLORS.border }, segment === 'qr' && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
            onPress={() => setSegment('qr')}
          >
            <Ionicons
              name="qr-code-outline"
              size={16}
              color={segment === 'qr' ? COLORS.textOnPrimary : COLORS.textSecondary}
            />
            <Text style={[styles.segmentText, { color: segment === 'qr' ? COLORS.textOnPrimary : COLORS.textSecondary }]}>
              QR Code
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segment, { backgroundColor: COLORS.card, borderColor: COLORS.border }, segment === 'records' && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
            onPress={() => setSegment('records')}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={segment === 'records' ? COLORS.textOnPrimary : COLORS.textSecondary}
            />
            <Text style={[styles.segmentText, { color: segment === 'records' ? COLORS.textOnPrimary : COLORS.textSecondary }]}>
              Attendance ({records.length})
            </Text>
          </Pressable>
        </View>

        {segment === 'qr' ? (
          canManage ? (
            <View style={[styles.qrCard, { backgroundColor: COLORS.card, borderColor: qrState?.scannable ? COLORS.cardBorderNeon : COLORS.border }]}>
              <Text style={[styles.qrTitle, { color: COLORS.textPrimary }]}>
                {event.title.toUpperCase()}
              </Text>
              <Text style={[styles.qrMeta, { color: COLORS.textSecondary }]}>
                {formatDate(event.start_time ?? event.end_time)} ·{' '}
                {formatTime(event.start_time)} – {formatTime(event.end_time)}
              </Text>
              {event.room ? (
                <Text style={[styles.qrMeta, { color: COLORS.textSecondary }]}>{event.room}</Text>
              ) : null}

              {qrState?.scannable ? (
                <View style={styles.qrWhite}>
                  {payload ? (
                    <QRCode value={payload} size={220} />
                  ) : (
                    <ActivityIndicator color={COLORS.primary} />
                  )}
                </View>
              ) : (
                <View style={[styles.qrDisabled, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border }]}>
                  <Ionicons
                    name={qrState?.expired ? 'time-outline' : 'pause-circle-outline'}
                    size={44}
                    color={qrState?.expired ? COLORS.danger : COLORS.warning}
                  />
                  <Text style={[styles.qrDisabledTitle, { color: COLORS.textPrimary }]}>
                    {qrState?.expired ? 'QR code expired' : 'QR code paused'}
                  </Text>
                  <Text style={[styles.qrDisabledText, { color: COLORS.textSecondary }]}>
                    {qrState?.expired
                      ? 'This QR expired, so students cannot scan it anymore. Reset the expiry to turn it back on.'
                      : 'Scanning is blocked until you turn the QR back on.'}
                  </Text>
                </View>
              )}

              {countdown ? (
                <View style={[styles.countdownBox, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border }]}>
                  <Text style={[styles.countdownLabel, { color: COLORS.muted }]}>{countdown.label}</Text>
                  <Text style={[styles.countdownValue, { color: COLORS.success }]}>{countdown.value}</Text>
                </View>
              ) : null}

              {qrCountdown ? (
                <View
                  style={[
                    styles.countdownBox,
                    {
                      backgroundColor: qrCountdown.expired ? COLORS.dangerSoft : COLORS.infoSoft,
                      borderColor: qrCountdown.expired ? COLORS.danger : COLORS.info,
                    },
                  ]}
                >
                  <Text style={[styles.countdownLabel, { color: qrCountdown.expired ? COLORS.danger : COLORS.info }]}>
                    {qrCountdown.label}
                  </Text>
                  <Text
                    style={[
                      styles.countdownValue,
                      { color: qrCountdown.expired ? COLORS.danger : COLORS.info },
                    ]}
                  >
                    {qrCountdown.value}
                  </Text>
                </View>
              ) : null}

              <View style={[styles.attendancePill, { backgroundColor: COLORS.successSoft, borderColor: COLORS.cardBorderNeon }]}>
                <Ionicons name="people-outline" size={16} color={COLORS.success} />
                <Text style={[styles.attendancePillText, { color: COLORS.success }]}>
                  {records.length} student{records.length === 1 ? '' : 's'} attended
                </Text>
              </View>

              <Text style={[styles.qrHint, { color: COLORS.muted }]}>
                Students scan this code with their own account. Scans before the
                start time are blocked, and anyone after the grace window is
                marked late.
              </Text>

              <View style={styles.qrActions}>
                <View style={[styles.qrControlBox, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border }]}>
                  <View style={styles.qrControlHeader}>
                    <Ionicons name="options-outline" size={16} color={COLORS.textSecondary} />
                    <Text style={[styles.qrControlTitle, { color: COLORS.textPrimary }]}>
                      QR controls
                    </Text>
                    <Badge
                      small
                      label={qrState?.scannable ? 'Scanning on' : 'Scanning off'}
                      tone={qrState?.scannable ? 'success' : 'danger'}
                    />
                  </View>

                  <Text style={[styles.qrControlLabel, { color: COLORS.textSecondary }]}>
                    QR expires at
                  </Text>
                  <View style={styles.qrChipRow}>
                    {QR_EXPIRY_OPTIONS.map((option) => {
                      const active =
                        option.minutes === null
                          ? !event.qr_expires_at
                          : !!event.qr_expires_at &&
                            Math.abs(
                              new Date(event.qr_expires_at).getTime() -
                                (Date.now() + (option.minutes ?? 0) * 60000)
                            ) < 60000;
                      return (
                        <Pressable
                          key={option.label}
                          style={[
                            styles.qrChip,
                            { backgroundColor: COLORS.card, borderColor: COLORS.border },
                            active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                          ]}
                          onPress={() => setQrExpiry(option.minutes)}
                          disabled={busy}
                        >
                          <Text
                            style={[
                              styles.qrChipText,
                              { color: active ? COLORS.textOnPrimary : COLORS.textSecondary },
                            ]}
                          >
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {event.qr_expires_at ? (
                    <Text style={[styles.qrExpiryHint, { color: COLORS.muted }]}>
                      Expires {formatDate(event.qr_expires_at)} at{' '}
                      {formatTime(event.qr_expires_at)}
                    </Text>
                  ) : null}

                  <AppButton
                    variant={qrState?.enabled ? 'danger' : 'success'}
                    title={qrState?.enabled ? 'Pause QR (stop scanning)' : 'Turn QR back on'}
                    icon={qrState?.enabled ? 'pause-circle-outline' : 'play-circle-outline'}
                    onPress={() => setQrActive(!qrState?.enabled)}
                    loading={busy}
                  />
                </View>

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
            <View style={[styles.qrCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <EmptyState
                icon="lock-closed-outline"
                title="QR code is visible to the event creator"
                message="Only the teacher who created this event and the admin can display the attendance QR code."
              />
            </View>
          )
        ) : (
          <View style={[styles.recordsCard, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
            <View style={styles.recordsStats}>
              <View style={styles.recordsStat}>
                <Text style={[styles.recordsStatValue, { color: COLORS.textPrimary }]}>{records.length}</Text>
                <Text style={[styles.recordsStatLabel, { color: COLORS.textSecondary }]}>Total</Text>
              </View>
              <View style={styles.recordsStat}>
                <Text style={[styles.recordsStatValue, { color: COLORS.success }]}>{presentCount}</Text>
                <Text style={[styles.recordsStatLabel, { color: COLORS.textSecondary }]}>On time</Text>
              </View>
              <View style={styles.recordsStat}>
                <Text style={[styles.recordsStatValue, { color: COLORS.danger }]}>{lateCount}</Text>
                <Text style={[styles.recordsStatLabel, { color: COLORS.textSecondary }]}>Late</Text>
              </View>
              <Pressable style={[styles.refreshBtn, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border }]} onPress={loadRecords} hitSlop={8}>
                <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            {canManage && groupStats.length > 0 ? (
              <View style={[styles.groupBox, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border }]}>
                <Text style={[styles.groupTitle, { color: COLORS.textPrimary }]}>
                  Attendance by department, year & block
                </Text>
                {groupStats.map((row) => {
                  const pct = Math.min(100, Math.round(row.percent));
                  const tone =
                    pct >= 60 ? COLORS.success : pct >= 30 ? COLORS.warning : COLORS.danger;
                  return (
                    <View key={`${row.department}-${row.yearLevel}-${row.block}`} style={styles.groupRow}>
                      <View style={styles.groupTop}>
                        <Text style={[styles.groupLabel, { color: COLORS.textPrimary }]} numberOfLines={1}>
                          {row.department} · {row.yearLevel} · {row.block}
                        </Text>
                        <Text style={[styles.groupValue, { color: tone }]}>
                          {pct}% ({row.attended}/{row.total})
                        </Text>
                      </View>
                      <View style={[styles.track, { backgroundColor: COLORS.card }]}>
                        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: tone }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Search students..."
            />

            {recordsLoading ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: SPACING.xl }} />
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
                {filteredRecords.map((row, index) => {
                  const evaluation = evaluateScan(
                    row.scannedAt,
                    event.start_time,
                    event.late_grace_minutes ?? DEFAULT_GRACE_MINUTES
                  );
                  const stored = {
                    status: row.status,
                    lateBySeconds: row.lateBySeconds,
                    almostLate: false,
                    secondsToLate: 0,
                  };
                  const isLate = row.status === 'late';
                  const tone = isLate
                    ? 'danger'
                    : evaluation.almostLate
                      ? 'info'
                      : 'success';
                  const toneColor =
                    tone === 'danger'
                      ? COLORS.danger
                      : tone === 'info'
                        ? COLORS.info
                        : COLORS.success;
                  const label = isLate
                    ? 'Late'
                    : evaluation.almostLate
                      ? 'Almost late'
                      : 'On time';

                  return (
                    <View
                      key={row.id}
                      style={[
                        styles.recordRow,
                        { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border },
                        { borderLeftColor: toneColor, borderLeftWidth: 3 },
                      ]}
                    >
                      <View style={[styles.recordIndex, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                        <Text style={[styles.recordIndexText, { color: COLORS.muted }]}>{index + 1}</Text>
                      </View>
                      <View style={styles.recordInfo}>
                        <Text style={[styles.recordName, { color: COLORS.textPrimary }]} numberOfLines={1}>
                          {row.studentName ?? 'Unnamed student'}
                        </Text>
                        <Text style={[styles.recordCode, { color: COLORS.textSecondary }]} numberOfLines={1}>
                          {row.studentCode ?? row.studentId.slice(0, 8)}
                          {row.department ? ` · ${row.department}` : ''}
                          {row.yearLevel ? ` ${row.yearLevel.replace(' Year', 'Y')}` : ''}
                          {row.block ? ` ${row.block.replace('Block ', 'Blk ')}` : ''}
                        </Text>
                      </View>
                      <View style={styles.recordRight}>
                        <Text style={[styles.recordTime, { color: COLORS.textPrimary }]}>
                          {formatTime(row.scannedAt)}
                        </Text>
                        <Text style={[styles.recordLate, { color: toneColor }]}>
                          {isLate ? formatLateBy(row.lateBySeconds) : label}
                        </Text>
                      </View>
                      <View style={[styles.recordBadge, { backgroundColor: toneColor + '22', borderColor: toneColor }]}>
                        <Text style={[styles.recordBadgeText, { color: toneColor }]}>{label}</Text>
                      </View>
                    </View>
                  );
                })}
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
  const COLORS = useColors();
  const styles = useStyles();
  return (
    <View style={styles.infoItem}>
      <Ionicons name={icon} size={15} color={COLORS.textSecondary} />
      <View style={styles.infoItemText}>
        <Text style={[styles.infoItemLabel, { color: COLORS.muted }]}>{label}</Text>
        <Text style={[styles.infoItemValue, { color: COLORS.textPrimary }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.xxl,
      paddingTop: SPACING.xxxl + SPACING.sm,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
    },
    topTitles: {
      flex: 1,
    },
    topTitle: {
      fontSize: 18,
      fontWeight: '800',
      letterSpacing: -0.3,
    },
    topSubtitle: {
      fontSize: 12,
      marginTop: 1,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: SPACING.xxl,
      paddingBottom: 120,
      gap: SPACING.lg,
      maxWidth: 760,
      width: '100%',
      alignSelf: 'center',
      paddingTop: SPACING.lg,
    },
    infoCard: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
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
    },
    infoSubject: {
      fontSize: 14,
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
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    infoItemValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    description: {
      fontSize: 13,
      lineHeight: 19,
      borderTopWidth: 1,
      paddingTop: SPACING.md,
    },
    myRecordText: {
      fontSize: 13.5,
      lineHeight: 20,
    },
    myRecordSub: {
      fontSize: 12.5,
      fontWeight: '600',
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
      borderWidth: 1,
      borderRadius: RADIUS.md,
      paddingVertical: 11,
    },
    segmentText: {
      fontSize: 13,
      fontWeight: '700',
    },
    qrCard: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      padding: SPACING.xl,
      gap: SPACING.md,
      alignItems: 'center',
    },
    qrTitle: {
      fontSize: 17,
      fontWeight: '900',
      textAlign: 'center',
      letterSpacing: 0.5,
    },
    qrMeta: {
      fontSize: 13,
      textAlign: 'center',
    },
    qrWhite: {
      backgroundColor: '#FFFFFF',
      borderRadius: RADIUS.lg,
      padding: SPACING.lg,
      marginVertical: SPACING.sm,
    },
    qrDisabled: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.xl,
      alignItems: 'center',
      gap: 8,
      marginVertical: SPACING.sm,
      width: '100%',
    },
    qrDisabledTitle: {
      fontSize: 16,
      fontWeight: '800',
    },
    qrDisabledText: {
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
    countdownBox: {
      alignItems: 'center',
      borderRadius: RADIUS.md,
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: 26,
      gap: 2,
    },
    countdownLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    countdownValue: {
      fontSize: 30,
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    attendancePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    attendancePillText: {
      fontSize: 13,
      fontWeight: '800',
    },
    qrHint: {
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 17,
    },
    qrActions: {
      width: '100%',
      gap: SPACING.sm,
      marginTop: SPACING.xs,
    },
    qrControlBox: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.lg,
      gap: SPACING.sm,
    },
    qrControlHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    qrControlTitle: {
      flex: 1,
      fontSize: 14,
      fontWeight: '800',
    },
    qrControlLabel: {
      fontSize: 12,
      fontWeight: '700',
    },
    qrChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    qrChip: {
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    qrChipText: {
      fontSize: 12,
      fontWeight: '700',
    },
    qrExpiryHint: {
      fontSize: 11,
    },
    recordsCard: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
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
    },
    recordsStatLabel: {
      fontSize: 11,
      fontWeight: '600',
    },
    refreshBtn: {
      marginLeft: 'auto',
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupBox: {
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.lg,
      gap: SPACING.md,
    },
    groupTitle: {
      fontSize: 14,
      fontWeight: '800',
    },
    groupRow: {
      gap: 5,
    },
    groupTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    groupLabel: {
      flexShrink: 1,
      fontSize: 12.5,
      fontWeight: '700',
    },
    groupValue: {
      fontSize: 12.5,
      fontWeight: '800',
    },
    track: {
      height: 7,
      borderRadius: 4,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 4,
    },
    recordList: {
      gap: SPACING.sm,
    },
    recordRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    recordIndex: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recordIndexText: {
      fontSize: 11,
      fontWeight: '800',
    },
    recordInfo: {
      flex: 1,
    },
    recordName: {
      fontSize: 14,
      fontWeight: '700',
    },
    recordCode: {
      fontSize: 11.5,
    },
    recordRight: {
      alignItems: 'flex-end',
      gap: 2,
    },
    recordTime: {
      fontSize: 13,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    recordLate: {
      fontSize: 11,
      fontWeight: '700',
    },
    recordBadge: {
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      maxWidth: 92,
    },
    recordBadgeText: {
      fontSize: 10,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      textAlign: 'center',
    },
  })
);
