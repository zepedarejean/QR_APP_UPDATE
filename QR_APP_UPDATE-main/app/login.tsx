import { useEffect, useState } from 'react';
import {
  Image,
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
import * as SecureStore from 'expo-secure-store';

import AppButton from '@/components/AppButton';
import AppInput from '@/components/ui/AppInput';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { signIn } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/Toast';

const REMEMBER_KEY = 'qratt.remembered_email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const COLORS = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(REMEMBER_KEY)
      .then((value) => {
        if (value) setEmail(value);
      })
      .catch(() => {});
  }, []);

  const validate = () => {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    setError(null);
    Keyboard.dismiss();
    if (!validate()) return;

    setLoading(true);
    try {
      const { error: authError } = await signIn(email.trim(), password);

      if (authError) {
        const message = authError.message.toLowerCase().includes('invalid')
          ? 'Invalid email or password.'
          : authError.message;
        setError(message);
      } else {
        if (remember) {
          await SecureStore.setItemAsync(REMEMBER_KEY, email.trim()).catch(() => {});
        } else {
          await SecureStore.deleteItemAsync(REMEMBER_KEY).catch(() => {});
        }
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    if (!email.trim() || !EMAIL_RE.test(email.trim())) {
      setFieldErrors({ email: 'Enter your email first, then tap Forgot Password.' });
      return;
    }
    setResetLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim()
      );
      if (resetError) {
        setError(resetError.message);
      } else {
        setResetSent(true);
        toast.show('Password reset email sent.', 'success');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.xl }]}>
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
                <Image
                  source={require('@/assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.brandName}>QR Attendance</Text>
              <Text style={styles.brandTagline}>
                Modern attendance management for students and teachers
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>
                Sign in to record and manage attendance
              </Text>

              <AppInput
                label="Email"
                icon="mail-outline"
                placeholder="your.email@school.edu"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (fieldErrors.email) setFieldErrors({});
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
                error={fieldErrors.email}
              />

              <AppInput
                label="Password"
                icon="lock-closed-outline"
                placeholder="Enter your password"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (fieldErrors.password) setFieldErrors({});
                }}
                isPassword
                editable={!loading}
                error={fieldErrors.password}
              />

              <View style={styles.rowBetween}>
                <Pressable
                  style={styles.checkboxRow}
                  onPress={() => setRemember((v) => !v)}
                  hitSlop={8}
                >
                  <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                    {remember ? (
                      <Ionicons name="checkmark" size={13} color={COLORS.textOnPrimary} />
                    ) : null}
                  </View>
                  <Text style={styles.checkboxLabel}>Remember me</Text>
                </Pressable>

                <Pressable onPress={handleForgotPassword} disabled={resetLoading} hitSlop={8}>
                  <Text style={styles.forgot}>
                    {resetLoading ? 'Sending...' : 'Forgot password?'}
                  </Text>
                </Pressable>
              </View>

              {resetSent ? (
                <View style={styles.successBox}>
                  <Ionicons name="mail-open-outline" size={16} color={COLORS.success} />
                  <Text style={styles.successText}>
                    Reset link sent to {email.trim()}. Check your inbox.
                  </Text>
                </View>
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
                title="Sign In"
                icon="log-in-outline"
                onPress={handleLogin}
                loading={loading}
              />
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don&apos;t have an account? </Text>
              <Link href="/register" style={styles.footerLink}>
                Create Account
              </Link>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((COLORS) => StyleSheet.create({
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
    marginBottom: SPACING.xxl,
    gap: 6,
  },
  logo: {
    width: 84,
    height: 84,
    marginBottom: 6,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: -10,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  forgot: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '700',
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
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.successSoft,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: SPACING.md,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.success,
    fontWeight: '600',
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
}));
