import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useColors, font, spacing, radius } from '../theme/colors';
import {
  RootStackParamList,
  NotificationSetting,
  CLOCK_EVENT_LABELS,
  ClockEventType,
} from '../types';
import {
  getNotificationSettings,
  saveNotificationSettings,
  applyNotificationSettings,
  cancelAllNotifications,
} from '../utils/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'NotificationSettings'>;

const EVENT_ORDER: ClockEventType[] = [
  'clock-in-arrival',
  'clock-out-lunch',
  'clock-in-lunch',
  'clock-out-eod',
];

const EVENT_DESCRIPTION: Record<ClockEventType, string> = {
  'clock-in-arrival':  'Remind me to clock in at the start of the day',
  'clock-out-lunch':   'Remind me to clock out when lunch starts',
  'clock-in-lunch':    'Remind me to clock back in after lunch',
  'clock-out-eod':     'Remind me to clock out at end of day',
};

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const EVENT_ICON: Record<ClockEventType, IoniconsName> = {
  'clock-in-arrival':  'log-in-outline',
  'clock-out-lunch':   'restaurant-outline',
  'clock-in-lunch':    'return-down-forward-outline',
  'clock-out-eod':     'log-out-outline',
};

function TimePicker({
  value,
  onChange,
  onClose,
  colors,
}: {
  value: string;
  onChange: (t: string) => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [h, setH] = useState(parseInt(value.split(':')[0], 10));
  const [m, setM] = useState(parseInt(value.split(':')[1], 10));

  const pad   = (n: number) => String(n).padStart(2, '0');
  const ampm  = h < 12 ? 'AM' : 'PM';
  const h12   = h % 12 === 0 ? 12 : h % 12;

  const apply = () => {
    onChange(`${pad(h)}:${pad(m)}`);
    onClose();
  };

  return (
    <View style={[pickerStyles.container, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
      <Text style={[pickerStyles.title, { color: colors.text }]}>Set Time</Text>

      <View style={pickerStyles.row}>
        {/* Hours */}
        <View style={pickerStyles.unit}>
          <TouchableOpacity onPress={() => setH((h + 1) % 24)} style={pickerStyles.arrow}>
            <Text style={[pickerStyles.arrowText, { color: colors.accent }]}>▲</Text>
          </TouchableOpacity>
          <Text style={[pickerStyles.value, { color: colors.text }]}>{pad(h12)}</Text>
          <TouchableOpacity onPress={() => setH((h - 1 + 24) % 24)} style={pickerStyles.arrow}>
            <Text style={[pickerStyles.arrowText, { color: colors.accent }]}>▼</Text>
          </TouchableOpacity>
        </View>

        <Text style={[pickerStyles.colon, { color: colors.text }]}>:</Text>

        {/* Minutes — steps of 5 */}
        <View style={pickerStyles.unit}>
          <TouchableOpacity onPress={() => setM((m + 5) % 60)} style={pickerStyles.arrow}>
            <Text style={[pickerStyles.arrowText, { color: colors.accent }]}>▲</Text>
          </TouchableOpacity>
          <Text style={[pickerStyles.value, { color: colors.text }]}>{pad(m)}</Text>
          <TouchableOpacity onPress={() => setM((m - 5 + 60) % 60)} style={pickerStyles.arrow}>
            <Text style={[pickerStyles.arrowText, { color: colors.accent }]}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* AM/PM */}
        <TouchableOpacity
          onPress={() => setH(h < 12 ? h + 12 : h - 12)}
          style={[pickerStyles.ampm, { borderColor: colors.accent }]}
        >
          <Text style={[pickerStyles.ampmText, { color: colors.accent }]}>{ampm}</Text>
        </TouchableOpacity>
      </View>

      <View style={pickerStyles.actions}>
        <TouchableOpacity onPress={onClose} style={pickerStyles.cancelBtn}>
          <Text style={[pickerStyles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={apply}
          style={[pickerStyles.applyBtn, { backgroundColor: colors.accent }]}
        >
          <Text style={[pickerStyles.applyText, { color: colors.accentText }]}>Set</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function NotificationSettingsScreen({ navigation }: Props) {
  const colors = useColors();
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [pickerFor, setPickerFor] = useState<ClockEventType | null>(null);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    getNotificationSettings().then(setSettings);
    AsyncStorage.getItem('nacsa:first_name').then((n) => { if (n) setFirstName(n); });
  }, []);

  const toggle = (type: ClockEventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings((prev) =>
      prev.map((s) => (s.type === type ? { ...s, enabled: !s.enabled } : s)),
    );
  };

  const setTime = (type: ClockEventType, time: string) => {
    setSettings((prev) =>
      prev.map((s) => (s.type === type ? { ...s, time } : s)),
    );
  };

  const formatDisplay = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const ampm = h < 12 ? 'AM' : 'PM';
    const h12  = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const handleSave = async () => {
    setSaving(true);
    await saveNotificationSettings(settings);
    const name = firstName || 'there';
    const hasEnabled = settings.some((s) => s.enabled);
    if (hasEnabled) {
      await applyNotificationSettings(settings, name);
    } else {
      await cancelAllNotifications();
    }
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved', 'Your notification preferences have been updated.');
    navigation.goBack();
  };

  const pickerSetting = settings.find((s) => s.type === pickerFor);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          <Text style={[styles.saveText, { color: colors.accent }]}>
            {saving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionNote, { color: colors.textMuted }]}>
          Daily reminders for each clock event. Tap the time to change it.
        </Text>

        {EVENT_ORDER.map((type) => {
          const setting = settings.find((s) => s.type === type);
          if (!setting) return null;

          return (
            <View
              key={type}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.rowLeft}>
                <View style={[styles.iconCircle, {
                  backgroundColor: setting.enabled ? colors.accentDim : colors.surface,
                  borderColor: setting.enabled ? colors.accent + '55' : colors.border,
                }]}>
                  <Ionicons
                    name={EVENT_ICON[type]}
                    size={18}
                    color={setting.enabled ? colors.accent : colors.textMuted}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {CLOCK_EVENT_LABELS[type]}
                  </Text>
                  <Text style={[styles.rowDesc, { color: colors.textMuted }]}>
                    {EVENT_DESCRIPTION[type]}
                  </Text>
                </View>
              </View>

              <View style={styles.rowRight}>
                {setting.enabled && (
                  <TouchableOpacity
                    onPress={() => setPickerFor(type)}
                    style={[styles.timePill, { backgroundColor: colors.accentDim, borderColor: colors.accent + '55' }]}
                  >
                    <Text style={[styles.timeText, { color: colors.accent }]}>
                      {formatDisplay(setting.time)}
                    </Text>
                  </TouchableOpacity>
                )}
                <Switch
                  value={setting.enabled}
                  onValueChange={() => toggle(type)}
                  trackColor={{ false: colors.border, true: colors.accent + '88' }}
                  thumbColor={setting.enabled ? colors.accent : colors.textMuted}
                />
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Time picker modal */}
      <Modal visible={!!pickerFor} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerFor(null)}
        >
          <TouchableOpacity activeOpacity={1}>
            {pickerSetting && (
              <TimePicker
                value={pickerSetting.time}
                onChange={(t) => setTime(pickerFor!, t)}
                onClose={() => setPickerFor(null)}
                colors={colors}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  backBtn: { paddingVertical: spacing.xs, minWidth: 60 },
  backText: { fontSize: font.md },
  title: { fontSize: font.md, fontWeight: '600' },
  saveBtn: { paddingVertical: spacing.xs, minWidth: 60, alignItems: 'flex-end' },
  saveText: { fontSize: font.md, fontWeight: '700' },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  sectionNote: { fontSize: font.sm, marginBottom: spacing.sm, lineHeight: 18 },

  row: {
    borderRadius: radius.lg, borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: spacing.md,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, flex: 1 },
  iconCircle: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: font.md, fontWeight: '600' },
  rowDesc:  { fontSize: font.xs, lineHeight: 16 },

  rowRight: { alignItems: 'flex-end', gap: spacing.sm },
  timePill: {
    borderWidth: 1, borderRadius: radius.full,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
  },
  timeText: { fontSize: font.sm, fontWeight: '600' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    width: 280, borderRadius: radius.lg, borderWidth: 1,
    padding: spacing.xl, gap: spacing.lg,
  },
  title: { fontSize: font.lg, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  unit: { alignItems: 'center', gap: spacing.sm },
  arrow: { padding: spacing.sm },
  arrowText: { fontSize: font.lg, fontWeight: '700' },
  value: { fontSize: 40, fontWeight: '200', width: 60, textAlign: 'center' },
  colon: { fontSize: 36, fontWeight: '100', marginBottom: spacing.sm },
  ampm: {
    borderWidth: 2, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  ampmText: { fontSize: font.md, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  cancelBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  cancelText: { fontSize: font.md },
  applyBtn: { borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  applyText: { fontSize: font.md, fontWeight: '700' },
});
