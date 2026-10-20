import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import AppInput from '@/components/ui/AppInput';
import { COLORS } from '@/constants/colors';
import { RADIUS, SPACING } from '@/constants/theme';
import { signUp } from '@/lib/auth';
import type { Role } from '@/lib/profiles';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

const ROLES: {
  value: Role;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'student',
    label: 'Student',
    description: 'I scan QR codes to record my attendance',
    icon: 'school-outline',
  },
  {
    value: 'teacher',
    label: 'Teacher',
    description: 'I create events and manage attendance',
    icon: 'clipboard-outline',
  },
];

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next: FieldErrors = {};
    if (!fullName.trim()) next.fullName = 'Full name is required.';
    else if (fullName.trim().length < 2) next.fullName = 'Enter your full name.';
    if (!email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    else if (password.length < 6) next.password = 'Password must be at least 6 characters.';
    if (!confirmPassword) next.confirmPassword = 'Confirm your password.';
    else if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleRegister = async () => {
    setError(null);
    Keyboard.dismiss();
    if (!validate()) return;

    setLoading(true);
    try {
      const { data, error: authError } = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
        role,
      });

      if (authError) {
        const message = authError.message.toLowerCase().includes('already')
          ? 'An account with this email already exists.'
          : authError.message;
        setError(message);
      } else if (data.session) {
        router.replace('/(tabs)');
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.lg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brand}>
              <View style={styles.logo}>
                <Ionicons name="qr-code" size={30} color="#04140D" />
              </View>
              <Text style={styles.brandName}>QR Attendance</Text>
            </View>

            {success ? (
              <View style={styles.successCard}>
                <View style={styles.successIcon}>
                  <Ionicons name="mail-open-outline" size={30} color={COLORS.success} />
                </View>
                <Text style={styles.successTitle}>Check your email</Text>
                <Text style={styles.successText}>
                  We sent a confirmation link to {email.trim()}. Verify your
                  account, then sign in.
                </Text>
                <AppButton
                  variant="primary"
                  title="Back to Sign In"
                  icon="arrow-back-outline"
                  onPress={() => router.replace('/login')}
                />
              </View>
            ) : (
              <View style={styles.card}>
                <Text style={styles.title}>Create account</Text>
                <Text style={styles.subtitle}>
                  Register to start recording attendance
                </Text>

                <AppInput
                  label="Full Name"
                  icon="person-outline"
                  placeholder="Juan Dela Cruz"
                  value={fullName}
                  onChangeText={(v) => {
                    setFullName(v);
                    if (errors.fullName) setErrors({});
                  }}
                  editable={!loading}
                  error={errors.fullName}
                />

                <AppInput
                  label="Email"
                  icon="mail-outline"
                  placeholder="your.email@school.edu"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (errors.email) setErrors({});
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!loading}
                  error={errors.email}
                />

                <AppInput
                  label="Password"
                  icon="lock-closed-outline"
                  placeholder="At least 6 characters"
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (errors.password) setErrors({});
                  }}
                  isPassword
                  editable={!loading}
                  error={errors.password}
                />

                <AppInput
                  label="Confirm Password"
                  icon="lock-closed-outline"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChangeText={(v) => {
                    setConfirmPassword(v);
                    if (errors.confirmPassword) setErrors({});
                  }}
                  isPassword
                  editable={!loading}
                  error={errors.confirmPassword}
                />

                <View>
                  <Text style={styles.sectionLabel}>I am a...</Text>
                  <View style={styles.roleRow}>
                    {ROLES.map((item) => {
                      const active = role === item.value;
                      return (
                        <Pressable
                          key={item.value}
                          style={[styles.roleCard, active && styles.roleCardActive]}
                          onPress={() => setRole(item.value)}
                          disabled={loading}
                        >
                          <View
                            style={[
                              styles.roleIcon,
                              active && styles.roleIconActive,
                            ]}
                          >
                            <Ionicons
                              name={item.icon}
                              size={20}
                              color={active ? '#04140D' : COLORS.textSecondary}
                            />
                          </View>
                          <Text
                            style={[styles.roleTitle, active && styles.roleTitleActive]}
                          >
                            {item.label}
                          </Text>
                          <Text style={styles.roleDescription}>{item.description}</Text>
                          <View style={[styles.radio, active && styles.radioOn]}>
                            {active ? (
                              <Ionicons name="checkmark" size={12} color="#04140D" />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
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
                  title="Create Account"
                  icon="person-add-outline"
                  onPress={handleRegister}
                  loading={loading}
                />
              </View>
            )}

            {!success ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <Link href="/login" style={styles.footerLink}>
                  Sign In
                </Link>
              </View>
            ) : null}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.xxl,
    paddingBottom: SPACING.xxxl,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  brand: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: 6,
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xxl,
    gap: SPACING.lg,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: -10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  roleCard: {
    flex: 1,
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 4,
    alignItems: 'flex-start',
  },
  roleCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.successSoft,
  },
  roleIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  roleIconActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  roleTitleActive: {
    color: COLORS.success,
  },
  roleDescription: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
  radio: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
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
  successCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: SPACING.xxl,
    gap: SPACING.lg,
    alignItems: 'center',
  },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  successText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xxl,
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: '700',
  },
});
