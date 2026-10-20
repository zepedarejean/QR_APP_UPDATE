import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles } from '@/lib/theme';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';

type QuickActionCardProps = {
  label: string;
  caption?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'primary' | 'info' | 'warning' | 'neutral';
  onPress: () => void;
};

export default function QuickActionCard({
  label,
  caption,
  icon,
  tone = 'primary',
  onPress,
}: QuickActionCardProps) {
  const styles = useStyles();
  const tones = useTones();
  const t = tones[tone];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={[styles.iconWrap, { backgroundColor: t.bg }]}>
        <Ionicons name={icon} size={20} color={t.fg} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {caption ? (
        <Text style={styles.caption} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

const useTones = makeStyles((COLORS) => ({
  primary: { bg: COLORS.infoSoft, fg: COLORS.primary },
  info: { bg: COLORS.infoSoft, fg: COLORS.info },
  warning: { bg: COLORS.warningSoft, fg: COLORS.warning },
  neutral: { bg: COLORS.border, fg: COLORS.textPrimary },
}));

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 96,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 8,
    ...SHADOW.card,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  caption: {
    fontSize: 11,
    color: COLORS.muted,
  },
  })
);
