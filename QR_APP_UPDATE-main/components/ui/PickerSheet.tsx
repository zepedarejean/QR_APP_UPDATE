import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';

/**
 * Tappable field that looks like AppInput but opens a PickerSheet instead of
 * the keyboard. Shows the current value (or the placeholder in muted text).
 */
export function PickerField({
  label,
  value,
  placeholder,
  hint,
  error,
  icon,
  onPress,
}: {
  label?: string;
  value: string | null;
  placeholder: string;
  hint?: string | null;
  error?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const COLORS = useColors();
  const styles = useStyles();

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.field,
          error ? styles.fieldError : null,
          pressed && styles.fieldPressed,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={18}
            color={error ? COLORS.danger : COLORS.muted}
          />
        ) : null}
        <Text
          style={[styles.fieldValue, !value && styles.fieldPlaceholder]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.muted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Bottom-sheet list of options (tap to select, tap the backdrop or ✕ to close).
 * Optionally renders a caption under each option (e.g. department full names).
 */
export function PickerSheet({
  visible,
  title,
  options,
  value,
  descriptions,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly string[];
  value: string | null;
  descriptions?: Record<string, string>;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const COLORS = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (visible) {
      translateY.setValue(30);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      translateY.setValue(30);
    }
  }, [visible, translateY]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close picker"
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + SPACING.lg,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {options.map((option) => {
              const selected = option === value;
              const description = descriptions?.[option];
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    onSelect(option);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    selected && styles.optionRowSelected,
                    pressed && styles.optionRowPressed,
                  ]}
                >
                  <View style={styles.optionText}>
                    <Text
                      style={[
                        styles.optionLabel,
                        selected && { color: COLORS.primary },
                      ]}
                    >
                      {option}
                    </Text>
                    {description ? (
                      <Text style={styles.optionDesc}>{description}</Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.primary}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
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
    fieldPressed: {
      opacity: 0.85,
    },
    fieldValue: {
      flex: 1,
      fontSize: 15,
      color: COLORS.textPrimary,
      paddingVertical: 12,
    },
    fieldPlaceholder: {
      color: COLORS.muted,
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

    backdrop: {
      flex: 1,
      backgroundColor: COLORS.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: COLORS.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      borderTopWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: COLORS.border,
      marginBottom: SPACING.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
      marginBottom: SPACING.md,
    },
    title: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.inputBackground,
    },
    list: {
      maxHeight: 360,
    },
    listContent: {
      gap: 6,
      paddingBottom: SPACING.xs,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      minHeight: 54,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1.5,
      borderColor: 'transparent',
      backgroundColor: COLORS.inputBackground,
    },
    optionRowSelected: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.infoSoft,
    },
    optionRowPressed: {
      opacity: 0.8,
    },
    optionText: {
      flex: 1,
      gap: 2,
    },
    optionLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: COLORS.textPrimary,
    },
    optionDesc: {
      fontSize: 12,
      color: COLORS.muted,
    },
  })
);
