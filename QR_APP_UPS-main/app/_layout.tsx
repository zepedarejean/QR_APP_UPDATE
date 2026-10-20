import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';

const PUBLIC_ROUTES = ['login', 'register'];

export default function RootLayout() {
  const { session, loading } = useAuth();
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
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
          name="notifications"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
