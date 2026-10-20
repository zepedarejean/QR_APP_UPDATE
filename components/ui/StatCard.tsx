import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles } from '@/lib/theme';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';

export type StatTone =
  | 'primary'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: StatTone;
  caption?: string;
  onPress?: () => void;
  /** Filled solid-color card with white text (used on the admin home). */
  solid?: boolean;
  style?: ViewStyle;
};

export const useStatTones = makeStyles((COLORS) => ({
  primary: { fg: COLORS.primary, bg: COLORS.infoSoft, solid: '#1E3A8A' },
  info: { fg: COLORS.info, bg: COLORS.infoSoft, solid: '#1D4ED8' },
  success: { fg: COLORS.success, bg: COLORS.successSoft, solid: '#047857' },
  warning: { fg: COLORS.warning, bg: COLORS.warningSoft, solid: '#B45309' },
  danger: { fg: COLORS.danger, bg: COLORS.dangerSoft, solid: '#B91C1C' },
  neutral: { fg: COLORS.textSecondary, bg: COLORS.border, solid: '#4338CA' },
}));

export default function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  caption,
  onPress,
  solid = false,
  style,
}: StatCardProps) {
  const styles = useStyles();
  const tones = useStatTones();
  const t = tones[tone];

  const body = solid ? (
    <>
      <View style={styles.row}>
        <View style={styles.solidIcon}>
          <Ionicons name={icon ?? 'stats-chart-outline'} size={16} color="#FFFFFF" />
        </View>
        {onPress ? (
          <Ionicons name="chevron-forward" size={15} color="rgba(255,255,255,0.85)" />
        ) : null}
      </View>
      <Text style={styles.solidValue}>{value}</Text>
      <Text style={styles.solidLabel} numberOfLines={1}>
        {label}
      </Text>
    </>
  ) : (
    <>
      <View style={[styles.accentBar, { backgroundColor: t.fg }]} />
      <View style={styles.row}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: t.bg, borderColor: t.fg + '66' },
          ]}
        >
          <Ionicons name={icon ?? 'stats-chart-outline'} size={18} color={t.fg} />
        </View>
        {onPress ? (
          <View style={styles.chevron}>
            <Ionicons name="chevron-forward" size={14} color={t.fg} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.value, { color: t.fg }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </>
  );

  const baseStyle: ViewStyle[] = solid
    ? [styles.solidCard, { backgroundColor: t.solid }, ...(SHADOW.card ? [] : [])]
    : [styles.card, { borderColor: t.fg + '59' }];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...baseStyle, pressed && styles.cardPressed, style]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={[...baseStyle, style]}>{body}</View>;
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 100,
      backgroundColor: COLORS.elevated,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.lg,
      paddingLeft: SPACING.lg + 4,
      gap: 3,
      overflow: 'hidden',
      ...SHADOW.card,
    },
    solidCard: {
      width: '100%',
      minWidth: 96,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      gap: 2,
      overflow: 'hidden',
      ...SHADOW.card,
    },
    cardPressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    solidIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    solidValue: {
      fontSize: 24,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: -0.8,
      marginTop: 6,
    },
    solidLabel: {
      fontSize: 11.5,
      fontWeight: '700',
      color: 'rgba(255, 255, 255, 0.88)',
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevron: {
      width: 24,
      height: 24,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.inputBackground,
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    value: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.8,
      marginTop: SPACING.sm,
    },
    label: {
      fontSize: 12.5,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    caption: {
      fontSize: 11,
      color: COLORS.muted,
      marginTop: 2,
    },
  })
);
