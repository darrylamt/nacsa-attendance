import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useColors, font, spacing, radius } from '../theme/colors';
import { RootStackParamList } from '../types';
import { NumericPad } from '../components/NumericPad';
import { resolveClockIn, LocationError, ShiftError, DayCompleteError } from '../utils/clockIn';

type Props = NativeStackScreenProps<RootStackParamList, 'ManualID'>;

const MIN_ID_LENGTH = 6;
const MAX_ID_LENGTH = 7;

export function ManualIDScreen({ navigation, route }: Props) {
  const colors   = useColors();
  const { coords } = route.params;
  const [value, setValue]     = useState('');
  const [loading, setLoading] = useState(false);

  // Blinking cursor
  const cursorAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(cursorAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(cursorAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const handleConfirm = async () => {
    if (value.length < MIN_ID_LENGTH) return;
    setLoading(true);
    try {
      await resolveClockIn(value, coords);
      navigation.replace('Camera', { coords, pendingStaffId: value });
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (err instanceof LocationError) {
        Alert.alert('Not at Your Office', err.message);
      } else if (err instanceof ShiftError) {
        Alert.alert('Outside Shift Hours', err.message);
      } else if (err instanceof DayCompleteError) {
        Alert.alert('Day Complete', err.message);
      } else {
        Alert.alert('Error', err.message ?? 'Something went wrong. Please try again.');
        setValue('');
      }
    } finally {
      setLoading(false);
    }
  };

  const isReady = value.length >= MIN_ID_LENGTH;
  const isEmpty = value.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Staff ID</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.body}>
          <Text style={[styles.prompt, { color: colors.textSecondary }]}>
            Enter your Staff ID
          </Text>

          {/* Single input field */}
          <View
            style={[
              styles.inputField,
              {
                backgroundColor: colors.surface,
                borderColor: isReady ? colors.accent : isEmpty ? colors.border : colors.accent + '88',
              },
            ]}
          >
            {isEmpty ? (
              <Text style={[styles.placeholder, { color: colors.textMuted }]}>
                e.g. 833125
              </Text>
            ) : (
              <Text style={[styles.inputText, { color: colors.text }]}>
                {value}
              </Text>
            )}
            {/* Blinking cursor */}
            <Animated.View
              style={[styles.cursor, { backgroundColor: colors.accent, opacity: cursorAnim }]}
            />
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.padSection}
        >
          <NumericPad value={value} onChange={setValue} maxLength={MAX_ID_LENGTH} />

          <TouchableOpacity
            style={[
              styles.confirmBtn,
              { backgroundColor: isReady ? colors.accent : colors.surface },
              !isReady && { borderWidth: 1, borderColor: colors.border },
            ]}
            onPress={handleConfirm}
            disabled={!isReady || loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={isReady ? colors.accentText : colors.textMuted} />
            ) : (
              <Text style={[styles.confirmText, { color: isReady ? colors.accentText : colors.textMuted }]}>
                Continue
              </Text>
            )}
          </TouchableOpacity>
        </KeyboardAvoidingView>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, paddingHorizontal: spacing.xl },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: spacing.lg,
  },
  backBtn: { paddingVertical: spacing.xs },
  backText: { fontSize: font.md },
  screenTitle: { fontSize: font.md, fontWeight: '600' },

  body: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg,
  },
  prompt: { fontSize: font.md, letterSpacing: 0.3 },

  inputField: {
    width: '100%',
    height: 72,
    borderRadius: radius.lg,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  placeholder: {
    fontSize: font.xxl,
    fontWeight: '200',
    letterSpacing: 4,
  },
  inputText: {
    fontSize: font.xxl,
    fontWeight: '300',
    letterSpacing: 8,
  },
  cursor: {
    width: 2,
    height: 36,
    borderRadius: 2,
  },

  padSection: { gap: spacing.lg, paddingBottom: spacing.xl },
  confirmBtn: {
    borderRadius: radius.lg, paddingVertical: spacing.lg,
    alignItems: 'center', marginTop: spacing.md,
  },
  confirmText: { fontSize: font.lg, fontWeight: '700' },
});
