import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import AppButton from '@/components/AppButton';
import AppInput from '@/components/ui/AppInput';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { PickerField, PickerSheet } from '@/components/ui/PickerSheet';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import {
  updateProfile,
  uploadAvatar,
  BIO_MAX_WORDS,
  BLOCKS,
  BSIT_SKILLS,
  countWords,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  OFFICER_POSITIONS,
  YEAR_LEVELS,
  type Department,
  type Profile,
} from '@/lib/profiles';
import {
  getAttendanceHistory,
  getStudentAttendanceSummary,
  type AttendanceRecord,
} from '@/lib/attendance';
import { getTeacherDashboard } from '@/lib/dashboard';
import {
  formatLateBy,
  formatDate,
  scanToneFor,
  scanToneLabel,
  type AttendanceEvaluation,
} from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import ScreenHeader from '@/components/ui/ScreenHeader';
import NotificationBell from '@/components/notifications/NotificationBell';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import AttendanceSummaryCard from '@/components/dashboard/AttendanceSummaryCard';
import SectionHeader from '@/components/ui/SectionHeader';
import { SkeletonCard } from '@/components/ui/Skeleton';

export default function ProfileScreen() {
  const COLORS = useColors();
  const styles = useStyles();
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
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [eventCount, setEventCount] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user || !profile) return;
    if (profile.role === 'teacher' || profile.role === 'admin') {
      const stats = await getTeacherDashboard(user.id);
      setEventCount(stats.totalEvents);
      setSummary(null);
      setHistory([]);
    } else {
      const [stats, records] = await Promise.all([
        getStudentAttendanceSummary(user.id),
        getAttendanceHistory(user.id, 5),
      ]);
      setSummary(stats);
      setHistory(records);
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

  const ended = summary?.endedEvents ?? 0;
  const attended = summary?.attendedEnded ?? 0;
  const rate = ended > 0 ? Math.round((attended / ended) * 100) : null;
  const roleLabel =
    profile?.role === 'admin' ? 'Admin' : profile?.role === 'teacher' ? 'Teacher' : 'Student';
  const bio = profile?.bio?.trim() ?? '';
  const skills = profile?.skills ?? [];

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="My Profile"
        subtitle="Your account and attendance summary"
        right={
          <>
            <NotificationBell />
            <Pressable
              style={styles.headerBtn}
              onPress={() => router.push('/settings')}
              hitSlop={8}
              accessibilityLabel="Open settings"
            >
              <Ionicons name="settings-outline" size={18} color={COLORS.textPrimary} />
            </Pressable>
          </>
        }
      />

      {loading ? (
        <ScrollView contentContainerStyle={styles.content}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
        </ScrollView>
      ) : !profile ? (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.errorCard}>
            <Ionicons
              name="cloud-offline-outline"
              size={34}
              color={COLORS.textSecondary}
            />
            <Text style={styles.errorTitle}>Couldn't load your profile</Text>
            <Text style={styles.errorHelp}>
              We couldn't reach your account data. This is usually fixed by
              retrying — if it keeps happening, sign out and back in.
            </Text>
            <AppButton
              variant="secondary"
              title="Try again"
              icon="refresh"
              onPress={() => refresh()}
            />
          </View>
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
                  <ActivityIndicator size="small" color={COLORS.textOnPrimary} />
                ) : (
                  <Ionicons name="camera" size={16} color={COLORS.textOnPrimary} />
                )}
              </Pressable>
            </View>

            <Text style={styles.name}>{profile.full_name || 'Add your name'}</Text>
            <Text style={styles.email}>{profile.email ?? user?.email}</Text>
            <Badge
              label={roleLabel}
              tone={
                profile.role === 'admin'
                  ? 'warning'
                  : profile.role === 'teacher'
                    ? 'info'
                    : 'success'
              }
              icon={
                profile.role === 'student'
                  ? 'school-outline'
                  : profile.role === 'admin'
                    ? 'shield-checkmark-outline'
                    : 'clipboard-outline'
              }
            />

            {profile.role === 'student' ? (
              <View style={styles.groupRow}>
                {profile.department ? (
                  <Badge label={profile.department} tone="neutral" small />
                ) : null}
                {profile.year_level ? (
                  <Badge label={profile.year_level} tone="neutral" small />
                ) : null}
                {profile.block ? (
                  <Badge label={profile.block} tone="neutral" small />
                ) : null}
                {profile.is_class_officer && profile.officer_position ? (
                  <Badge label={profile.officer_position} tone="info" small icon="star-outline" />
                ) : null}
              </View>
            ) : null}

            {bio ? (
              <Text style={styles.bio}>{bio}</Text>
            ) : profile.role === 'student' ? (
              <Text style={styles.bioMuted}>No bio yet — tap Edit Profile to add one.</Text>
            ) : null}

            {skills.length > 0 ? (
              <View style={styles.skillsWrap}>
                <Text style={styles.skillsLabel}>Skills</Text>
                <View style={styles.skillsRow}>
                  {skills.map((skill) => (
                    <Chip key={skill} label={skill} small selected />
                  ))}
                </View>
              </View>
            ) : null}

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

          <SectionHeader
            title={
              profile.role === 'student' ? 'Attendance summary' : 'Teaching'
            }
          />
          {profile.role === 'student' ? (
            <>
              <AttendanceSummaryCard
                rate={rate}
                attended={attended}
                ended={ended}
                onTime={summary?.present ?? 0}
                late={summary?.late ?? 0}
                absent={summary?.absent ?? 0}
                scans={summary?.totalRecords ?? 0}
              />

              <SectionHeader
                title="Recent attendance"
                actionLabel="View all"
                onAction={() => router.push('/history')}
              />
              {history.length === 0 ? (
                <Text style={styles.emptyText}>
                  Your color-coded attendance history will appear here.
                </Text>
              ) : (
                <View style={styles.historyCard}>
                  {history.map((record) => {
                    const isAbsent = record.status === 'absent';
                    const evaluation: AttendanceEvaluation = {
                      status: record.status === 'late' ? 'late' : 'present',
                      lateBySeconds: record.lateBySeconds ?? 0,
                      almostLate: !!record.almostLate,
                      secondsToLate: 0,
                    };
                    const tone = isAbsent ? 'danger' : scanToneFor(evaluation);
                    const toneColor =
                      tone === 'danger'
                        ? COLORS.danger
                        : tone === 'info'
                          ? COLORS.info
                          : COLORS.success;
                    const toneSoft =
                      tone === 'danger'
                        ? COLORS.dangerSoft
                        : tone === 'info'
                          ? COLORS.infoSoft
                          : COLORS.successSoft;
                    return (
                      <Pressable
                        key={record.id}
                        style={({ pressed }) => [
                          styles.historyRow,
                          pressed && { opacity: 0.75 },
                        ]}
                        onPress={() =>
                          router.push(
                            `/event/${record.eventUuid ?? record.eventId}`
                          )
                        }
                      >
                        <View
                          style={[
                            styles.historyDot,
                            { backgroundColor: toneColor },
                          ]}
                        />
                        <View style={styles.historyText}>
                          <Text style={styles.historyTitle} numberOfLines={1}>
                            {record.eventTitle || record.eventId}
                          </Text>
                          <Text style={styles.historyMeta}>
                            {isAbsent
                              ? `Missed · ${formatDate(record.scannedAt)}`
                              : formatDate(record.scannedAt)}
                            {!isAbsent && record.lateBySeconds
                              ? ` · ${formatLateBy(record.lateBySeconds)}`
                              : ''}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.historyPill,
                            { backgroundColor: toneSoft, borderColor: toneColor },
                          ]}
                        >
                          <Text
                            style={[styles.historyPillText, { color: toneColor }]}
                          >
                            {isAbsent ? 'Absent' : scanToneLabel(evaluation)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </>
          ) : (
            <View style={styles.statRow}>
              <StatCard
                label="Events created"
                value={eventCount ?? '—'}
                icon="clipboard-outline"
              />
            </View>
          )}
        </ScrollView>
      )}

      <EditProfileModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
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

type EditForm = {
  full_name: string;
  student_id: string;
  department: string | null;
  year_level: string | null;
  block: string | null;
  is_class_officer: boolean;
  officer_position: string | null;
  skills: string[];
  bio: string;
};

function EditProfileModal({
  visible,
  onClose,
  profile,
  userId,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  profile: Profile | null;
  userId?: string;
  onSaved: () => void;
}) {
  const COLORS = useColors();
  const styles = useStyles();
  const [form, setForm] = useState<EditForm>({
    full_name: profile?.full_name ?? '',
    student_id: profile?.student_id ?? '',
    department: profile?.department ?? null,
    year_level: profile?.year_level ?? null,
    block: profile?.block ?? null,
    is_class_officer: !!profile?.is_class_officer,
    officer_position: profile?.officer_position ?? null,
    skills: profile?.skills ?? [],
    bio: profile?.bio ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deptPickerOpen, setDeptPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);

  // Keep the form in sync when the profile loads after mount.
  const profileId = profile?.id;
  useEffect(() => {
    if (profile && visible) {
      setForm({
        full_name: profile.full_name ?? '',
        student_id: profile.student_id ?? '',
        department: profile.department ?? null,
        year_level: profile.year_level ?? null,
        block: profile.block ?? null,
        is_class_officer: !!profile.is_class_officer,
        officer_position: profile.officer_position ?? null,
        skills: profile.skills ?? [],
        bio: profile.bio ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, visible]);

  const bioWords = countWords(form.bio);
  const bioTooLong = bioWords > BIO_MAX_WORDS;
  const showSkills = form.department === 'BSIT';

  const set = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!userId) return;
    if (!form.full_name.trim()) {
      setError('Full name is required.');
      return;
    }
    if (bioTooLong) {
      setError(`Your bio is ${bioWords} words — the limit is ${BIO_MAX_WORDS}.`);
      return;
    }
    setSaving(true);
    const { error: saveError } = await updateProfile(userId, {
      full_name: form.full_name.trim(),
      student_id: form.student_id.trim() || null,
      // Department IS the course — keep the readable label in sync so old
      // rows that still show `course` don't go stale.
      course: form.department
        ? DEPARTMENT_LABELS[form.department as Department] ?? form.department
        : null,
      department: form.department,
      year_level: form.year_level,
      block: form.block,
      section: form.block
        ? form.block.replace(/^Block\s*/i, '') || form.block
        : null,
      is_class_officer: form.is_class_officer,
      officer_position: form.is_class_officer ? form.officer_position : null,
      skills: showSkills ? form.skills : [],
      bio: form.bio.trim() || null,
    });
    setSaving(false);
    if (saveError) {
      setError(
        /column|schema/i.test(saveError)
          ? 'Run supabase/migrations/0003_admin_chat_approval.sql in Supabase first.'
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
                set('full_name', v);
                setError(null);
              }}
              placeholder="Juan Dela Cruz"
            />
            <AppInput
              label={profile?.role === 'teacher' ? 'Employee ID' : 'Student ID'}
              icon="barcode-outline"
              value={form.student_id}
              onChangeText={(v) => set('student_id', v)}
              placeholder="2024-001"
              autoCapitalize="characters"
            />

            {profile?.role === 'student' ? (
              <>
                <PickerField
                  label="Department"
                  value={form.department}
                  placeholder="Select Department"
                  icon="business-outline"
                  hint={
                    form.department
                      ? DEPARTMENT_LABELS[form.department as Department]
                      : null
                  }
                  onPress={() => setDeptPickerOpen(true)}
                />
                <PickerField
                  label="Year level"
                  value={form.year_level}
                  placeholder="Select Year Level"
                  icon="calendar-outline"
                  onPress={() => setYearPickerOpen(true)}
                />
                <PickerField
                  label="Block"
                  value={form.block}
                  placeholder="Select Block"
                  icon="grid-outline"
                  onPress={() => setBlockPickerOpen(true)}
                />

                <View style={styles.switchRow}>
                  <View style={styles.switchText}>
                    <Text style={styles.switchLabel}>Class officer</Text>
                    <Text style={styles.switchCaption}>
                      Turn this on if you hold a position in your class.
                    </Text>
                  </View>
                  <Switch
                    value={form.is_class_officer}
                    onValueChange={(v) => {
                      set('is_class_officer', v);
                      if (!v) set('officer_position', null);
                    }}
                    trackColor={{ true: COLORS.primary, false: COLORS.border }}
                    thumbColor={COLORS.card}
                  />
                </View>
                {form.is_class_officer ? (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Position</Text>
                    <ChipGroup
                      options={OFFICER_POSITIONS}
                      value={form.officer_position}
                      columns={2}
                      onChange={(v: string) => set('officer_position', v)}
                    />
                  </View>
                ) : null}

                {showSkills ? (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Skills (BSIT)</Text>
                    <ChipGroup
                      small
                      multiple
                      options={BSIT_SKILLS}
                      value={form.skills}
                      onChange={(v: string[]) => set('skills', v)}
                    />
                  </View>
                ) : null}

                <View style={styles.fieldBlock}>
                  <View style={styles.bioHeader}>
                    <Text style={styles.fieldLabel}>Bio note</Text>
                    <Text
                      style={[
                        styles.bioCount,
                        bioTooLong && { color: COLORS.danger },
                      ]}
                    >
                      {bioWords}/{BIO_MAX_WORDS} words
                    </Text>
                  </View>
                  <TextInput
                    style={[styles.bioInput, bioTooLong && { borderColor: COLORS.danger }]}
                    value={form.bio}
                    onChangeText={(v) => set('bio', v)}
                    placeholder="A short note about yourself — hobbies, goals, or what you bring to the team."
                    placeholderTextColor={COLORS.muted}
                    multiline
                    maxLength={600}
                  />
                </View>
              </>
            ) : null}

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

          <PickerSheet
            visible={deptPickerOpen}
            title="Select Department"
            options={DEPARTMENTS}
            value={form.department}
            descriptions={DEPARTMENT_LABELS}
            onSelect={(v) => {
              set('department', v);
              if (v !== 'BSIT') set('skills', []);
            }}
            onClose={() => setDeptPickerOpen(false)}
          />
          <PickerSheet
            visible={yearPickerOpen}
            title="Select Year Level"
            options={YEAR_LEVELS}
            value={form.year_level}
            onSelect={(v) => set('year_level', v)}
            onClose={() => setYearPickerOpen(false)}
          />
          <PickerSheet
            visible={blockPickerOpen}
            title="Select Block"
            options={BLOCKS}
            value={form.block}
            onSelect={(v) => set('block', v)}
            onClose={() => setBlockPickerOpen(false)}
          />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
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
    groupRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'center',
      marginTop: 2,
    },
    bio: {
      fontSize: 13.5,
      color: COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 19,
      marginTop: 6,
      maxWidth: 460,
    },
    bioMuted: {
      fontSize: 12.5,
      color: COLORS.muted,
      fontStyle: 'italic',
      marginTop: 4,
    },
    skillsWrap: {
      marginTop: 8,
      width: '100%',
      gap: 6,
      alignItems: 'center',
    },
    skillsLabel: {
      fontSize: 11,
      fontWeight: '800',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    skillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'center',
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
    errorCard: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.xl,
      alignItems: 'center',
      gap: SPACING.sm,
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: COLORS.textPrimary,
      marginTop: SPACING.xs,
    },
    errorHelp: {
      fontSize: 13,
      lineHeight: 19,
      color: COLORS.textSecondary,
      textAlign: 'center',
      marginBottom: SPACING.sm,
    },
    headerBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: COLORS.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statRow: {
      flexDirection: 'row',
      gap: SPACING.md,
      marginTop: SPACING.sm,
    },
    emptyText: {
      fontSize: 13,
      color: COLORS.muted,
      textAlign: 'center',
      paddingVertical: SPACING.md,
    },
    historyCard: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: SPACING.lg,
      marginTop: SPACING.sm,
    },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    historyDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    historyText: {
      flex: 1,
      gap: 2,
    },
    historyTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    historyMeta: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    historyPill: {
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    historyPillText: {
      fontSize: 11,
      fontWeight: '800',
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
    fieldBlock: {
      gap: 8,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
    },
    switchText: {
      flex: 1,
      gap: 2,
    },
    switchLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    switchCaption: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    bioHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    bioCount: {
      fontSize: 11.5,
      fontWeight: '700',
      color: COLORS.muted,
    },
    bioInput: {
      backgroundColor: COLORS.inputBackground,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      color: COLORS.textPrimary,
      fontSize: 14,
      minHeight: 90,
      padding: SPACING.md,
      textAlignVertical: 'top',
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
  })
);
