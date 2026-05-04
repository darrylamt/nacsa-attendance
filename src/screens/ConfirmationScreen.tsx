import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useColors, font, spacing, radius } from '../theme/colors';
import { RootStackParamList, CLOCK_EVENT_LABELS, CLOCK_EVENT_ICONS, ClockEventType } from '../types';
import { postClockEvent } from '../services/api';
import { greeting } from '../utils/clockIn';
import { enqueueEvent, newLocalId } from '../utils/queue';
import { formatTimestamp, formatDate } from '../utils/clockLogic';

type Props = NativeStackScreenProps<RootStackParamList, 'Confirmation'>;

type SaveState = 'idle' | 'saving' | 'saved' | 'queued' | 'test';

function eventColor(type: ClockEventType, accent: string, warning: string, info: string): string {
  switch (type) {
    case 'clock-in-arrival':  return accent;
    case 'clock-out-lunch':   return warning;
    case 'clock-in-lunch':    return info;
    case 'clock-out-eod':     return '#555555';
  }
}

export function ConfirmationScreen({ navigation, route }: Props) {
  const colors = useColors();
  const { staffId, staffName, department, branchName, eventType,
          timestamp, coords, isLate, faceVerified, faceConfidence } = route.params;

  const scaleAnim   = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const checkAnim   = useRef(new Animated.Value(0)).current;
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const color = eventColor(eventType, colors.accent, colors.warning, colors.info);
  const label = CLOCK_EVENT_LABELS[eventType];
  const icon  = CLOCK_EVENT_ICONS[eventType];

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, damping: 14, stiffness: 180, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(120),
      Animated.spring(checkAnim, { toValue: 1, damping: 10, stiffness: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleConfirm = async () => {
    setSaveState('saving');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const payload = {
      staff_id:        staffId,
      event_type:      eventType,
      latitude:        coords.latitude,
      longitude:       coords.longitude,
      face_verified:   faceVerified ? 1 as const : 0 as const,
      face_confidence: faceConfidence,
      is_late:         isLate ? 1 as const : 0 as const,
    };

    try {
      const res = await postClockEvent(payload);

      if (res.test_mode) {
        setSaveState('test');
        await new Promise((r) => setTimeout(r, 1400));
      } else {
        setSaveState('saved');
        await new Promise((r) => setTimeout(r, 600));
      }
    } catch {
      // Offline or unreachable — save to queue
      await enqueueEvent({
        localId:   newLocalId(),
        payload,
        staffName,
        eventType,
        timestamp,
      });
      setSaveState('queued');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await new Promise((r) => setTimeout(r, 1200));
    }

    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const bannerConfig = {
    test:   { bg: '#D97706', text: 'TEST MODE — nothing written to database' },
    queued: { bg: colors.info, text: 'Saved offline — will sync when connected' },
    saved:  { bg: '#16A34A', text: 'Synced' },
    saving: { bg: colors.surface, text: '' },
    idle:   { bg: 'transparent', text: '' },
  };

  const banner = bannerConfig[saveState];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      {banner.text ? (
        <View style={[styles.banner, { backgroundColor: banner.bg }]}>
          <Text style={styles.bannerText}>{banner.text}</Text>
        </View>
      ) : null}

      <Animated.View
        style={[styles.container, { opacity: opacityAnim, transform: [{ scale: scaleAnim }] }]}
      >
        <Animated.View
          style={[styles.checkCircle, { borderColor: color, transform: [{ scale: checkAnim }] }]}
        >
          <Text style={[styles.checkIcon, { color }]}>{icon}</Text>
        </Animated.View>

        <View style={[styles.badge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
          <Text style={[styles.badgeText, { color }]}>{label}</Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            {greeting()},
          </Text>
          <Text style={[styles.name, { color: colors.text }]}>{staffName}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {department}  ·  {branchName}
          </Text>
          {isLate && (
            <View style={[styles.lateBadge, { backgroundColor: colors.warning + '22', borderColor: colors.warning + '55' }]}>
              <Text style={[styles.lateText, { color: colors.warning }]}>Late Arrival</Text>
            </View>
          )}
          {faceVerified && (
            <View style={[styles.faceBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
              <Text style={[styles.faceText, { color }]}>Face Verified  {faceConfidence}%</Text>
            </View>
          )}
        </View>

        <View style={styles.timeBlock}>
          <Text style={[styles.timeValue, { color: colors.text }]}>
            {formatTimestamp(timestamp)}
          </Text>
          <Text style={[styles.dateValue, { color: colors.textSecondary }]}>
            {formatDate(timestamp)}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: color }]}
          onPress={handleConfirm}
          disabled={saveState === 'saving'}
          activeOpacity={0.85}
        >
          {saveState === 'saving' ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmText}>Confirm</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  banner: { paddingVertical: spacing.sm, alignItems: 'center' },
  bannerText: { color: '#FFFFFF', fontSize: font.xs, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, gap: spacing.xl,
  },
  checkCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { fontSize: 36 },
  badge: { borderWidth: 1, borderRadius: radius.full, paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md },
  badgeText: { fontSize: font.sm, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  infoBlock: { alignItems: 'center', gap: spacing.xs },
  greeting: { fontSize: font.md, fontWeight: '300', letterSpacing: 0.5 },
  name: { fontSize: font.xxl, fontWeight: '300', letterSpacing: -0.5, textAlign: 'center' },
  meta: { fontSize: font.sm, letterSpacing: 0.3 },
  lateBadge: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: spacing.md, marginTop: spacing.xs },
  lateText: { fontSize: font.xs, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  faceBadge: { borderWidth: 1, borderRadius: radius.full, paddingVertical: 3, paddingHorizontal: spacing.md, marginTop: spacing.xs },
  faceText: { fontSize: font.xs, fontWeight: '600', letterSpacing: 0.5 },
  timeBlock: { alignItems: 'center', gap: spacing.xs },
  timeValue: { fontSize: 52, fontWeight: '100', letterSpacing: -1, lineHeight: 58 },
  dateValue: { fontSize: font.md, fontWeight: '300' },
  confirmBtn: {
    borderRadius: radius.lg, paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl, width: '100%',
    alignItems: 'center', marginTop: spacing.md,
  },
  confirmText: { color: '#FFFFFF', fontSize: font.lg, fontWeight: '700', letterSpacing: 0.5 },
});
