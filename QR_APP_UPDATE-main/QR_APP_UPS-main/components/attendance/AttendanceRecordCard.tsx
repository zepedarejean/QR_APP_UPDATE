import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import {
  computeAttendanceStatus,
  formatDateShort,
  formatTime,
  type AttendanceStatus,
} from '@/lib/format';
import type { AttendanceRecord } from '@/lib/attendance';

const statusMeta: Record<AttendanceStatus, { label: string; tone: BadgeTone; icon: keyof typeof Ionicons.glyphMap }> = {
  present: { label: 'Present', tone: 'success', icon: 'checkmark-circle' },
  late: { label: 'Late', tone: 'warning', icon: 'time' },
  absent: { label: 'Absent', tone: 'danger', icon: 'close-circle' },
};

export default function AttendanceRecordCard({
  record,
}: {
  record: AttendanceRecord;
}) {
  const status: AttendanceStatus =
    record.status ??
    computeAttendanceStatus(record.scannedAt, record.startTime ?? null);
  const meta = statusMeta[status];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
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
        <Badge label={meta.label} tone={meta.tone} small />
      </View>

      {record.teacherName ? (
        <View style={styles.metaRow}>
          <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.meta}>Teacher: {record.teacherName}</Text>
        </View>
      ) : null}

      <View style={styles.timeRow}>
        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>Date</Text>
          <Text style={styles.timeValue}>{formatDateShort(record.scannedAt)}</Text>
        </View>
        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>Scanned</Text>
          <Text style={styles.timeValue}>{formatTime(record.scannedAt)}</Text>
        </View>
        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>Starts</Text>
          <Text style={styles.timeValue}>{formatTime(record.startTime)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 8,
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subject: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  timeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: 2,
  },
  timeBox: {
    flex: 1,
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
