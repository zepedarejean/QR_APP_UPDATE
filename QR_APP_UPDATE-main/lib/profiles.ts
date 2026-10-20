import { supabase } from './supabase';

export type Role = 'student' | 'teacher' | 'admin';

// ---------------------------------------------------------------------------
// Student registration options
// ---------------------------------------------------------------------------
export const DEPARTMENTS = [
  'BSIT',
  'BSHM',
  'BPED',
  'BSENTREP',
  'BEED',
  'BSED',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  BSIT: 'BS Information Technology',
  BSHM: 'BS Hospitality Management',
  BPED: 'Bachelor of Physical Education',
  BSENTREP: 'BS Entrepreneurship',
  BEED: 'Bachelor of Elementary Education',
  BSED: 'Bachelor of Secondary Education',
};

export const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'] as const;

export const BLOCKS = [
  'Block A',
  'Block B',
  'Block C',
  'Block D',
  'Block E',
  'Block F',
] as const;

export const OFFICER_POSITIONS = [
  'Mayor',
  'Vice Mayor',
  'Secretary',
  'Asst. Secretary',
  'Treasurer',
  'Asst. Treasurer',
  'Auditor',
  'P.I.O',
] as const;

/** Only offered to BSIT students. */
export const BSIT_SKILLS = [
  'Programmer',
  'UI/UX Designer',
  'Frontend Developer',
  'Backend Developer',
  'Mobile App Developer',
  'Database Administrator',
  'Network Administrator',
  'QA / Software Tester',
  'DevOps Engineer',
  'Graphic Designer',
  'Cybersecurity Analyst',
  'Technical Writer',
] as const;

export const BIO_MAX_WORDS = 60;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  student_id?: string | null;
  course?: string | null;
  year_level?: string | null;
  section?: string | null;
  department?: string | null;
  block?: string | null;
  is_class_officer?: boolean | null;
  officer_position?: string | null;
  skills?: string[] | null;
  bio?: string | null;
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
  department: string | null;
  block: string | null;
  is_class_officer: boolean;
  officer_position: string | null;
  skills: string[];
  bio: string | null;
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

// ---------------------------------------------------------------------------
// Directory lookups (chat + analytics)
// ---------------------------------------------------------------------------
export type DirectoryEntry = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role;
  avatar_url?: string | null;
  department?: string | null;
  year_level?: string | null;
  block?: string | null;
};

const DIRECTORY_COLUMNS =
  'id, full_name, email, role, avatar_url, department, year_level, block';

/** Search the people the given user is allowed to start a chat with. */
export async function searchPeople(
  viewerRole: Role,
  viewerId: string,
  query = ''
): Promise<DirectoryEntry[]> {
  const q = query.trim().toLowerCase();

  let builder = supabase
    .from('profiles')
    .select(DIRECTORY_COLUMNS)
    .neq('id', viewerId);

  if (viewerRole === 'student') {
    // Students can reach out to teachers and admins.
    builder = builder.in('role', ['teacher', 'admin']);
  } else if (viewerRole === 'teacher') {
    // Teachers can reach out to admins and their students.
    builder = builder.in('role', ['admin', 'student']);
  }
  // Admins can reach everybody.

  const { data, error } = await builder.order('full_name').limit(200);
  if (error || !data) return [];

  let list = data as DirectoryEntry[];
  if (q) {
    list = list.filter(
      (p) =>
        (p.full_name ?? '').toLowerCase().includes(q) ||
        (p.email ?? '').toLowerCase().includes(q) ||
        (p.department ?? '').toLowerCase().includes(q)
    );
  }
  return list;
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
