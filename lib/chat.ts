import { supabase } from './supabase';
import type { Role } from './profiles';

export type ChatMessage = {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  read: boolean;
  created_at: string;
};

export type ChatConversation = {
  partnerId: string;
  name: string | null;
  email: string | null;
  role: Role | null;
  avatarUrl: string | null;
  lastMessage: string | null;
  lastAt: string | null;
  unreadCount: number;
};

export const MAX_MESSAGE_LENGTH = 1000;

/** Send a message. Returns the created row or an error message. */
export async function sendMessage(
  senderId: string,
  receiverId: string,
  body: string
): Promise<{ error: string | null; message: ChatMessage | null }> {
  const text = body.trim();
  if (!text) return { error: 'Message cannot be empty.', message: null };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { error: 'Message is too long.', message: null };
  }

  const { data, error } = await supabase
    .from('messages')
    .insert([
      {
        sender_id: senderId,
        receiver_id: receiverId,
        body: text,
      },
    ])
    .select('*')
    .single();

  if (error) return { error: error.message, message: null };
  return { error: null, message: data as ChatMessage };
}

/** Conversation between two users, oldest -> newest. */
export async function getMessages(
  userId: string,
  otherId: string,
  limit = 200
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender_id.eq.${userId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${userId})`
    )
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data as ChatMessage[];
}

/** Mark everything the other person sent to me as read. */
export async function markConversationRead(
  userId: string,
  otherId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('messages')
    .update({ read: true })
    .eq('sender_id', otherId)
    .eq('receiver_id', userId)
    .eq('read', false);
  return { error: error?.message ?? null };
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('read', false);
  if (error || count === null) return 0;
  return count;
}

/**
 * Every person the user has exchanged messages with, plus people the user
 * can still start a conversation with (searchable from the chat screen).
 */
export async function getConversations(
  userId: string,
  limit = 300
): Promise<ChatConversation[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const rows = data as ChatMessage[];
  const map = new Map<string, ChatConversation>();

  rows.forEach((row) => {
    const partnerId = row.sender_id === userId ? row.receiver_id : row.sender_id;
    const existing = map.get(partnerId);
    const mine = row.sender_id === userId;
    if (!existing) {
      map.set(partnerId, {
        partnerId,
        name: null,
        email: null,
        role: null,
        avatarUrl: null,
        lastMessage: row.body,
        lastAt: row.created_at,
        unreadCount: !mine && !row.read ? 1 : 0,
      });
    } else {
      // Rows come newest-first, so only fill the first (latest) message.
      if (!existing.lastAt) {
        existing.lastMessage = row.body;
        existing.lastAt = row.created_at;
      }
      if (!mine && !row.read) existing.unreadCount += 1;
    }
  });

  const ids = [...map.keys()];
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .in('id', ids);
    ((profiles as {
      id: string;
      full_name: string | null;
      email: string | null;
      role: Role;
      avatar_url: string | null;
    }[] | null) ?? []).forEach((p) => {
      const entry = map.get(p.id);
      if (entry) {
        entry.name = p.full_name;
        entry.email = p.email;
        entry.role = p.role;
        entry.avatarUrl = p.avatar_url;
      }
    });
  }

  return [...map.values()].sort((a, b) => {
    const ta = a.lastAt ? new Date(a.lastAt).getTime() : 0;
    const tb = b.lastAt ? new Date(b.lastAt).getTime() : 0;
    return tb - ta;
  });
}

/** Live updates for the chat screen. Returns an unsubscribe function. */
export function subscribeToConversation(
  userId: string,
  otherId: string,
  onMessage: (message: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`chat:${userId}:${otherId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${otherId}`,
      },
      (payload) => onMessage(payload.new as ChatMessage)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Live badge updates (chat + notifications) for the current user. */
export function subscribeToInbox(
  userId: string,
  onActivity: () => void
): () => void {
  const channel = supabase
    .channel(`inbox:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      },
      () => onActivity()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
