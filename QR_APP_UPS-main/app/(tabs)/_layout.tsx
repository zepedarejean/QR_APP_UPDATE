import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWindowDimensions } from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import AppSidebar from '@/components/layout/AppSidebar';

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const role = profile?.role ?? null;

  const studentOnly = role === 'teacher' ? { href: null } : {};
  const teacherOnly = role === 'student' ? { href: null } : {};

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.success,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: isWide ? 0 : undefined,
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
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
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

const styles = StyleSheet.create({
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
});
