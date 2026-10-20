import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { useStatTones, type StatTone } from '@/components/ui/StatCard';

export type StatInfoData = {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: StatTone;
  description: string;
  details?: string[];
};

/**
 * Bottom-sheet that explains one of the dashboard stat cards when the
 * teacher taps it: big colored value, what the number means, and how to
 * act on it.
 */
export default function StatInfoModal({
  stat,
  onClose,
}: {
  stat: StatInfoData | null;
  onClose: () => void;
}) {
  const COLORS = useColors();
  const styles = useStyles();
  const tones = useStatTones();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(40)).current;
  const t = stat ? tones[stat.tone ?? 'primary'] : tones.primary;

  useEffect(() => {
    if (stat) {
      translateY.setValue(40);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      translateY.setValue(40);
    }
  }, [stat, translateY]);

  return (
    <Modal
      visible={stat !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close details"
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + SPACING.lg,
              transform: [{ translateY }],
              borderColor: t.fg + '59',
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: t.fg + '80' }]} />

          {stat ? (
            <>
              <View style={styles.header}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: t.bg, borderColor: t.fg + '66' },
                  ]}
                >
                  <Ionicons name={stat.icon} size={22} color={t.fg} />
                </View>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{stat.label}</Text>
                  <Text style={[styles.value, { color: t.fg }]}>
                    {stat.value}
                  </Text>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                  <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                </Pressable>
              </View>

              <View style={[styles.divider, { backgroundColor: t.fg + '33' }]} />

              <Text style={styles.description}>{stat.description}</Text>

              {stat.details?.length ? (
                <View style={styles.details}>
                  {stat.details.map((line) => (
                    <View key={line} style={styles.detailRow}>
                      <View
                        style={[styles.detailDot, { backgroundColor: t.fg }]}
                      />
                      <Text style={styles.detailText}>{line}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.doneBtn,
                  { backgroundColor: t.fg },
                  pressed && styles.donePressed,
                ]}
              >
                <Text style={styles.doneText}>Got it</Text>
              </Pressable>
            </>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: COLORS.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: COLORS.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      borderWidth: 1,
      paddingHorizontal: SPACING.lg,
      paddingTop: SPACING.md,
      gap: SPACING.md,
    },
    grabber: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      marginBottom: SPACING.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    iconWrap: {
      width: 46,
      height: 46,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    value: {
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -1,
    },
    closeBtn: {
      width: 30,
      height: 30,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.inputBackground,
    },
    divider: {
      height: 1,
      width: '100%',
    },
    description: {
      fontSize: 14.5,
      lineHeight: 21,
      color: COLORS.textPrimary,
    },
    details: {
      gap: SPACING.sm,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.sm,
    },
    detailDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      marginTop: 7,
    },
    detailText: {
      flex: 1,
      fontSize: 13.5,
      lineHeight: 19,
      color: COLORS.textSecondary,
    },
    doneBtn: {
      borderRadius: RADIUS.md,
      paddingVertical: 13,
      alignItems: 'center',
    },
    donePressed: {
      opacity: 0.85,
    },
    doneText: {
      fontSize: 14.5,
      fontWeight: '800',
      color: '#FFFFFF',
    },
  })
);
