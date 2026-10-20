import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';

type AttendanceSummaryCardProps = {
  /** 0–100, or null when there are no past events yet. */
  rate: number | null;
  attended: number;
  ended: number;
  onTime: number;
  late: number;
  absent: number;
  scans: number;
};

/**
 * One tidy card that holds the whole student attendance summary:
 * rate + progress bar on top, then a 2x2 grid of colored counters.
 */
export default function AttendanceSummaryCard({
  rate,
  attended,
  ended,
  onTime,
  late,
  absent,
  scans,
}: AttendanceSummaryCardProps) {
  const COLORS = useColors();
  const styles = useStyles();

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.topText}>
          <Text style={styles.rateLabel}>ATTENDANCE RATE</Text>
          <Text style={styles.rateValue}>{rate !== null ? `${rate}%` : '—'}</Text>
        </View>
        <View style={styles.topIcon}>
          <Ionicons name="trending-up-outline" size={22} color={COLORS.success} />
        </View>
      </View>

      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${Math.min(100, rate ?? 0)}%` }]}
        />
      </View>
      <Text style={styles.caption}>
        {ended > 0
          ? `You attended ${attended} of ${ended} past events`
          : 'No past events yet — scan an event QR to get started'}
      </Text>

      <View style={styles.divider} />

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          <MiniStat color={COLORS.success} label="On time" value={onTime} />
          <MiniStat color={COLORS.danger} label="Late" value={late} />
        </View>
        <View style={styles.gridRow}>
          <MiniStat color={COLORS.muted} label="Absent" value={absent} />
          <MiniStat color={COLORS.info} label="Scans" value={scans} />
        </View>
      </View>
    </View>
  );
}

function MiniStat({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  const styles = useStyles();
  return (
    <View style={styles.mini}>
      <View style={styles.miniLabelRow}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.miniLabel}>{label}</Text>
      </View>
      <Text style={styles.miniValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    card: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: COLORS.cardBorderNeon,
      padding: SPACING.xl,
      gap: SPACING.md,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    topText: {
      gap: 2,
    },
    rateLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: COLORS.textSecondary,
      letterSpacing: 1,
    },
    rateValue: {
      fontSize: 40,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -1.5,
    },
    topIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: COLORS.successSoft,
      borderWidth: 1,
      borderColor: COLORS.cardBorderNeon,
      alignItems: 'center',
      justifyContent: 'center',
    },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: COLORS.inputBackground,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: 4,
      backgroundColor: COLORS.primary,
    },
    caption: {
      fontSize: 12.5,
      color: COLORS.textSecondary,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.border,
      marginTop: 2,
    },
    grid: {
      gap: SPACING.md,
    },
    gridRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    mini: {
      flex: 1,
      backgroundColor: COLORS.surface,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      gap: 4,
    },
    miniLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    miniLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    miniValue: {
      fontSize: 20,
      fontWeight: '800',
      color: COLORS.textPrimary,
      letterSpacing: -0.5,
    },
  })
);
