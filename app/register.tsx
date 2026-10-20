import { useState } from 'react';
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import AppInput from '@/components/ui/AppInput';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { PickerField, PickerSheet } from '@/components/ui/PickerSheet';
import { RADIUS, SPACING } from '@/constants/theme';
import { useColors, makeStyles } from '@/lib/theme';
import { signUp } from '@/lib/auth';
import {
  BLOCKS,
  BSIT_SKILLS,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  OFFICER_POSITIONS,
  YEAR_LEVELS,
  type Role,
} from '@/lib/profiles';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  department?: string;
  yearLevel?: string;
  block?: string;
  officerPosition?: string;
};

const ROLES: {
  value: Role;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: 'student',
    label: 'Student',
    icon: 'school-outline',
  },
  {
    value: 'teacher',
    label: 'Teacher',
    icon: 'clipboard-outline',
  },
];

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const COLORS = useColors();
  const styles = useStyles();

  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [department, setDepartment] = useState<string | null>(null);
  const [yearLevel, setYearLevel] = useState<string | null>(null);
  const [block, setBlock] = useState<string | null>(null);
  const [deptPickerOpen, setDeptPickerOpen] = useState(false);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [blockPickerOpen, setBlockPickerOpen] = useState(false);
  const [isOfficer, setIsOfficer] = useState(false);
  const [officerPosition, setOfficerPosition] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const isBSIT = department === 'BSIT';

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

    if (role === 'student') {
      if (!department) next.department = 'Choose your department.';
      if (!yearLevel) next.yearLevel = 'Choose your year level.';
      if (!block) next.block = 'Choose your block.';
      if (isOfficer && !officerPosition)
        next.officerPosition = 'Choose your class officer position.';
    }
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
        student_id: studentId.trim() || null,
        department: role === 'student' ? department : null,
        year_level: role === 'student' ? yearLevel : null,
        block: role === 'student' ? block : null,
        is_class_officer: role === 'student' ? isOfficer : false,
        officer_position:
          role === 'student' && isOfficer ? officerPosition : null,
        skills: role === 'student' && isBSIT ? skills : [],
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
                <Image
                  source={require('@/assets/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.brandName, { color: COLORS.textPrimary }]}>
                QR Attendance
              </Text>
            </View>

            {success ? (
              <View style={[styles.successCard, { backgroundColor: COLORS.card, borderColor: COLORS.primary }]}>
                <View style={[styles.successIcon, { backgroundColor: COLORS.successSoft }]}>
                  <Ionicons name="mail-open-outline" size={30} color={COLORS.success} />
                </View>
                <Text style={[styles.successTitle, { color: COLORS.textPrimary }]}>
                  Check your email
                </Text>
                <Text style={[styles.successText, { color: COLORS.textSecondary }]}>
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
              <View style={[styles.card, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
                <Text style={[styles.title, { color: COLORS.textPrimary }]}>
                  Create account
                </Text>
                <Text style={[styles.subtitle, { color: COLORS.textSecondary }]}>
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
                  label={role === 'teacher' ? 'Employee ID (optional)' : 'Student ID (optional)'}
                  icon="barcode-outline"
                  placeholder="2024-001"
                  value={studentId}
                  onChangeText={setStudentId}
                  autoCapitalize="characters"
                  editable={!loading}
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
                  <Text style={[styles.sectionLabel, { color: COLORS.textSecondary }]}>
                    I am a...
                  </Text>
                  <View style={styles.roleRow}>
                    {ROLES.map((item) => {
                      const active = role === item.value;
                      return (
                        <Pressable
                          key={item.value}
                          style={[
                            styles.roleCard,
                            { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border },
                            active && { borderColor: COLORS.primary, backgroundColor: COLORS.infoSoft },
                          ]}
                          onPress={() => setRole(item.value)}
                          disabled={loading}
                        >
                          <View
                            style={[
                              styles.roleIcon,
                              { backgroundColor: COLORS.card, borderColor: COLORS.border },
                              active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                            ]}
                          >
                            <Ionicons
                              name={item.icon}
                              size={20}
                              color={active ? COLORS.textOnPrimary : COLORS.textSecondary}
                            />
                          </View>
                          <Text
                            style={[
                              styles.roleTitle,
                              { color: COLORS.textPrimary },
                              active && { color: COLORS.primary },
                            ]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {role === 'student' ? (
                  <>
                    <PickerField
                      label="Department"
                      value={department}
                      placeholder="Select Department"
                      icon="business-outline"
                      error={errors.department}
                      hint={
                        department
                          ? DEPARTMENT_LABELS[
                              department as keyof typeof DEPARTMENT_LABELS
                            ]
                          : null
                      }
                      onPress={() => setDeptPickerOpen(true)}
                    />

                    <PickerField
                      label="Year Level"
                      value={yearLevel}
                      placeholder="Select Year Level"
                      icon="calendar-outline"
                      error={errors.yearLevel}
                      onPress={() => setYearPickerOpen(true)}
                    />

                    <PickerField
                      label="Block"
                      value={block}
                      placeholder="Select Block"
                      icon="grid-outline"
                      error={errors.block}
                      onPress={() => setBlockPickerOpen(true)}
                    />

                    <View
                      style={[
                        styles.officerBox,
                        { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border },
                      ]}
                    >
                      <View style={styles.officerText}>
                        <Text style={[styles.officerTitle, { color: COLORS.textPrimary }]}>
                          Are you a class officer?
                        </Text>
                        <Text style={[styles.officerCaption, { color: COLORS.textSecondary }]}>
                          Pick your position if you hold one.
                        </Text>
                      </View>
                      <Switch
                        value={isOfficer}
                        onValueChange={(v) => {
                          setIsOfficer(v);
                          if (!v) setOfficerPosition(null);
                          setErrors((prev) => ({ ...prev, officerPosition: undefined }));
                        }}
                        trackColor={{ true: COLORS.primary, false: COLORS.border }}
                        thumbColor={COLORS.card}
                      />
                    </View>

                    {isOfficer ? (
                      <View style={styles.fieldGroup}>
                        <Text style={[styles.fieldLabel, { color: COLORS.textSecondary }]}>
                          Your position
                        </Text>
                        <ChipGroup
                          options={OFFICER_POSITIONS}
                          value={officerPosition}
                          columns={2}
                          onChange={(v: string) => {
                            setOfficerPosition(v);
                            setErrors((prev) => ({ ...prev, officerPosition: undefined }));
                          }}
                        />
                        {errors.officerPosition ? (
                          <Text style={[styles.fieldError, { color: COLORS.danger }]}>
                            {errors.officerPosition}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}

                    {isBSIT ? (
                      <View style={styles.fieldGroup}>
                        <Text style={[styles.fieldLabel, { color: COLORS.textSecondary }]}>
                          Your skills (BSIT)
                        </Text>
                        <Text style={[styles.fieldHint, { color: COLORS.muted }]}>
                          Optional — pick everything that fits you.
                        </Text>
                        <View style={styles.skillWrap}>
                          {BSIT_SKILLS.map((skill) => (
                            <Chip
                              key={skill}
                              label={skill}
                              small
                              selected={skills.includes(skill)}
                              onPress={() =>
                                setSkills((prev) =>
                                  prev.includes(skill)
                                    ? prev.filter((s) => s !== skill)
                                    : [...prev, skill]
                                )
                              }
                            />
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </>
                ) : null}

                {error ? (
                  <View style={[styles.errorBox, { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.danger }]}>
                    <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
                    <Text style={[styles.errorText, { color: COLORS.danger }]}>{error}</Text>
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
                <Text style={[styles.footerText, { color: COLORS.textSecondary }]}>
                  Already have an account?{' '}
                </Text>
                <Link href="/login" style={[styles.footerLink, { color: COLORS.accent }]}>
                  Sign In
                </Link>
              </View>
            ) : null}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={deptPickerOpen}
        title="Select Department"
        options={DEPARTMENTS}
        value={department}
        descriptions={DEPARTMENT_LABELS}
        onSelect={(v) => {
          setDepartment(v);
          setErrors((prev) => ({ ...prev, department: undefined }));
          if (v !== 'BSIT') setSkills([]);
        }}
        onClose={() => setDeptPickerOpen(false)}
      />
      <PickerSheet
        visible={yearPickerOpen}
        title="Select Year Level"
        options={YEAR_LEVELS}
        value={yearLevel}
        onSelect={(v) => {
          setYearLevel(v);
          setErrors((prev) => ({ ...prev, yearLevel: undefined }));
        }}
        onClose={() => setYearPickerOpen(false)}
      />
      <PickerSheet
        visible={blockPickerOpen}
        title="Select Block"
        options={BLOCKS}
        value={block}
        onSelect={(v) => {
          setBlock(v);
          setErrors((prev) => ({ ...prev, block: undefined }));
        }}
        onClose={() => setBlockPickerOpen(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
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
      width: 70,
      height: 70,
      marginBottom: 4,
    },
    logoImage: {
      width: '100%',
      height: '100%',
    },
    brandName: {
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    card: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      padding: SPACING.xxl,
      gap: SPACING.lg,
    },
    title: {
      fontSize: 25,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 14,
      marginTop: -10,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 8,
    },
    roleRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    roleCard: {
      flex: 1,
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      padding: SPACING.md,
      gap: 4,
      alignItems: 'flex-start',
    },
    roleIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    roleTitle: {
      fontSize: 14,
      fontWeight: '800',
    },
    fieldGroup: {
      gap: 8,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: '600',
    },
    fieldHint: {
      fontSize: 11,
    },
    fieldError: {
      fontSize: 12,
      fontWeight: '500',
    },
    skillWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    officerBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      padding: SPACING.lg,
    },
    officerText: {
      flex: 1,
      gap: 2,
    },
    officerTitle: {
      fontSize: 14,
      fontWeight: '700',
    },
    officerCaption: {
      fontSize: 12,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      padding: SPACING.md,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '600',
    },
    successCard: {
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      padding: SPACING.xxl,
      gap: SPACING.lg,
      alignItems: 'center',
    },
    successIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      fontSize: 20,
      fontWeight: '800',
    },
    successText: {
      fontSize: 14,
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
    },
    footerLink: {
      fontSize: 14,
      fontWeight: '700',
    },
  })
);
