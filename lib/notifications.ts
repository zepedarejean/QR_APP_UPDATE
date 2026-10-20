import { supabase } from './supabase';
import { getEventsByTeacher, getUpcomingEvents, type CloudEvent } from './events';
import { getProfile } from './profiles';

export type AppNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  event_id: string | null;
  read: boolean;
  created_at: string;
};

export async function getNotifications(
  userId: string,
  limit = 30
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as AppNotification[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error || count === null) return 0;
  return count;
}

export async function markNotificationRead(
  id: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function markAllRead(
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  return { error: error?.message ?? null };
}

type NotificationSeed = {
  user_id: string;
  type: string;
  title: string;
  body: string;
  event_id?: string | null;
  dedupe_key: string;
};

async function seed(notifications: NotificationSeed[]) {
  if (notifications.length === 0) return;
  await supabase.from('notifications').upsert(notifications, {
    onConflict: 'user_id,dedupe_key',
    ignoreDuplicates: true,
  });
}

function withinOneHour(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const diff = t - Date.now();
  return diff > 0 && diff <= 60 * 60 * 1000;
}

function justEnded(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const diff = Date.now() - t;
  return diff >= 0 && diff <= 30 * 60 * 1000;
}

export async function ensureReminders(userId: string): Promise<void> {
  try {
    const profile = await getProfile(userId);
    if (!profile) return;

    if (profile.role === 'teacher') {
      const events = await getEventsByTeacher(userId);
      const seeds: NotificationSeed[] = events
        .filter((e: CloudEvent) => e.status !== 'closed')
        .flatMap((e: CloudEvent) => {
          const list: NotificationSeed[] = [];
          if (withinOneHour(e.start_time)) {
            list.push({
              user_id: userId,
              type: 'reminder',
              title: 'Event starting soon',
              body: `"${e.title}" starts at ${new Date(
                e.start_time as string
              ).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`,
              event_id: e.id,
              dedupe_key: `t-upcoming:${e.id}`,
            });
          }
          if (justEnded(e.end_time)) {
            list.push({
              user_id: userId,
              type: 'reminder',
              title: 'Event has ended',
              body: `"${e.title}" has ended. Review the attendance records.`,
              event_id: e.id,
              dedupe_key: `t-ended:${e.id}`,
            });
          }
          return list;
        });
      await seed(seeds);
      return;
    }

    const events = await getUpcomingEvents(20);
    const seeds: NotificationSeed[] = events
      .filter((e: CloudEvent) => withinOneHour(e.start_time))
      .map((e: CloudEvent) => ({
        user_id: userId,
        type: 'reminder',
        title: 'Upcoming event',
        body: `"${e.title}" starts in less than an hour${
          e.room ? ` at ${e.room}` : ''
        }.`,
        event_id: e.id,
        dedupe_key: `s-upcoming:${e.id}`,
      }));
    await seed(seeds);
  } catch {
    // Notifications are best-effort; never block the dashboard.
  }
}
