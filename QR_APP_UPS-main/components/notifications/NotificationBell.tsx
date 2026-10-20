import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getUnreadCount } from '@/lib/notifications';

export default function NotificationBell() {
  const router = useRouter();
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    if (!user) return;
    getUnreadCount(user.id)
      .then(setCount)
      .catch(() => setCount(0));
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 45000);
      return () => clearInterval(interval);
    }, [load])
  );

  return (
    <Pressable
      style={styles.button}
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      accessibilityLabel={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
    >
      <Ionicons name="notifications-outline" size={22} color={COLORS.textPrimary} />
      {count > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
