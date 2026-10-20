import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'primary' | 'info' | 'warning' | 'danger' | 'neutral';
  caption?: string;
};

const tones = {
  primary: { fg: COLORS.success, bg: COLORS.successSoft },
  info: { fg: COLORS.info, bg: COLORS.infoSoft },
  warning: { fg: COLORS.warning, bg: COLORS.warningSoft },
  danger: { fg: COLORS.danger, bg: COLORS.dangerSoft },
  neutral: { fg: COLORS.textSecondary, bg: COLORS.border },
} as const;

export default function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  caption,
}: StatCardProps) {
  const t = tones[tone];
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: t.bg }]}>
        <Ionicons
          name={icon ?? 'stats-chart-outline'}
          size={16}
          color={t.fg}
        />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 4,
    ...SHADOW.card,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  caption: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 2,
  },
});
