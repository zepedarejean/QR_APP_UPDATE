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
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.solid },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={18} color="#FFFFFF" />
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
  primary: { solid: '#2563EB' },
  info: { solid: '#3B82F6' },
  warning: { solid: '#F59E0B' },
  neutral: { solid: '#6366F1' },
}));

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    card: {
      flexGrow: 1,
      flexBasis: 0,
      minWidth: 96,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.md,
      gap: 6,
      ...SHADOW.card,
    },
    pressed: {
      opacity: 0.9,
      transform: [{ scale: 0.98 }],
    },
    iconWrap: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: 'rgba(255, 255, 255, 0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: 12.5,
      fontWeight: '800',
      color: '#FFFFFF',
    },
    caption: {
      fontSize: 10.5,
      color: 'rgba(255, 255, 255, 0.82)',
    },
  })
);
