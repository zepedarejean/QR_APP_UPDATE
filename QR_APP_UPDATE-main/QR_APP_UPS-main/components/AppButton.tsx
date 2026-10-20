import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'success';

type AppButtonProps = {
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
  theme?: 'primary';
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export default function AppButton({
  title,
  icon,
  theme,
  variant,
  size = 'md',
  onPress,
  disabled,
  loading,
  style,
}: AppButtonProps) {
  const resolved: ButtonVariant = variant ?? (theme === 'primary' ? 'primary' : 'secondary');
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        variantStyles[resolved].container,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variantStyles[resolved].text.color as string}
          />
        ) : icon ? (
          <Ionicons
            name={icon}
            size={size === 'sm' ? 16 : 19}
            color={variantStyles[resolved].text.color as string}
          />
        ) : null}
        <Text
          style={[
            styles.label,
            size === 'sm' && styles.labelSm,
            variantStyles[resolved].text,
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

const variantStyles: Record<
  ButtonVariant,
  { container: ViewStyle; text: { color: string } }
> = {
  primary: {
    container: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
      ...SHADOW.primary,
    },
    text: { color: '#04140D' },
  },
  secondary: {
    container: {
      backgroundColor: COLORS.card,
      borderColor: COLORS.border,
    },
    text: { color: COLORS.textPrimary },
  },
  ghost: {
    container: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    text: { color: COLORS.accent },
  },
  danger: {
    container: {
      backgroundColor: COLORS.dangerSoft,
      borderColor: COLORS.danger,
    },
    text: { color: COLORS.danger },
  },
  success: {
    container: {
      backgroundColor: COLORS.successSoft,
      borderColor: COLORS.primary,
    },
    text: { color: COLORS.success },
  },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 48,
  },
  sm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: RADIUS.sm,
    width: 'auto',
  },
  lg: {
    paddingVertical: 17,
    minHeight: 56,
    borderRadius: RADIUS.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  labelSm: {
    fontSize: 13,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
