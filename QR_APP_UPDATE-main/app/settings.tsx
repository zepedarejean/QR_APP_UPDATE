import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '@/components/AppButton';
import { useColors, makeStyles, useTheme } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { signOut, useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/ui/Toast';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';

export default function SettingsScreen() {
  const COLORS = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const toast = useToast();
  const { isDark, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const roleLabel =
    profile?.role === 'admin' ? 'Admin' : profile?.role === 'teacher' ? 'Teacher' : 'Student';

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

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" subtitle="Account and app preferences" showBack />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.userRow}>
            <Avatar
              name={profile?.full_name ?? user?.email}
              uri={profile?.avatar_url}
              size={52}
            />
            <View style={styles.userText}>
              <Text style={styles.userName} numberOfLines={1}>
                {profile?.full_name ?? 'QR Attendance user'}
              </Text>
              <Text style={styles.userEmail} numberOfLines={1}>
                {user?.email ?? '—'}
              </Text>
            </View>
            <Badge
              label={roleLabel}
              tone={
                profile?.role === 'admin'
                  ? 'warning'
                  : profile?.role === 'teacher'
                    ? 'info'
                    : 'success'
              }
              small
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Account details</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Full name</Text>
            <Text style={styles.aboutValue} numberOfLines={1}>
              {profile?.full_name || '—'}
            </Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Email</Text>
            <Text style={styles.aboutValue} numberOfLines={1}>
              {profile?.email ?? user?.email ?? '—'}
            </Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>
              {profile?.role === 'teacher' ? 'Employee ID' : 'Student ID'}
            </Text>
            <Text style={styles.aboutValue}>{profile?.student_id || '—'}</Text>
          </View>
          {profile?.role === 'student' ? (
            <>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Department</Text>
                <Text style={styles.aboutValue}>{profile.department || '—'}</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Year level</Text>
                <Text style={styles.aboutValue}>{profile.year_level || '—'}</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Block</Text>
                <Text style={styles.aboutValue}>{profile.block || '—'}</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Class officer</Text>
                <Text style={styles.aboutValue}>
                  {profile.is_class_officer ? profile.officer_position || 'Yes' : 'No'}
                </Text>
              </View>
            </>
          ) : null}
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Account type</Text>
            <Text style={styles.aboutValue}>{roleLabel}</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Date joined</Text>
            <Text style={styles.aboutValue}>
              {formatDate(profile?.created_at ?? user?.created_at)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.themeRow}>
            <View style={styles.rowIcon}>
              <Ionicons
                name={isDark ? 'moon-outline' : 'sunny-outline'}
                size={18}
                color={COLORS.primary}
              />
            </View>
            <View style={styles.themeText}>
              <Text style={styles.themeLabel}>Dark mode</Text>
              <Text style={styles.themeCaption}>
                {isDark ? 'Night mode is on' : 'Day mode is on'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(v) => setTheme(v ? 'dark' : 'light')}
              trackColor={{ true: COLORS.primary, false: COLORS.border }}
              thumbColor={COLORS.card}
            />
          </View>
          <View style={styles.themePreviewRow}>
            <Pressable
              style={[styles.themeOption, !isDark && styles.themeOptionActive]}
              onPress={() => setTheme('light')}
            >
              <Ionicons
                name="sunny-outline"
                size={16}
                color={!isDark ? COLORS.textOnPrimary : COLORS.textSecondary}
              />
              <Text
                style={[styles.themeOptionText, !isDark && styles.themeOptionTextActive]}
              >
                Light
              </Text>
            </Pressable>
            <Pressable
              style={[styles.themeOption, isDark && styles.themeOptionActive]}
              onPress={() => setTheme('dark')}
            >
              <Ionicons
                name="moon-outline"
                size={16}
                color={isDark ? COLORS.textOnPrimary : COLORS.textSecondary}
              />
              <Text
                style={[styles.themeOptionText, isDark && styles.themeOptionTextActive]}
              >
                Dark
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.list}>
          <Row
            icon="chatbubbles-outline"
            label="Chat"
            caption="Message your teachers, students, or the admin"
            onPress={() => router.push('/(tabs)/chat')}
          />
          <Row
            icon="notifications-outline"
            label="Notifications"
            caption="Event reminders and attendance confirmations"
            onPress={() => router.push('/notifications')}
          />
          <Row
            icon="person-outline"
            label="Edit profile"
            caption="Name, department, block, skills and photo"
            onPress={() => router.push('/profile')}
          />
          {profile?.role === 'student' ? (
            <Row
              icon="qr-code-outline"
              label="Scan QR code"
              caption="Record your attendance"
              onPress={() => router.push('/scan')}
            />
          ) : null}
          {profile?.role === 'teacher' || profile?.role === 'admin' ? (
            <Row
              icon="clipboard-outline"
              label="Manage events"
              caption="Create events and display QR codes"
              onPress={() => router.push('/(tabs)/teacher')}
            />
          ) : null}
          {profile?.role === 'admin' ? (
            <Row
              icon="shield-checkmark-outline"
              label="Admin dashboard"
              caption="Monitor attendance, analytics and every event"
              onPress={() => router.push('/(tabs)/admin')}
            />
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Application</Text>
            <Text style={styles.aboutValue}>QR Attendance</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Version</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Sync</Text>
            <Text style={styles.aboutValue}>Supabase Cloud</Text>
          </View>
        </View>

        <View style={styles.signOut}>
          <AppButton
            variant="danger"
            title="Sign Out"
            icon="log-out-outline"
            onPress={handleSignOut}
            loading={signingOut}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  label,
  caption,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  caption: string;
  onPress: () => void;
}) {
  const COLORS = useColors();
  const styles = useStyles();
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={COLORS.info} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowCaption}>{caption}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
    </Pressable>
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
      maxWidth: 760,
      width: '100%',
      alignSelf: 'center',
      gap: SPACING.md,
    },
    card: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.lg,
      gap: 10,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    userText: {
      flex: 1,
    },
    userName: {
      fontSize: 16,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    userEmail: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    sectionLabel: {
      fontSize: 12,
      fontWeight: '800',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginTop: SPACING.sm,
    },
    list: {
      gap: SPACING.sm,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    themeText: {
      flex: 1,
      gap: 2,
    },
    themeLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    themeCaption: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    themePreviewRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginTop: 4,
    },
    themeOption: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.inputBackground,
      paddingVertical: 10,
    },
    themeOptionActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
    themeOptionText: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textSecondary,
    },
    themeOptionTextActive: {
      color: COLORS.textOnPrimary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.lg,
    },
    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: COLORS.infoSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: {
      flex: 1,
    },
    rowLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    rowCaption: {
      fontSize: 12,
      color: COLORS.textSecondary,
    },
    aboutRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
    },
    aboutLabel: {
      fontSize: 13,
      color: COLORS.textSecondary,
    },
    aboutValue: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textPrimary,
    },
    signOut: {
      marginTop: SPACING.lg,
    },
  })
);
