import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import { RADIUS, SHADOW, SPACING } from '@/constants/theme';
import Badge, { type BadgeTone } from '@/components/ui/Badge';
import { formatDateShort, formatTime, getEventPhase } from '@/lib/format';
import type { CloudEvent } from '@/lib/events';

type EventCardProps = {
  event: Pick<
    CloudEvent,
    'title' | 'subject' | 'room' | 'start_time' | 'end_time' | 'status'
  >;
  actionLabel?: string;
  onPress?: () => void;
  right?: React.ReactNode;
};

const phaseMeta: Record<
  ReturnType<typeof getEventPhase>,
  { label: string; tone: BadgeTone }
> = {
  upcoming: { label: 'Upcoming', tone: 'info' },
  live: { label: 'Live now', tone: 'success' },
  ended: { label: 'Ended', tone: 'neutral' },
  closed: { label: 'Closed', tone: 'danger' },
};

export default function EventCard({ event, onPress, right }: EventCardProps) {
  const phase = getEventPhase(event);
  const meta = phaseMeta[phase];
  const dateLabel = event.start_time ?? event.end_time;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          {event.subject ? (
            <Text style={styles.subject} numberOfLines={1}>
              {event.subject}
            </Text>
          ) : null}
        </View>
        <Badge label={meta.label} tone={meta.tone} small />
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
        <Text style={styles.meta}>{formatDateShort(dateLabel)}</Text>
        {event.start_time || event.end_time ? (
          <Text style={styles.metaDot}>·</Text>
        ) : null}
        {event.start_time ? (
          <Text style={styles.meta}>
            {formatTime(event.start_time)}
            {event.end_time ? ` – ${formatTime(event.end_time)}` : ''}
          </Text>
        ) : null}
      </View>

      {event.room ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.meta}>{event.room}</Text>
        </View>
      ) : null}

      {right ? <View style={styles.right}>{right}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 8,
    ...SHADOW.card,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.995 }],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subject: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  metaDot: {
    fontSize: 13,
    color: COLORS.muted,
  },
  right: {
    marginTop: SPACING.sm,
  },
});
