import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
};

export default function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
}: SearchBarProps) {
  const COLORS = useColors();
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <Ionicons name="search-outline" size={17} color={COLORS.muted} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable hitSlop={10} onPress={() => onChangeText('')}>
          <Ionicons name="close-circle" size={17} color={COLORS.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    minHeight: 44,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    paddingVertical: 10,
  },
  })
);
