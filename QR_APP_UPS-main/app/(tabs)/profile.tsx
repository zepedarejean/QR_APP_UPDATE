import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import AppButton from '@/components/AppButton';
import AppInput from '@/components/ui/AppInput';
import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuth, signOut } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import { updateProfile, uploadAvatar } from '@/lib/profiles';
import { getStudentAttendanceSummary } from '@/lib/attendance';
import { getTeacherDashboard } from '@/lib/dashboard';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import ScreenHeader from '@/components/ui/ScreenHeader';
import NotificationBell from '@/components/notifications/NotificationBell';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import SectionHeader from '@/components/ui/SectionHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { profile, loading, refresh } = useProfile(user?.id);

  const [summary, setSummary] = useState<{
    present: number;
    late: number;
    absent: number;
    endedEvents: number;
    attendedEnded: number;
    totalRecords: number;
  } | null>(null);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user || !profile) return;
    if (profile.role === 'teacher') {
      const stats = await getTeacherDashboard(user.id);
      setEventCount(stats.totalEvents);
      setSummary(null);
    } else {
      const stats = await getStudentAttendanceSummary(user.id);
      setSummary(stats);
      setEventCount(null);
    }
  }, [user, profile]);

  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const handleChangePhoto = async () => {
    if (!user) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.show('Photo library permission is required to change your picture.', 'error');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      setUploading(true);
      const { url, error } = await uploadAvatar(user.id, result.assets[0].uri);
      if (error || !url) {
        toast.show(
          error?.includes('bucket') || error?.includes('not found')
            ? 'Profile uploads are not configured yet. Run supabase/migrations/0002_upgrade.sql.'
            : 'Could not upload the picture. Please try again.',
          'error'
        );
      } else {
        const { error: saveError } = await updateProfile(user.id, {
          avatar_url: url,
        });
        if (saveError) {
          toast.show('Picture uploaded but could not be saved.', 'error');
        } else {
          await refresh();
          toast.show('Profile picture updated.', 'success');
        }
      }
    } catch {
      toast.show('Could not open the photo library.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch {
      toast.show('Failed to sign out.', 'error');
    } finally {
      setSigningOut(false);
    }
  };

  const ended = summary?.endedEvents ?? 0;
  const attended = summary?.attendedEnded ?? 0;
  const rate = ended > 0 ? Math.round((attended / ended) * 100) : null;

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="My Profile"
        subtitle="Your account and attendance summary"
        right={<NotificationBell />}
      />

      {loading || !profile ? (
        <ScrollView contentContainerStyle={styles.content}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              <Avatar
                name={profile.full_name ?? user?.email}
                uri={profile.avatar_url}
                size={92}
              />
              <Pressable
                style={styles.cameraBtn}
                onPress={handleChangePhoto}
                disabled={uploading}
                hitSlop={8}
                accessibilityLabel="Change profile picture"
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#04140D" />
                ) : (
                  <Ionicons name="camera" size={16} color="#04140D" />
                )}
              </Pressable>
            </View>

            <Text style={styles.name}>{profile.full_name || 'Add your name'}</Text>
            <Text style={styles.email}>{profile.email ?? user?.email}</Text>
            <Badge
              label={profile.role === 'teacher' ? 'Teacher' : 'Student'}
              tone={profile.role === 'teacher' ? 'info' : 'success'}
              icon={profile.role === 'teacher' ? 'clipboard-outline' : 'school-outline'}
            />

            <View style={styles.editButtonRow}>
              <AppButton
                variant="secondary"
                size="sm"
                title="Edit Profile"
                icon="create-outline"
                onPress={() => setEditOpen(true)}
              />
            </View>
          </View>

          <SectionHeader title="Account details" />
          <View style={styles.detailsCard}>
            <DetailRow label="Full name" value={profile.full_name || '—'} />
            <DetailRow label="Email" value={profile.email ?? user?.email ?? '—'} />
            <DetailRow
              label={profile.role === 'teacher' ? 'Employee ID' : 'Student ID'}
              value={profile.student_id || '—'}
            />
            <DetailRow label="Course / Program" value={profile.course || '—'} />
            <DetailRow label="Year level" value={profile.year_level || '—'} />
            <DetailRow label="Section" value={profile.section || '—'} />
            <DetailRow
              label="Account type"
              value={profile.role === 'teacher' ? 'Teacher' : 'Student'}
            />
            <DetailRow
              label="Date joined"
              value={formatDate(profile.created_at ?? user?.created_at)}
            />
          </View>

          <SectionHeader title={profile.role === 'teacher' ? 'Teaching' : 'Attendance summary'} />
          {profile.role === 'teacher' ? (
            <View style={styles.statRow}>
              <StatCard
                label="Events created"
                value={eventCount ?? '—'}
                icon="clipboard-outline"
              />
            </View>
          ) : (
            <View style={styles.statRow}>
              <StatCard
                label="Attendance rate"
                value={rate !== null ? `${rate}%` : '—'}
                icon="trending-up-outline"
              />
              <StatCard
                label="Present"
                value={summary?.present ?? 0}
                icon="checkmark-circle-outline"
                tone="info"
              />
              <StatCard
                label="Late"
                value={summary?.late ?? 0}
                icon="time-outline"
                tone="warning"
              />
            </View>
          )}
          {profile.role === 'student' ? (
            <View style={styles.statRow}>
              <StatCard
                label="Absent"
                value={summary?.absent ?? 0}
                icon="close-circle-outline"
                tone="danger"
              />
              <StatCard
                label="Total events"
                value={summary?.endedEvents ?? 0}
                icon="calendar-outline"
                tone="neutral"
              />
              <StatCard
                label="Scans"
                value={summary?.totalRecords ?? 0}
                icon="scan-outline"
                tone="neutral"
              />
            </View>
          ) : null}

          <View style={styles.signOutBox}>
            <AppButton
              variant="danger"
              title="Sign Out"
              icon="log-out-outline"
              onPress={handleSignOut}
              loading={signingOut}
            />
          </View>
        </ScrollView>
      )}

      <EditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        defaults={{
          full_name: profile?.full_name ?? '',
          student_id: profile?.student_id ?? '',
          course: profile?.course ?? '',
          year_level: profile?.year_level ?? '',
          section: profile?.section ?? '',
        }}
        userId={user?.id}
        onSaved={() => {
          setEditOpen(false);
          refresh();
          toast.show('Profile updated.', 'success');
        }}
      />
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

type EditDefaults = {
  full_name: string;
  student_id: string;
  course: string;
  year_level: string;
  section: string;
};

function EditProfileModal({
  visible,
  onClose,
  defaults,
  userId,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  defaults: EditDefaults;
  userId?: string;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<EditDefaults>(defaults);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof EditDefaults) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!userId) return;
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    setSaving(true);
    const { error: saveError } = await updateProfile(userId, {
      full_name: form.full_name.trim(),
      student_id: form.student_id.trim() || null,
      course: form.course.trim() || null,
      year_level: form.year_level.trim() || null,
      section: form.section.trim() || null,
    });
    setSaving(false);
    if (saveError) {
      setError(
        /column|schema/i.test(saveError)
          ? 'Run supabase/migrations/0002_upgrade.sql in Supabase first.'
          : 'Could not save your profile. Please try again.'
      );
      return;
    }
    setError(null);
    onSaved();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalForm}
          >
            <AppInput
              label="Full Name"
              icon="person-outline"
              value={form.full_name}
              onChangeText={(v) => {
                set('full_name')(v);
                setError(null);
              }}
              placeholder="Juan Dela Cruz"
            />
            <AppInput
              label="Student ID"
              icon="barcode-outline"
              value={form.student_id}
              onChangeText={set('student_id')}
              placeholder="2024-001"
              autoCapitalize="characters"
            />
            <AppInput
              label="Course / Program"
              icon="book-outline"
              value={form.course}
              onChangeText={set('course')}
              placeholder="BS Information Technology"
            />
            <View style={styles.rowPair}>
              <View style={styles.half}>
                <AppInput
                  label="Year Level"
                  icon="calendar-outline"
                  value={form.year_level}
                  onChangeText={set('year_level')}
                  placeholder="3rd Year"
                />
              </View>
              <View style={styles.half}>
                <AppInput
                  label="Section"
                  icon="grid-outline"
                  value={form.section}
                  onChangeText={set('section')}
                  placeholder="A"
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <AppButton
              variant="primary"
              size="lg"
              title="Save Changes"
              icon="checkmark-outline"
              onPress={handleSave}
              loading={saving}
            />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 120,
    gap: SPACING.sm,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: 8,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: 6,
  },
  cameraBtn: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  email: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  editButtonRow: {
    marginTop: SPACING.sm,
    width: '100%',
    maxWidth: 220,
  },
  detailsCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  statRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  signOutBox: {
    marginTop: SPACING.xxl,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: '92%',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalForm: {
    gap: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  rowPair: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  half: {
    flex: 1,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.danger,
    padding: SPACING.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '600',
  },
});
