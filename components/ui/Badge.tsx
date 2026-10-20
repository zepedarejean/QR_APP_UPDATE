import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles } from '@/lib/theme';
import { RADIUS } from '@/constants/theme';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
  icon?: keyof typeof Ionicons.glyphMap;
  small?: boolean;
};

const useTones = makeStyles(
  (COLORS): Record<BadgeTone, { bg: string; fg: string }> => ({
    success: { bg: COLORS.successSoft, fg: COLORS.success },
    warning: { bg: COLORS.warningSoft, fg: COLORS.warning },
    danger: { bg: COLORS.dangerSoft, fg: COLORS.danger },
    info: { bg: COLORS.infoSoft, fg: COLORS.info },
    neutral: { bg: COLORS.border, fg: COLORS.textSecondary },
  })
);

export default function Badge({ label, tone = 'neutral', icon, small }: BadgeProps) {
  const styles = useStyles();
  const tones = useTones();
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, small && styles.small]}>
      {icon ? <Ionicons name={icon} size={small ? 11 : 13} color={t.fg} /> : null}
      <Text style={[styles.text, { color: t.fg }, small && styles.textSmall]}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  textSmall: {
    fontSize: 10,
  },
  })
);
