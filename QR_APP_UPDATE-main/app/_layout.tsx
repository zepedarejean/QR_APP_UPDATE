import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { ToastProvider } from '@/components/ui/Toast';

const PUBLIC_ROUTES = ['login', 'register'];

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { session, loading } = useAuth();
  const { theme, colors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const path = segments?.[0];
    const inAuthGroup = PUBLIC_ROUTES.includes(path as string);
    const inTabsGroup = path === '(tabs)';

    if (!session && (inTabsGroup || (!inAuthGroup && segments?.length > 0))) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!segments?.length && !session) {
      router.replace('/login');
    }
  }, [session, loading, segments]);

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Keying by the theme name remounts the whole tree, so every stylesheet
  // is rebuilt with the new palette (see lib/theme.tsx).
  return (
    <View key={theme} style={styles.root}>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="event/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="chat/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="notifications"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="settings"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>
      </ToastProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
