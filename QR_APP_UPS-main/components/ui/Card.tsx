import { StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';

type CardProps = ViewProps & {
  variant?: 'default' | 'elevated' | 'outline' | 'accent';
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export default function Card({
  variant = 'default',
  padded = true,
  style,
  children,
  ...rest
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'outline' && styles.outline,
        variant === 'accent' && styles.accent,
        !padded && styles.flush,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOW.card,
  },
  elevated: {
    backgroundColor: COLORS.elevated,
    borderColor: COLORS.cardBorderNeon,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: COLORS.border,
  },
  accent: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.successSoft,
  },
  flush: {
    padding: 0,
    gap: 0,
  },
});
