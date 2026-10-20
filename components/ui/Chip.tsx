import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  small?: boolean;
  disabled?: boolean;
};

/** A single selectable pill (used for departments, blocks, skills...). */
export function Chip({ label, selected, onPress, icon, small, disabled }: ChipProps) {
  const COLORS = useColors();
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[
        styles.chip,
        small && styles.chipSmall,
        selected && styles.chipSelected,
        disabled && styles.chipDisabled,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={small ? 12 : 14}
          color={selected ? COLORS.textOnPrimary : COLORS.textSecondary}
        />
      ) : null}
      <Text style={[styles.label, small && styles.labelSmall, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

type ChipGroupProps = {
  options: readonly string[];
  value: string | string[] | null;
  onChange: (value: any) => void;
  multiple?: boolean;
  small?: boolean;
  /**
   * Grid mode (single-select): renders equal-width tiles aligned in clean
   * rows instead of ragged wrapping pills. Use 2 for long options,
   * 4–6 for short ones.
   */
  columns?: number;
  /** Optional small caption rendered under each option label (grid mode). */
  captions?: Record<string, string>;
};

/** Wrap of chips with single- or multi-select behaviour. */
export function ChipGroup({
  options,
  value,
  onChange,
  multiple,
  small,
  columns,
  captions,
}: ChipGroupProps) {
  const COLORS = useColors();
  const styles = useStyles();

  const isSelected = (option: string) =>
    multiple
      ? Array.isArray(value) && value.includes(option)
      : value === option;

  const select = (option: string) => {
    if (!multiple) {
      onChange(option);
      return;
    }
    const current = Array.isArray(value) ? [...value] : [];
    const index = current.indexOf(option);
    if (index >= 0) current.splice(index, 1);
    else current.push(option);
    onChange(current);
  };

  // Grid mode: equal-width tiles in perfectly aligned rows.
  if (columns && columns > 1 && !multiple) {
    const cellMin = Math.max(10, 100 / columns - 5);
    return (
      <View style={styles.grid}>
        {options.map((option) => {
          const selected = isSelected(option);
          const caption = captions?.[option];
          return (
            <View key={option} style={[styles.gridCell, { minWidth: `${cellMin}%` }]}>
              <Pressable
                onPress={() => select(option)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.tile,
                  { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border },
                  selected && styles.tileSelected,
                  pressed && styles.tilePressed,
                ]}
              >
                <Text
                  style={[
                    styles.tileLabel,
                    { color: COLORS.textPrimary },
                    selected && styles.tileLabelSelected,
                  ]}
                >
                  {option}
                </Text>
                {caption ? (
                  <Text
                    style={[
                      styles.tileCaption,
                      { color: COLORS.textSecondary },
                      selected && styles.tileCaptionSelected,
                    ]}
                  >
                    {caption}
                  </Text>
                ) : null}
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { borderColor: COLORS.border }]}>
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          small={small}
          selected={isSelected(option)}
          onPress={() => select(option)}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
      borderWidth: 0,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    gridCell: {
      flexGrow: 1,
      flexBasis: 0,
    },
    tile: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 6,
      gap: 2,
      minHeight: 48,
    },
    tileSelected: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    tilePressed: {
      opacity: 0.75,
    },
    tileLabel: {
      fontSize: 13.5,
      fontWeight: '800',
      textAlign: 'center',
    },
    tileLabelSelected: {
      color: COLORS.textOnPrimary,
    },
    tileCaption: {
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 13,
    },
    tileCaptionSelected: {
      color: COLORS.textOnPrimary,
      opacity: 0.85,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: RADIUS.pill,
      borderWidth: 1.5,
      borderColor: COLORS.border,
      backgroundColor: COLORS.inputBackground,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    chipSmall: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
    },
    chipSelected: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    chipDisabled: {
      opacity: 0.5,
    },
    label: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    labelSmall: {
      fontSize: 11,
    },
    labelSelected: {
      color: COLORS.textOnPrimary,
    },
  })
);
