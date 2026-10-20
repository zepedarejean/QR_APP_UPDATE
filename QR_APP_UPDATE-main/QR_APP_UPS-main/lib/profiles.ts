import { supabase } from './supabase';

export type Role = 'student' | 'teacher';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  student_id?: string | null;
  course?: string | null;
  year_level?: string | null;
  section?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
};

export type ProfileUpdate = Partial<{
  full_name: string;
  role: Role;
  student_id: string | null;
  course: string | null;
  year_level: string | null;
  section: string | null;
  avatar_url: string | null;
}>;

export function isMissingColumn(error: { code?: string; message?: string }) {
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    /column/i.test(error.message ?? '')
  );
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<{ error: string | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row: Record<string, unknown> = { id: userId, ...updates };
  if (user?.email) {
    row.email = user.email;
  }

  let { error } = await supabase.from('profiles').upsert(row, {
    onConflict: 'id',
  });

  if (error && isMissingColumn(error)) {
    const safe: Record<string, unknown> = { id: userId };
    if (user?.email) safe.email = user.email;
    if (updates.full_name !== undefined) safe.full_name = updates.full_name;
    if (updates.role !== undefined) safe.role = updates.role;
    ({ error } = await supabase.from('profiles').upsert(safe, {
      onConflict: 'id',
    }));
  }

  return { error: error?.message ?? null };
}

function extensionOf(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)(\?.*)?$/.exec(uri);
  return match ? match[1].toLowerCase() : 'jpg';
}

const ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

export async function uploadAvatar(
  userId: string,
  uri: string
): Promise<{ url: string | null; error: string | null }> {
  const ext = extensionOf(uri);
  const safeExt = ALLOWED.includes(ext) ? ext : 'jpg';
  const contentType = safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg';
  const path = `${userId}/avatar-${Date.now()}.${safeExt}`;

  const form = new FormData();
  form.append('file', {
    uri,
    name: `avatar.${safeExt}`,
    type: contentType,
  } as unknown as Blob);

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, form, { contentType, upsert: true });

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
