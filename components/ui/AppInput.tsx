import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';

type AppInputProps = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
};

export default function AppInput({
  label,
  error,
  hint,
  icon,
  isPassword,
  style,
  ...rest
}: AppInputProps) {
  const COLORS = useColors();
  const styles = useStyles();
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, error ? styles.fieldError : null]}>
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={error ? COLORS.danger : COLORS.muted}
          />
        ) : null}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={COLORS.muted}
          secureTextEntry={isPassword && hidden}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            hitSlop={10}
            onPress={() => setHidden((v) => !v)}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={COLORS.muted}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    minHeight: 50,
  },
  fieldError: {
    borderColor: COLORS.danger,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingVertical: 12,
  },
  error: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: COLORS.muted,
  },
  })
);
