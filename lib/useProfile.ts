import { useCallback, useEffect, useState } from 'react';
import { getProfile, type Profile } from './profiles';

let cached: { userId: string; profile: Profile | null } | null = null;
const listeners = new Set<(profile: Profile | null) => void>();

function notify() {
  const value = cached?.profile ?? null;
  listeners.forEach((l) => l(value));
}

export async function loadProfile(
  userId: string,
  force = false
): Promise<Profile | null> {
  if (!force && cached && cached.userId === userId) {
    return cached.profile;
  }
  const profile = await getProfile(userId);
  cached = { userId, profile };
  notify();
  return profile;
}

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(
    () => (cached && userId && cached.userId === userId ? cached.profile : null)
  );
  const [loading, setLoading] = useState<boolean>(
    () => !(cached && userId && cached.userId === userId)
  );

  useEffect(() => {
    const listener = (value: Profile | null) => setProfile(value);
    listeners.add(listener);

    if (!userId) {
      setProfile(null);
      setLoading(false);
      return () => {
        listeners.delete(listener);
      };
    }

    setLoading(true);
    loadProfile(userId).finally(() => setLoading(false));

    return () => {
      listeners.delete(listener);
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return null;
    setLoading(true);
    try {
      const next = await loadProfile(userId, true);
      return next;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    profile,
    role: profile?.role ?? null,
    loading,
    refresh,
  };
}
