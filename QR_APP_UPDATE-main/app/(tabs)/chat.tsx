import { useCallback, useMemo, useState } from 'react';
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

import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import {
  getConversations,
  subscribeToInbox,
  type ChatConversation,
} from '@/lib/chat';
import { searchPeople, type DirectoryEntry } from '@/lib/profiles';
import { timeAgo } from '@/lib/format';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SearchBar from '@/components/ui/SearchBar';
import EmptyState from '@/components/ui/EmptyState';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function ChatScreen() {
  const router = useRouter();
  const COLORS = useColors();
  const styles = useStyles();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const role = profile?.role ?? null;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [convos, people] = await Promise.all([
      getConversations(user.id),
      searchPeople(role ?? 'student', user.id, ''),
    ]);
    setConversations(convos);
    setDirectory(people);
    setLoading(false);
  }, [user, role]);

  useFocusEffect(
    useCallback(() => {
      load();
      if (!user) return;
      const unsubscribe = subscribeToInbox(user.id, () => {
        getConversations(user.id).then(setConversations).catch(() => {});
      });
      return unsubscribe;
    }, [load, user])
  );

  const q = query.trim().toLowerCase();

  const filteredConversations = useMemo(() => {
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
    );
  }, [conversations, q]);

  const peopleResults = useMemo(() => {
    if (!q) return [];
    return directory.filter(
      (p) =>
        (p.full_name ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.department ?? '').toLowerCase().includes(q)
    );
  }, [directory, q]);

  const roleLabel = (r?: string | null) =>
    r === 'admin' ? 'Admin' : r === 'teacher' ? 'Teacher' : 'Student';

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <ScreenHeader
        title="Messages"
        subtitle={
          role === 'student'
            ? 'Reach out to your teachers'
            : role === 'teacher'
              ? 'Chat with the admin and your students'
              : 'Chat with teachers and students'
        }
      />

      <View style={styles.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={
            role === 'student'
              ? 'Search teachers...'
              : 'Search people...'
          }
        />
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={styles.content}>
          <SkeletonCard lines={2} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {q && peopleResults.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: COLORS.textSecondary }]}>
                {role === 'student' ? 'Teachers & admins' : 'People'}
              </Text>
              <View style={styles.list}>
                {peopleResults.map((person) => (
                  <Pressable
                    key={person.id}
                    style={[styles.row, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}
                    onPress={() =>
                      router.push({ pathname: '/chat/[id]', params: { id: person.id } })
                    }
                  >
                    <Avatar name={person.full_name ?? person.email} uri={person.avatar_url} size={44} />
                    <View style={styles.rowText}>
                      <Text style={[styles.rowName, { color: COLORS.textPrimary }]} numberOfLines={1}>
                        {person.full_name ?? 'Unnamed user'}
                      </Text>
                      <Text style={[styles.rowCaption, { color: COLORS.textSecondary }]} numberOfLines={1}>
                        {roleLabel(person.role)}
                        {person.department ? ` · ${person.department}` : ''}
                        {person.year_level ? ` · ${person.year_level}` : ''}
                        {person.block ? ` ${person.block}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.accent} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={[styles.sectionLabel, { color: COLORS.textSecondary }]}>
            {q ? 'Recent chats' : 'Your conversations'}
          </Text>

          {filteredConversations.length === 0 ? (
            <EmptyState
              icon="chatbubbles-outline"
              title={q ? 'No matches' : 'No conversations yet'}
              message={
                q
                  ? 'Try another name.'
                  : role === 'student'
                    ? 'Search for a teacher above to start a conversation.'
                    : 'Search for someone above to start a conversation.'
              }
            />
          ) : (
            <View style={styles.list}>
              {filteredConversations.map((convo) => (
                <Pressable
                  key={convo.partnerId}
                  style={[
                    styles.row,
                    { backgroundColor: COLORS.card, borderColor: COLORS.border },
                    convo.unreadCount > 0 && { borderColor: COLORS.primary },
                  ]}
                  onPress={() =>
                    router.push({ pathname: '/chat/[id]', params: { id: convo.partnerId } })
                  }
                >
                  <Avatar name={convo.name ?? convo.email} uri={convo.avatarUrl} size={44} />
                  <View style={styles.rowText}>
                    <View style={styles.rowTop}>
                      <Text style={[styles.rowName, { color: COLORS.textPrimary }]} numberOfLines={1}>
                        {convo.name ?? convo.email ?? 'Unknown user'}
                      </Text>
                      <Text style={[styles.rowTime, { color: COLORS.muted }]}>
                        {timeAgo(convo.lastAt)}
                      </Text>
                    </View>
                    <View style={styles.rowTop}>
                      <Text
                        style={[
                          styles.rowCaption,
                          { color: convo.unreadCount > 0 ? COLORS.textPrimary : COLORS.textSecondary },
                          convo.unreadCount > 0 && styles.rowPreviewUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {convo.lastMessage ?? 'Say hi!'}
                      </Text>
                      {convo.unreadCount > 0 ? (
                        <View style={[styles.unread, { backgroundColor: COLORS.primary }]}>
                          <Text style={[styles.unreadText, { color: COLORS.textOnPrimary }]}>
                            {convo.unreadCount > 9 ? '9+' : convo.unreadCount}
                          </Text>
                        </View>
                      ) : (
                        <Badge label={roleLabel(convo.role)} small />
                      )}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    searchWrap: {
      paddingHorizontal: SPACING.xxl,
    },
    content: {
      paddingHorizontal: SPACING.xxl,
      paddingBottom: 120,
      gap: SPACING.sm,
      maxWidth: 760,
      width: '100%',
      alignSelf: 'center',
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: SPACING.sm,
    },
    list: {
      gap: SPACING.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.md,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowName: {
      flexShrink: 1,
      fontSize: 15,
      fontWeight: '800',
    },
    rowCaption: {
      flexShrink: 1,
      fontSize: 12.5,
    },
    rowPreviewUnread: {
      fontWeight: '700',
    },
    rowTime: {
      fontSize: 11,
      fontWeight: '600',
    },
    unread: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadText: {
      fontSize: 11,
      fontWeight: '800',
    },
  })
);
