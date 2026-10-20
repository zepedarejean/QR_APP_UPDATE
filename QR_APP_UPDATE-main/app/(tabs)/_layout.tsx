import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import { useColors, makeStyles } from '@/lib/theme';
import AppSidebar from '@/components/layout/AppSidebar';

const TAB_BAR_CONTENT_HEIGHT = 54;

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const COLORS = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const role = profile?.role ?? null;

  // Clears the home-indicator / gesture bar so every tab button
  // is fully visible, even on edge-to-edge Android.
  const bottomInset = Math.max(insets.bottom, 8);

  const studentOnly = role === 'teacher' || role === 'admin' ? { href: null } : {};
  const teacherOnly = role !== 'teacher' ? { href: null } : {};
  const adminOnly = role !== 'admin' ? { href: null } : {};

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: isWide ? 0 : TAB_BAR_CONTENT_HEIGHT + bottomInset,
          paddingTop: 6,
          paddingBottom: bottomInset,
          display: isWide ? 'none' : 'flex',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        sceneStyle: isWide ? styles.sceneWide : styles.scene,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          ...studentOnly,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="qr-code-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="teacher"
        options={{
          title: 'Events',
          ...teacherOnly,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          ...adminOnly,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );

  if (isWide) {
    return (
      <View style={styles.row}>
        <AppSidebar />
        <View style={styles.sceneWide}>{tabs}</View>
      </View>
    );
  }

  return tabs;
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    row: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: COLORS.background,
    },
    scene: {
      backgroundColor: COLORS.background,
    },
    sceneWide: {
      flex: 1,
      backgroundColor: COLORS.background,
    },
  })
);
