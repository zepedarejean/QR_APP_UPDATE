import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import {
  getMessages,
  markConversationRead,
  sendMessage,
  subscribeToConversation,
  MAX_MESSAGE_LENGTH,
  type ChatMessage,
} from '@/lib/chat';
import { getProfile, type Profile } from '@/lib/profiles';
import { formatTime } from '@/lib/format';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';

export default function ChatThreadScreen() {
  const { id: partnerId } = useLocalSearchParams<{ id: string }>();
  const COLORS = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [partner, setPartner] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const myId = user?.id ?? '';

  const refresh = useCallback(async () => {
    if (!myId || !partnerId) return;
    const rows = await getMessages(myId, partnerId);
    setMessages(rows);
    return rows;
  }, [myId, partnerId]);

  useEffect(() => {
    if (!myId || !partnerId) return;
    let mounted = true;
    setLoading(true);

    Promise.all([
      getProfile(partnerId),
      getMessages(myId, partnerId),
    ]).then(([profile, rows]) => {
      if (!mounted) return;
      setPartner(profile);
      setMessages(rows);
      setLoading(false);
      markConversationRead(myId, partnerId).catch(() => {});
    });

    const unsubscribe = subscribeToConversation(myId, partnerId, (message) => {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      );
      if (message.receiver_id === myId) {
        markConversationRead(myId, partnerId).catch(() => {});
      }
    });

    // Polling fallback in case realtime is unavailable.
    const interval = setInterval(() => {
      refresh().catch(() => {});
    }, 12000);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [myId, partnerId, refresh]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !myId || !partnerId || sending) return;
    setSending(true);
    const { error, message } = await sendMessage(myId, partnerId, text);
    setSending(false);
    if (error || !message) return;
    setDraft('');
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  const partnerName = partner?.full_name ?? 'Conversation';

  return (
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <View style={[styles.headerRow, { borderBottomColor: COLORS.border, backgroundColor: COLORS.surface, paddingTop: insets.top + SPACING.md }]}>
        <Avatar name={partnerName} uri={partner?.avatar_url} size={40} />
        <View style={styles.headerText}>
          <Text style={[styles.headerName, { color: COLORS.textPrimary }]} numberOfLines={1}>
            {partnerName}
          </Text>
          {partner ? (
            <Badge
              small
              label={partner.role === 'admin' ? 'Admin' : partner.role === 'teacher' ? 'Teacher' : 'Student'}
              tone={partner.role === 'admin' ? 'danger' : partner.role === 'teacher' ? 'info' : 'success'}
            />
          ) : null}
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={[...messages].reverse()}
            keyExtractor={(item) => item.id}
            inverted
            contentContainerStyle={styles.listContent}
            keyboardDismissMode="interactive"
            renderItem={({ item }) => {
              const mine = item.sender_id === myId;
              return (
                <View
                  style={[
                    styles.bubbleRow,
                    { justifyContent: mine ? 'flex-end' : 'flex-start' },
                  ]}
                >
                  <View
                    style={[
                      styles.bubble,
                      mine
                        ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary }
                        : { backgroundColor: COLORS.card, borderColor: COLORS.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bubbleText,
                        { color: mine ? COLORS.textOnPrimary : COLORS.textPrimary },
                      ]}
                    >
                      {item.body}
                    </Text>
                    <Text
                      style={[
                        styles.bubbleTime,
                        { color: mine ? COLORS.textOnPrimary : COLORS.muted },
                      ]}
                    >
                      {formatTime(item.created_at)}
                      {mine && item.read ? ' · Read' : ''}
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: COLORS.muted }]}>
                  Say hello to {partnerName}!
                </Text>
              </View>
            }
          />
        )}

        <View style={[styles.inputBar, { backgroundColor: COLORS.surface, borderTopColor: COLORS.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border, color: COLORS.textPrimary }]}
            value={draft}
            onChangeText={setDraft}
            placeholder={`Message ${partnerName}...`}
            placeholderTextColor={COLORS.muted}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
          />
          <Pressable
            style={[
              styles.sendBtn,
              { backgroundColor: draft.trim() ? COLORS.primary : COLORS.card, borderColor: draft.trim() ? COLORS.primary : COLORS.border },
            ]}
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            accessibilityLabel="Send message"
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
            ) : (
              <Ionicons name="send" size={18} color={draft.trim() ? COLORS.textOnPrimary : COLORS.muted} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    flex: {
      flex: 1,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingHorizontal: SPACING.xxl,
      paddingTop: SPACING.xxxl + SPACING.sm,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
    },
    headerText: {
      flex: 1,
      gap: 3,
    },
    headerName: {
      fontSize: 17,
      fontWeight: '800',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      paddingHorizontal: SPACING.xxl,
      paddingVertical: SPACING.lg,
      gap: SPACING.sm,
    },
    bubbleRow: {
      flexDirection: 'row',
    },
    bubble: {
      maxWidth: '80%',
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      paddingHorizontal: SPACING.lg,
      paddingVertical: 10,
      gap: 3,
    },
    bubbleText: {
      fontSize: 14.5,
      lineHeight: 20,
    },
    bubbleTime: {
      fontSize: 10,
      fontWeight: '600',
      alignSelf: 'flex-end',
    },
    emptyWrap: {
      paddingTop: 60,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 13,
    },
    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.xxl,
      paddingVertical: SPACING.md,
      paddingBottom: SPACING.xxl,
      borderTopWidth: 1,
    },
    input: {
      flex: 1,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      paddingHorizontal: SPACING.lg,
      paddingTop: 12,
      paddingBottom: 12,
      fontSize: 14.5,
      maxHeight: 120,
    },
    sendBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
  })
);
