import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { signOut, useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import Avatar from '@/components/ui/Avatar';

type SidebarRole = 'student' | 'teacher' | 'admin';

type NavItem = {
  href:
    | '/(tabs)'
    | '/scan'
    | '/history'
    | '/(tabs)/teacher'
    | '/(tabs)/admin'
    | '/(tabs)/chat'
    | '/profile'
    | '/notifications'
    | '/settings';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles?: SidebarRole[];
};

const ITEMS: NavItem[] = [
  { href: '/(tabs)', label: 'Home', icon: 'home-outline' },
  { href: '/scan', label: 'Scan QR', icon: 'qr-code-outline', roles: ['student'] },
  { href: '/(tabs)/admin', label: 'Admin', icon: 'shield-checkmark-outline', roles: ['admin'] },
  { href: '/(tabs)/teacher', label: 'Events', icon: 'clipboard-outline', roles: ['teacher', 'admin'] },
  { href: '/history', label: 'History', icon: 'time-outline' },
  { href: '/(tabs)/chat', label: 'Chat', icon: 'chatbubbles-outline' },
  { href: '/profile', label: 'Profile', icon: 'person-outline' },
];

const FOOTER_ITEMS: NavItem[] = [
  { href: '/notifications', label: 'Notifications', icon: 'notifications-outline' },
  { href: '/settings', label: 'Settings', icon: 'settings-outline' },
];

export default function AppSidebar() {
  const COLORS = useColors();
  const styles = useStyles();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { profile, loading } = useProfile(user?.id);

  const role = profile?.role ?? null;

  const isActive = (href: string) => {
    if (href === '/(tabs)') return pathname === '/';
    const path = href.replace('/(tabs)', '');
    return pathname.startsWith(path);
  };

  const visibleItems = ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandRow}>
        <View style={styles.logo}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <View>
          <Text style={styles.brandName}>QR Attendance</Text>
          <Text style={styles.brandRole}>
            {loading
              ? 'Loading...'
              : role === 'admin'
              ? 'Admin'
              : role === 'teacher'
              ? 'Teacher'
              : 'Student'}
          </Text>
        </View>
      </View>

      <View style={styles.nav}>
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Pressable
              key={item.href}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => router.push(item.href as never)}
            >
              <Ionicons
                name={item.icon}
                size={19}
                color={active ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.itemText, active && styles.itemTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        {FOOTER_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Pressable
              key={item.href}
              style={[styles.item, active && styles.itemActive]}
              onPress={() => router.push(item.href as never)}
            >
              <Ionicons
                name={item.icon}
                size={19}
                color={active ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.itemText, active && styles.itemTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}

        <View style={styles.profileRow}>
          <Avatar name={profile?.full_name ?? user?.email} uri={profile?.avatar_url} size={38} />
          <View style={styles.profileText}>
            <Text style={styles.profileName} numberOfLines={1}>
              {profile?.full_name ?? user?.email ?? 'Signed out'}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
          </View>
        </View>

        <Pressable style={styles.signOut} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
          <Text style={styles.signOutText}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
  sidebar: {
    width: 250,
    flexShrink: 0,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  logo: {
    width: 42,
    height: 42,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  brandRole: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nav: {
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemActive: {
    backgroundColor: COLORS.infoSoft,
    borderColor: COLORS.cardBorderNeon,
  },
  itemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  itemTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  footer: {
    gap: 4,
    marginTop: SPACING.xl,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  profileText: {
    flex: 1,
  },
  profileName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  profileEmail: {
    fontSize: 11,
    color: COLORS.muted,
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.dangerSoft,
    backgroundColor: COLORS.dangerSoft,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.danger,
  },
  })
);
