import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useColors, makeStyles } from '@/lib/theme';

export default function NotFoundScreen() {
  const COLORS = useColors();
  const styles = useStyles();
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Oops! Not Found</Text>
        <Text style={styles.subtitle}>
          This screen does not exist.
        </Text>
        <Link href="/" style={styles.link}>
          Go to home screen!
        </Link>
      </View>
    </>
  );
}

const useStyles = makeStyles((COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 8,
    marginBottom: 16,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.accent,
  },
}));
