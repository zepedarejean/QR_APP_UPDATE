import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';
import {
  computeAttendanceStatus,
  formatDateShort,
  formatTime,
  type AttendanceStatus,
} from '@/lib/format';
import type { AttendanceRecord } from '@/lib/attendance';

const statusMeta: Record<
  AttendanceStatus,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  present: { label: 'Present', icon: 'checkmark-circle' },
  late: { label: 'Late', icon: 'time' },
  absent: { label: 'Absent', icon: 'close-circle' },
};

export default function AttendanceRecordCard({
  record,
  onPress,
}: {
  record: AttendanceRecord;
  onPress?: () => void;
}) {
  const COLORS = useColors();
  const styles = useStyles();
  const status: AttendanceStatus =
    record.status ??
    computeAttendanceStatus(record.scannedAt, record.startTime ?? null);
  const meta = statusMeta[status];
  const isAbsent = status === 'absent';

  const toneColor =
    status === 'present'
      ? COLORS.success
      : status === 'late'
        ? COLORS.warning
        : COLORS.danger;
  const toneSoft =
    status === 'present'
      ? COLORS.successSoft
      : status === 'late'
        ? COLORS.warningSoft
        : COLORS.dangerSoft;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={[styles.accentBar, { backgroundColor: toneColor }]} />

      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: toneSoft, borderColor: toneColor + '66' }]}>
          <Ionicons name={meta.icon} size={20} color={toneColor} />
        </View>

        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={2}>
            {record.eventTitle}
          </Text>
          {record.subject ? (
            <Text style={styles.subject} numberOfLines={1}>
              {record.subject}
            </Text>
          ) : null}
        </View>

        <View style={[styles.statusChip, { backgroundColor: toneSoft, borderColor: toneColor }]}>
          <Text style={[styles.statusText, { color: toneColor }]}>
            {meta.label}
          </Text>
        </View>
      </View>

      <View style={styles.metaWrap}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.muted} />
          <Text style={styles.meta}>{formatDateShort(record.scannedAt)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons
            name={isAbsent ? 'log-out-outline' : 'scan-outline'}
            size={13}
            color={COLORS.muted}
          />
          <Text style={styles.meta}>
            {isAbsent ? 'Ended' : 'Scanned'}{' '}
            {formatTime(
              isAbsent ? record.endTime ?? record.scannedAt : record.scannedAt
            )}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="flag-outline" size={13} color={COLORS.muted} />
          <Text style={styles.meta}>Starts {formatTime(record.startTime)}</Text>
        </View>
      </View>

      {record.teacherName ? (
        <View style={styles.teacherRow}>
          <Ionicons name="person-circle-outline" size={15} color={COLORS.info} />
          <Text style={styles.teacherText} numberOfLines={1}>
            {record.teacherName}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={COLORS.muted}
            style={styles.chevron}
          />
        </View>
      ) : (
        <View style={styles.teacherRow}>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={COLORS.muted}
            style={styles.chevron}
          />
        </View>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    card: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.lg,
      paddingLeft: SPACING.lg + 4,
      gap: SPACING.md,
      overflow: 'hidden',
      ...SHADOW.card,
    },
    cardPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.995 }],
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 13,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titles: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 15.5,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    subject: {
      fontSize: 12.5,
      color: COLORS.textSecondary,
    },
    statusChip: {
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    metaWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: COLORS.inputBackground,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    meta: {
      fontSize: 11.5,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    teacherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: COLORS.border,
      paddingTop: SPACING.sm,
    },
    teacherText: {
      flex: 1,
      fontSize: 12.5,
      fontWeight: '600',
      color: COLORS.textSecondary,
    },
    chevron: {
      marginLeft: 'auto',
    },
  })
);
