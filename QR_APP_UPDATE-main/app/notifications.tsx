import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import {
  getNotifications,
  markAllRead,
  markNotificationRead,
  type AppNotification,
} from '@/lib/notifications';
import { timeAgo } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import ScreenHeader from '@/components/ui/ScreenHeader';
import EmptyState from '@/components/ui/EmptyState';

const typeIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  attendance: 'checkmark-circle-outline',
  reminder: 'alarm-outline',
  info: 'information-circle-outline',
};

export default function NotificationsScreen() {
  const COLORS = useColors();
  const styles = useStyles();
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const list = await getNotifications(user.id);
    setItems(list);
    setLoading(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const unread = items.filter((n) => !n.read).length;

  const handleOpen = async (item: AppNotification) => {
    if (!item.read) {
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
      markNotificationRead(item.id);
    }
    if (item.event_id) router.push(`/event/${item.event_id}`);
  };

  const handleMarkAll = async () => {
    if (!user || unread === 0) return;
    setBusy(true);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    const { error } = await markAllRead(user.id);
    setBusy(false);
    if (error) toast.show('Could not update notifications.', 'error');
  };

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'You are all caught up'}
        showBack
      />

      <ScrollView contentContainerStyle={styles.content}>
        {items.length > 0 ? (
          <Pressable
            style={styles.markAll}
            onPress={handleMarkAll}
            disabled={busy || unread === 0}
          >
            {busy ? (
              <ActivityIndicator size="small" color={COLORS.accent} />
            ) : (
              <Ionicons
                name="checkmark-done-outline"
                size={16}
                color={unread === 0 ? COLORS.muted : COLORS.accent}
              />
            )}
            <Text
              style={[
                styles.markAllText,
                unread === 0 && { color: COLORS.muted },
              ]}
            >
              Mark all as read
            </Text>
          </Pressable>
        ) : null}

        {loading ? (
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            style={{ marginTop: SPACING.xxxl }}
          />
        ) : items.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title="No notifications yet"
            message="Event reminders and attendance confirmations will appear here."
          />
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.card, !item.read && styles.cardUnread]}
                onPress={() => handleOpen(item)}
              >
                <View
                  style={[
                    styles.iconCircle,
                    !item.read && styles.iconCircleUnread,
                  ]}
                >
                  <Ionicons
                    name={typeIcon[item.type] ?? 'notifications-outline'}
                    size={18}
                    color={item.read ? COLORS.muted : COLORS.primary}
                  />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardTop}>
                    <Text style={[styles.cardTitle, !item.read && styles.unreadText]}>
                      {item.title}
                    </Text>
                    <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                  {item.body ? (
                    <Text style={styles.cardMessage}>{item.body}</Text>
                  ) : null}
                </View>
                {!item.read ? <View style={styles.dot} /> : null}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 120,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
    gap: SPACING.md,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
  },
  list: {
    gap: SPACING.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  cardUnread: {
    borderColor: COLORS.cardBorderNeon,
    backgroundColor: COLORS.elevated,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleUnread: {
    backgroundColor: COLORS.infoSoft,
  },
  cardBody: {
    flex: 1,
    gap: 3,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    flex: 1,
  },
  unreadText: {
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  cardTime: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600',
  },
  cardMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
  },
}));
