import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';
import { signOut, useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import { useToast } from '@/components/ui/Toast';
import ScreenHeader from '@/components/ui/ScreenHeader';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);

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
              label={profile?.role === 'teacher' ? 'Teacher' : 'Student'}
              tone={profile?.role === 'teacher' ? 'info' : 'success'}
              small
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.list}>
          <Row
            icon="notifications-outline"
            label="Notifications"
            caption="Event reminders and attendance confirmations"
            onPress={() => router.push('/notifications')}
          />
          <Row
            icon="person-outline"
            label="Edit profile"
            caption="Name, student ID, course and photo"
            onPress={() => router.push('/profile')}
          />
          {profile?.role === 'teacher' ? (
            <Row
              icon="clipboard-outline"
              label="Manage events"
              caption="Create events and display QR codes"
              onPress={() => router.push('/(tabs)/teacher')}
            />
          ) : (
            <Row
              icon="qr-code-outline"
              label="Scan QR code"
              caption="Record your attendance"
              onPress={() => router.push('/scan')}
            />
          )}
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
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={COLORS.success} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowCaption}>{caption}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.muted} />
    </Pressable>
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
    backgroundColor: COLORS.successSoft,
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
});
