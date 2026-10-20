import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import AppButton from '@/components/AppButton';
import { Chip, ChipGroup } from '@/components/ui/Chip';
import { useColors, makeStyles } from '@/lib/theme';
import { RADIUS, SPACING } from '@/constants/theme';
import { createEvent, type CloudEvent } from '@/lib/events';
import {
  BLOCKS,
  DEPARTMENTS,
  YEAR_LEVELS,
} from '@/lib/profiles';
import { formatDateShort, formatTime } from '@/lib/format';

function nextHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

const GRACE_OPTIONS = [0, 3, 5, 10, 15, 30];

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated: (event: CloudEvent | null) => void;
};

export default function CreateEventModal({
  visible,
  onClose,
  onCreated,
}: Props) {
  const COLORS = useColors();
  const styles = useStyles();

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [room, setRoom] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState(nextHour);
  const [end, setEnd] = useState(() => new Date(nextHour().getTime() + 3600000));
  const [grace, setGrace] = useState(5);
  const [targetAll, setTargetAll] = useState(true);
  const [targets, setTargets] = useState<string[]>([]);
  const [targetYears, setTargetYears] = useState<string[]>([]);
  const [targetBlocks, setTargetBlocks] = useState<string[]>([]);
  const [picker, setPicker] = useState<{
    target: 'start' | 'end';
    part: 'date' | 'time';
  } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle('');
    setSubject('');
    setRoom('');
    setDescription('');
    const next = nextHour();
    setStart(next);
    setEnd(new Date(next.getTime() + 3600000));
    setGrace(5);
    setTargetAll(true);
    setTargets([]);
    setTargetYears([]);
    setTargetBlocks([]);
    setFieldError(null);
  };

  const applyQuickDuration = (minutes: number) => {
    setEnd(new Date(start.getTime() + minutes * 60000));
  };

  const onPickerChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      setPicker(null);
      return;
    }
    if (selected && picker) {
      const current = picker.target === 'start' ? start : end;
      const next = new Date(current);
      if (picker.part === 'date') {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      if (picker.target === 'start') {
        setStart(next);
        if (next >= end) setEnd(new Date(next.getTime() + 3600000));
      } else {
        setEnd(next);
      }
    }
    if (Platform.OS === 'android' && picker?.part === 'date') {
      setPicker({ target: picker.target, part: 'time' });
    } else {
      setPicker(null);
    }
  };

  const handleCreate = async () => {
    setFieldError(null);
    if (!title.trim()) {
      setFieldError('Event name is required.');
      return;
    }
    if (start >= end) {
      setFieldError('End time must be after the start time.');
      return;
    }
    setSaving(true);
    const { error, event } = await createEvent({
      title,
      subject,
      room,
      description,
      start: start.toISOString(),
      end: end.toISOString(),
      lateGraceMinutes: grace,
      targetDepartments: targetAll ? null : targets,
      targetYearLevels: targetAll ? null : targetYears,
      targetBlocks: targetAll ? null : targetBlocks,
    });
    setSaving(false);
    if (error) {
      setFieldError('Could not save the event. Please try again.');
      return;
    }
    reset();
    onCreated(event);
  };

  const pickerValue = useMemo(() => {
    if (!picker) return start;
    return picker.target === 'start' ? start : end;
  }, [picker, start, end]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: COLORS.background, borderColor: COLORS.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: COLORS.textPrimary }]}>
              Create Attendance Event
            </Text>
            <Pressable onPress={onClose} hitSlop={10} style={[styles.closeBtn, { backgroundColor: COLORS.card, borderColor: COLORS.border }]}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.form}>
              <Field label="Event Name *">
                <TextInput
                  style={[styles.input, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border, color: COLORS.textPrimary }]}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Database Systems Lecture"
                  placeholderTextColor={COLORS.muted}
                />
              </Field>

              <Field label="Subject / Course">
                <TextInput
                  style={[styles.input, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border, color: COLORS.textPrimary }]}
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Database Management"
                  placeholderTextColor={COLORS.muted}
                />
              </Field>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Field label="Date">
                    <Pressable
                      style={[styles.input, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border }]}
                      onPress={() => setPicker({ target: 'start', part: 'date' })}
                    >
                      <Text style={[styles.inputText, { color: COLORS.textPrimary }]}>
                        {formatDateShort(start.toISOString())}
                      </Text>
                    </Pressable>
                  </Field>
                </View>
                <View style={styles.fieldHalf}>
                  <Field label="Room / Location">
                    <TextInput
                      style={[styles.input, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border, color: COLORS.textPrimary }]}
                      value={room}
                      onChangeText={setRoom}
                      placeholder="Laboratory 103"
                      placeholderTextColor={COLORS.muted}
                    />
                  </Field>
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.fieldHalf}>
                  <Field label="Start Time">
                    <Pressable
                      style={[styles.input, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border }]}
                      onPress={() => setPicker({ target: 'start', part: 'time' })}
                    >
                      <Text style={[styles.inputText, { color: COLORS.textPrimary }]}>
                        {formatTime(start.toISOString())}
                      </Text>
                    </Pressable>
                  </Field>
                </View>
                <View style={styles.fieldHalf}>
                  <Field label="End Time">
                    <Pressable
                      style={[styles.input, { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border }]}
                      onPress={() => setPicker({ target: 'end', part: 'time' })}
                    >
                      <Text style={[styles.inputText, { color: COLORS.textPrimary }]}>
                        {formatTime(end.toISOString())}
                      </Text>
                    </Pressable>
                  </Field>
                </View>
              </View>

              <View style={styles.chipRow}>
                <Chip label="+30 min" small onPress={() => applyQuickDuration(30)} />
                <Chip label="+1 hour" small onPress={() => applyQuickDuration(60)} />
                <Chip label="+1.5 hours" small onPress={() => setEnd(new Date(start.getTime() + 90 * 60000))} />
                <Chip label="+2 hours" small onPress={() => applyQuickDuration(120)} />
              </View>

              <Field label="Mark students late after">
                <View style={styles.chipRow}>
                  {GRACE_OPTIONS.map((minutes) => (
                    <Chip
                      key={minutes}
                      small
                      label={minutes === 0 ? 'No grace' : `${minutes} min`}
                      selected={grace === minutes}
                      onPress={() => setGrace(minutes)}
                    />
                  ))}
                </View>
                <Text style={[styles.hint, { color: COLORS.muted }]}>
                  Students who scan after this window are marked LATE and the
                  app records how many seconds late they were.
                </Text>
              </Field>

              <Field label="Who can see this event?">
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: COLORS.textPrimary }]}>
                    All students
                  </Text>
                  <Switch
                    value={targetAll}
                    onValueChange={(v) => {
                      setTargetAll(v);
                      if (v) {
                        setTargets([]);
                        setTargetYears([]);
                        setTargetBlocks([]);
                      }
                    }}
                    trackColor={{ true: COLORS.primary, false: COLORS.border }}
                    thumbColor={COLORS.card}
                  />
                </View>
                {!targetAll ? (
                  <>
                    <Text style={[styles.hint, { color: COLORS.muted }]}>Departments</Text>
                    <ChipGroup
                      small
                      multiple
                      options={DEPARTMENTS}
                      value={targets}
                      onChange={setTargets}
                    />
                    <Text style={[styles.hint, { color: COLORS.muted }]}>Year levels</Text>
                    <ChipGroup
                      small
                      multiple
                      options={YEAR_LEVELS}
                      value={targetYears}
                      onChange={setTargetYears}
                    />
                    <Text style={[styles.hint, { color: COLORS.muted }]}>Blocks</Text>
                    <ChipGroup
                      small
                      multiple
                      options={BLOCKS}
                      value={targetBlocks}
                      onChange={setTargetBlocks}
                    />
                    {targets.length === 0 && targetYears.length === 0 && targetBlocks.length === 0 ? (
                      <Text style={[styles.hint, { color: COLORS.warning }]}>
                        Nothing selected yet — everyone can still see it.
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </Field>

              <Field label="Description">
                <TextInput
                  style={[
                    styles.input,
                    styles.textarea,
                    { backgroundColor: COLORS.inputBackground, borderColor: COLORS.border, color: COLORS.textPrimary },
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional details for students"
                  placeholderTextColor={COLORS.muted}
                  multiline
                />
              </Field>

              {fieldError ? (
                <View style={[styles.errorBox, { backgroundColor: COLORS.dangerSoft, borderColor: COLORS.danger }]}>
                  <Ionicons name="alert-circle-outline" size={16} color={COLORS.danger} />
                  <Text style={[styles.errorText, { color: COLORS.danger }]}>{fieldError}</Text>
                </View>
              ) : null}

              <AppButton
                variant="primary"
                size="lg"
                title="Create & Generate QR"
                icon="qr-code-outline"
                onPress={handleCreate}
                loading={saving}
              />
            </View>
          </ScrollView>
        </View>

        {picker ? (
          <DateTimePicker
            value={pickerValue}
            mode={Platform.OS === 'android' ? picker.part : 'datetime'}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const COLORS = useColors();
  return (
    <View style={localStyles.field}>
      <Text style={[localStyles.label, { color: COLORS.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

const localStyles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});

const useStyles = makeStyles((COLORS) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: COLORS.overlay,
      justifyContent: 'flex-end',
    },
    card: {
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      borderWidth: 1,
      maxHeight: '94%',
      paddingHorizontal: SPACING.xxl,
      paddingTop: SPACING.lg,
      paddingBottom: SPACING.xxxl,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    title: {
      fontSize: 19,
      fontWeight: '800',
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    form: {
      gap: SPACING.lg,
      paddingBottom: SPACING.xxl,
    },
    fieldRow: {
      flexDirection: 'row',
      gap: SPACING.md,
    },
    fieldHalf: {
      flex: 1,
    },
    input: {
      borderRadius: RADIUS.md,
      borderWidth: 1,
      paddingHorizontal: SPACING.lg,
      paddingVertical: 13,
      fontSize: 15,
      minHeight: 48,
      justifyContent: 'center',
    },
    textarea: {
      minHeight: 84,
      textAlignVertical: 'top',
      paddingTop: 12,
    },
    inputText: {
      fontSize: 15,
      fontWeight: '600',
    },
    chipRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
      flexWrap: 'wrap',
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.md,
      paddingVertical: 4,
    },
    switchLabel: {
      fontSize: 14,
      fontWeight: '700',
    },
    hint: {
      fontSize: 11.5,
      lineHeight: 16,
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
  })
);
