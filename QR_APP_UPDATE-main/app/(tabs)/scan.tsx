import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '@/components/AppButton';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useProfile } from '@/lib/useProfile';
import { registerAttendance, type RegisterResult } from '@/lib/attendance';
import {
  formatDate,
  formatLateBy,
  formatTime,
  scanToneFor,
  scanToneLabel,
  type AttendanceEvaluation,
} from '@/lib/format';

export default function ScanScreen() {
  const COLORS = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RegisterResult | null>(null);

  // Tone of the last successful scan: green on-time, blue almost-late, red late.
  const record = result?.success ? (result.record ?? null) : null;
  const evaluation: AttendanceEvaluation | null = record
    ? {
        status: record.status === 'late' ? 'late' : 'present',
        lateBySeconds: record.lateBySeconds,
        almostLate: record.almostLate,
        secondsToLate: 0,
      }
    : null;
  const tone = evaluation ? scanToneFor(evaluation) : 'success';
  const toneColor =
    tone === 'danger' ? COLORS.danger : tone === 'info' ? COLORS.info : COLORS.success;
  const toneSoft =
    tone === 'danger'
      ? COLORS.dangerSoft
      : tone === 'info'
        ? COLORS.infoSoft
        : COLORS.successSoft;
  const toneIcon =
    tone === 'danger' ? 'time' : tone === 'info' ? 'flash-outline' : 'checkmark-circle';
  const toneLabel = evaluation ? scanToneLabel(evaluation) : 'On time';

  useEffect(() => {
    if (permission && permission.status === 'undetermined' && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || busy) return;
    setScanned(true);

    if (!user) {
      setResult({
        success: false,
        message: 'Please sign in first. Attendance requires an account.',
      });
      return;
    }
    if (profile?.role === 'teacher') {
      setResult({
        success: false,
        message:
          'Teachers cannot record their own attendance. Use a student account to scan.',
      });
      return;
    }

    setBusy(true);
    try {
      const res = await registerAttendance(data, user.id, profile);
      setResult(res);
    } catch {
      setResult({
        success: false,
        message: 'Unable to connect. Please try again.',
      });
    } finally {
      setBusy(false);
    }
  };

  const resetScanner = () => {
    setResult(null);
    setScanned(false);
  };

  if (profile?.role === 'teacher') {
    return (
      <View style={styles.centered}>
        <View style={styles.lockCircle}>
          <Ionicons name="lock-closed-outline" size={30} color={COLORS.muted} />
        </View>
        <Text style={styles.centerTitle}>Students only</Text>
        <Text style={styles.centerText}>
          The QR scanner records student attendance. Create and manage events
          from the Events tab.
        </Text>
        <AppButton
          variant="primary"
          title="Go to Events"
          icon="clipboard-outline"
          onPress={() => router.push('/(tabs)/teacher')}
        />
      </View>
    );
  }

  if (!permission || (permission.status === 'undetermined' && !permission.granted)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Requesting camera access...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain;
    return (
      <View style={styles.centered}>
        <View style={styles.lockCircle}>
          <Ionicons name="camera-outline" size={30} color={COLORS.warning} />
        </View>
        <Text style={styles.centerTitle}>Camera access needed</Text>
        <Text style={styles.centerText}>
          Camera access is required to scan attendance QR codes. Allow camera
          permission to continue.
        </Text>
        {canAskAgain ? (
          <AppButton
            variant="primary"
            title="Grant Permission"
            icon="camera-outline"
            onPress={requestPermission}
          />
        ) : (
          <Text style={styles.hintText}>
            Camera permission is blocked. Enable it from your device settings,
            then return here.
          </Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned || result ? undefined : handleBarcodeScanned}
      />

      <View style={[styles.topOverlay, { top: SPACING.lg + insets.top }]}>
        <View style={styles.identityBar}>
          <Ionicons name="person-circle-outline" size={18} color={COLORS.success} />
          <Text style={styles.identityText} numberOfLines={1}>
            Scanning as:{' '}
            {profileLoading
              ? 'checking account...'
              : profile?.full_name ?? user?.email ?? 'not signed in'}
          </Text>
        </View>
      </View>

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
          {busy ? (
            <View style={styles.busyBox}>
              <ActivityIndicator color={COLORS.primary} />
              <Text style={styles.busyText}>Recording attendance...</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.frameHint}>
          Scan Attendance QR Code
        </Text>
        <Text style={styles.frameSubhint}>
          Point your camera at the attendance QR code.
        </Text>
      </View>

      <View style={styles.bottomBar}>
        <AppButton
          variant="secondary"
          title="Back to Home"
          icon="home-outline"
          onPress={() => router.push('/(tabs)')}
        />
      </View>

      <Modal
        visible={!!result}
        transparent
        animationType="fade"
        onRequestClose={resetScanner}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {result?.success && result.record ? (
              <>
                <View style={[styles.resultIcon, { backgroundColor: toneSoft }]}>
                  <Ionicons name={toneIcon} size={44} color={toneColor} />
                </View>
                <Text style={styles.resultTitle}>Attendance Recorded</Text>

                <View style={styles.detailBox}>
                  <DetailRow label="Event" value={result.record.title} />
                  <DetailRow
                    label="Subject"
                    value={result.record.subject || '—'}
                  />
                  <DetailRow
                    label="Date"
                    value={formatDate(result.record.scannedAt)}
                  />
                  <DetailRow
                    label="Scan Time"
                    value={formatTime(result.record.scannedAt)}
                  />
                  {record && record.status === 'late' ? (
                    <DetailRow
                      label="Late by"
                      value={formatLateBy(record.lateBySeconds)}
                    />
                  ) : null}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: toneSoft,
                          borderColor: toneColor,
                        },
                      ]}
                    >
                      <Ionicons
                        name={toneIcon}
                        size={14}
                        color={toneColor}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: toneColor },
                        ]}
                      >
                        {toneLabel}
                      </Text>
                    </View>
                  </View>
                </View>

                <AppButton
                  variant="primary"
                  title="Back to Home"
                  icon="home-outline"
                  onPress={() => {
                    resetScanner();
                    router.push('/(tabs)');
                  }}
                />
                <AppButton
                  variant="ghost"
                  title="View Attendance History"
                  icon="time-outline"
                  onPress={() => {
                    resetScanner();
                    router.push('/history');
                  }}
                />
              </>
            ) : (
              <>
                <View style={[styles.resultIcon, { backgroundColor: COLORS.dangerSoft }]}>
                  <Ionicons name="alert-circle" size={44} color={COLORS.danger} />
                </View>
                <Text style={styles.resultTitle}>Attendance Not Recorded</Text>
                <Text style={styles.resultMessage}>{result?.message}</Text>
                <AppButton
                  variant="primary"
                  title="Scan Again"
                  icon="refresh-outline"
                  onPress={resetScanner}
                />
                <AppButton
                  variant="ghost"
                  title="Back to Home"
                  icon="home-outline"
                  onPress={() => {
                    resetScanner();
                    router.push('/(tabs)');
                  }}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.lg,
    right: SPACING.lg,
  },
  identityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 18, 15, 0.92)',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  identityText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flexShrink: 1,
  },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: SPACING.xl,
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderRadius: RADIUS.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: COLORS.primary,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: RADIUS.xl,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: RADIUS.xl,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: RADIUS.xl,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: RADIUS.xl,
  },
  busyBox: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(5, 10, 8, 0.85)',
    borderRadius: RADIUS.md,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  busyText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  frameHint: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
  frameSubhint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 6,
  },
  bottomBar: {
    position: 'absolute',
    bottom: SPACING.xxl,
    left: SPACING.xxl,
    right: SPACING.xxl,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
    gap: SPACING.md,
  },
  lockCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  centerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  centerText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  hintText: {
    fontSize: 13,
    color: COLORS.warning,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 320,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.xxl,
    gap: SPACING.lg,
    alignItems: 'stretch',
  },
  resultIcon: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  detailBox: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: 9,
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
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
}));
