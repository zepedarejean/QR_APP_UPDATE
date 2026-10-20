import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G } from 'react-native-svg';

import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import type { DepartmentSummaryRow } from '@/lib/attendance';

/**
 * Fixed brand colors per department, as requested:
 *   BSIT      -> blue
 *   BSENTREP  -> red
 *   BSHM      -> yellow
 *   Education -> green (BSED / BPED / BEED grouped together)
 */
export const DEPARTMENT_COLORS: Record<string, string> = {
  BSIT: '#3B82F6',
  BSENTREP: '#EF4444',
  BSHM: '#F59E0B',
  BSED: '#22C55E',
  BPED: '#22C55E',
  BEED: '#22C55E',
};

/** Groups education programs under one "Education" legend entry. */
export const EDUCATION_KEYS = ['BSED', 'BPED', 'BEED'];

export function departmentColor(dept: string): string {
  const key = dept.trim().toUpperCase().replace(/\s+/g, ' ');
  if (DEPARTMENT_COLORS[key]) return DEPARTMENT_COLORS[key];
  if (EDUCATION_KEYS.some((e) => key.includes(e))) return '#22C55E';
  return '#8B5CF6';
}

type Slice = {
  label: string;
  value: number;
  color: string;
  students: number;
  percent: number;
};

/**
 * Builds donut slices from the department rows. Education programs are merged
 * and each slice carries the share of total scans as a percentage.
 */
export function buildSlices(rows: DepartmentSummaryRow[]): Slice[] {
  if (!rows.length) return [];
  const total = rows.reduce((sum, r) => sum + r.scans, 0);
  const merged = new Map<string, Slice>();

  for (const row of rows) {
    const color = departmentColor(row.department);
    const isEducation = color === '#22C55E';
    const key = isEducation ? 'Education' : row.department.toUpperCase();
    const label = isEducation ? 'Education' : row.department;
    const existing = merged.get(key);
    if (existing) {
      existing.value += row.scans;
      existing.students += row.students;
    } else {
      merged.set(key, {
        label,
        color,
        value: row.scans,
        students: row.students,
        percent: 0,
      });
    }
  }

  const denom = total > 0 ? total : 1;
  const list = Array.from(merged.values()).sort((a, b) => b.value - a.value);
  for (const s of list) {
    s.percent = total > 0 ? Math.round((s.value / denom) * 100) : 0;
  }
  return list;
}

export default function DepartmentDonut({
  rows,
  size = 148,
  thickness = 20,
}: {
  rows: DepartmentSummaryRow[];
  size?: number;
  thickness?: number;
}) {
  const COLORS = useColors();
  const styles = useStyles();
  const [active, setActive] = useState<number | null>(null);

  const slices = buildSlices(rows);
  const totalScans = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = slices.length > 1 ? 4 : 0;

  const header = (
    <View style={styles.header}>
      <View style={styles.headerIcon}>
        <Ionicons name="stats-chart" size={18} color={COLORS.primary} />
      </View>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>Scans by department</Text>
        <Text style={styles.headerSubtitle}>
          {totalScans > 0
            ? `${totalScans} total scans across ${slices.length} ${
                slices.length === 1 ? 'program' : 'programs'
              }`
            : 'Attendance QR scan distribution'}
        </Text>
      </View>
    </View>
  );

  if (!slices.length || totalScans === 0) {
    return (
      <View style={styles.card}>
        {header}
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="pie-chart-outline" size={26} color={COLORS.muted} />
          </View>
          <Text style={styles.emptyText}>No scans recorded yet</Text>
          <Text style={styles.emptyHint}>
            Department distribution appears once students scan event QR codes.
          </Text>
        </View>
      </View>
    );
  }

  let offset = 0;
  const arcs = slices.map((slice) => {
    const fraction = slice.value / totalScans;
    const length = Math.max(0, fraction * circumference - gap);
    const dash = `${length} ${circumference - length}`;
    const rotation = (offset / circumference) * 360 - 90;
    offset += fraction * circumference;
    return { slice, dash, rotation };
  });

  const activeSlice = active !== null ? slices[active] : null;

  return (
    <View style={styles.card}>
      {header}

      <View style={styles.body}>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <G origin={`${size / 2}, ${size / 2}`}>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={COLORS.inputBackground}
                strokeWidth={thickness}
                fill="transparent"
              />
              {arcs.map(({ slice, dash, rotation }, i) => (
                <Circle
                  key={slice.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={
                    active === null || active === i
                      ? slice.color
                      : slice.color + '33'
                  }
                  strokeWidth={active === i ? thickness + 5 : thickness}
                  strokeDasharray={dash}
                  strokeLinecap="butt"
                  fill="transparent"
                  rotation={rotation}
                  origin={`${size / 2}, ${size / 2}`}
                />
              ))}
            </G>
          </Svg>

          <View style={styles.center} pointerEvents="none">
            <Text style={styles.centerValue}>
              {activeSlice ? `${activeSlice.percent}%` : totalScans}
            </Text>
            <Text style={styles.centerLabel} numberOfLines={1}>
              {activeSlice ? activeSlice.label : 'Total scans'}
            </Text>
          </View>
        </View>

        <View style={styles.legend}>
          {slices.map((slice, i) => {
            const isActive = active === i;
            return (
              <Pressable
                key={slice.label}
                style={[styles.barRow, isActive && styles.barRowActive]}
                onPress={() => setActive(isActive ? null : i)}
              >
                <View style={styles.barTop}>
                  <View style={styles.barLabelWrap}>
                    <View style={[styles.barDot, { backgroundColor: slice.color }]} />
                    <Text style={styles.barLabel} numberOfLines={1}>
                      {slice.label}
                    </Text>
                  </View>
                  <Text style={[styles.barPercent, { color: slice.color }]}>
                    {slice.percent}%
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: slice.color,
                        width: `${Math.max(3, slice.percent)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barMeta}>
                  {slice.value} scan{slice.value === 1 ? '' : 's'} ·{' '}
                  {slice.students} student{slice.students === 1 ? '' : 's'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    card: {
      backgroundColor: COLORS.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: COLORS.cardBorderNeon,
      padding: SPACING.lg,
      gap: SPACING.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: COLORS.infoSoft,
      borderWidth: 1,
      borderColor: COLORS.cardBorderNeon,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    headerSubtitle: {
      fontSize: 12.5,
      color: COLORS.textSecondary,
    },
    body: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.lg,
      flexWrap: 'wrap',
    },
    center: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 26,
    },
    centerValue: {
      fontSize: 27,
      fontWeight: '900',
      color: COLORS.textPrimary,
      letterSpacing: -1,
    },
    centerLabel: {
      fontSize: 10.5,
      fontWeight: '800',
      color: COLORS.textSecondary,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 2,
    },
    legend: {
      flex: 1,
      minWidth: 190,
      gap: SPACING.md,
      justifyContent: 'center',
    },
    barRow: {
      gap: 7,
      paddingVertical: 4,
      paddingHorizontal: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    barRowActive: {
      backgroundColor: COLORS.inputBackground,
      borderColor: COLORS.border,
    },
    barTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.sm,
    },
    barLabelWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      flex: 1,
    },
    barDot: {
      width: 9,
      height: 9,
      borderRadius: 3,
    },
    barLabel: {
      flex: 1,
      fontSize: 13,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    barPercent: {
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: -0.3,
    },
    barTrack: {
      height: 10,
      borderRadius: 5,
      backgroundColor: COLORS.inputBackground,
      overflow: 'hidden',
    },
    barFill: {
      height: '100%',
      borderRadius: 5,
    },
    barMeta: {
      fontSize: 11,
      color: COLORS.muted,
    },
    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: SPACING.xl,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: RADIUS.pill,
      backgroundColor: COLORS.inputBackground,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyText: {
      fontSize: 15,
      fontWeight: '800',
      color: COLORS.textPrimary,
    },
    emptyHint: {
      fontSize: 12.5,
      color: COLORS.textSecondary,
      textAlign: 'center',
      maxWidth: 300,
      lineHeight: 18,
    },
  })
);
