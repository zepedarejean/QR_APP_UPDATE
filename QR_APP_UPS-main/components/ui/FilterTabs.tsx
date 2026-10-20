import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';

export type FilterOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type FilterTabsProps<T extends string> = {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export default function FilterTabs<T extends string>({
  options,
  value,
  onChange,
}: FilterTabsProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>
              {opt.label}
              {opt.count !== undefined ? ` (${opt.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: SPACING.lg,
  },
  chip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  textActive: {
    color: '#04140D',
    fontWeight: '800',
  },
});
