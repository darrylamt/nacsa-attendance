import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useColors, font, spacing, radius } from '../theme/colors';
import { RootStackParamList } from '../types';
import type { FaceDescriptorEntry, StaffProfile } from '../types';
import { fetchDescriptors, fetchStaff } from '../services/api';
import { matchDescriptor } from '../utils/faceDescriptorMatch';
import { resolveClockIn, LocationError, ShiftError, DayCompleteError } from '../utils/clockIn';
import { FaceProcessorWebView, FaceProcessorRef } from '../components/FaceProcessorWebView';
import { MODELS_URL, FACE_API_URL } from '../config';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

type ScanState =
  | 'requesting-permission'
  | 'loading-models'
  | 'ready'
  | 'capturing'
  | 'processing'
  | 'recognised'   // face matched — waiting for user to tap button
  | 'no-match'
  | 'no-permission';

const CAPTURE_INTERVAL_MS = 2500;
const PROCESS_TIMEOUT_MS  = 8000;
const MAX_ATTEMPTS        = 4;

export function CameraScreen({ navigation, route }: Props) {
  const colors = useColors();
  const { coords, pendingStaffId } = route.params;

  // pendingStaffId = coming from ManualID — camera just needs to capture face for that staff
  const isVerifyMode = !!pendingStaffId;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState]   = useState<ScanState>('requesting-permission');
  const [webViewError, setWebViewError] = useState<string | null>(null);
  const [matchedStaff, setMatchedStaff] = useState<{
    staffId: string;
    staffName: string;
    confidence: number;
  } | null>(null);

  // Animated value for the clock-in button colour
  const buttonAnim = useRef(new Animated.Value(0)).current;

  const cameraRef      = useRef<CameraView>(null);
  const processorRef   = useRef<FaceProcessorRef>(null);
  const processingRef  = useRef(false);
  const attemptsRef    = useRef(0);
  const modelsReadyRef = useRef(false);
  const descriptorsRef = useRef<FaceDescriptorEntry[]>([]);
  const processTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loopKey, setLoopKey] = useState(0);

  useEffect(() => {
    (async () => {
      const { granted } = permission?.granted ? permission : await requestPermission();
      if (!granted) { setScanState('no-permission'); return; }

      if (isVerifyMode && pendingStaffId) {
        // Only need this staff's descriptor
        try {
          const staff = await fetchStaff(pendingStaffId);
          if (staff.face_descriptor) {
            descriptorsRef.current = [{ staff_id: pendingStaffId, descriptor: staff.face_descriptor }];
          }
        } catch { /* no descriptor — will skip face matching, just capture */ }
      } else {
        fetchDescriptors().then((d) => { descriptorsRef.current = d; }).catch(() => {});
      }
    })();
  }, []);

  // Capture loop
  useEffect(() => {
    if (!modelsReadyRef.current) return;
    const interval = setInterval(() => {
      if (!processingRef.current && modelsReadyRef.current && attemptsRef.current < MAX_ATTEMPTS) {
        doCapture();
      }
    }, CAPTURE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loopKey]);

  const clearProcessTimeout = () => {
    if (processTimeout.current) { clearTimeout(processTimeout.current); processTimeout.current = null; }
  };

  const doCapture = async () => {
    if (processingRef.current || !cameraRef.current || !modelsReadyRef.current || attemptsRef.current >= MAX_ATTEMPTS) return;
    processingRef.current = true;
    setScanState('capturing');

    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.15, exif: false });
      if (!photo?.base64) { processingRef.current = false; setScanState('ready'); return; }

      setScanState('processing');
      processTimeout.current = setTimeout(() => {
        if (processingRef.current) {
          processingRef.current = false;
          attemptsRef.current += 1;
          setScanState(attemptsRef.current >= MAX_ATTEMPTS ? 'no-match' : 'ready');
        }
      }, PROCESS_TIMEOUT_MS);

      processorRef.current?.processImage(photo.base64);
    } catch {
      processingRef.current = false;
      setScanState('ready');
    }
  };

  const handleModelsReady = useCallback(() => {
    modelsReadyRef.current = true;
    setScanState('ready');
    setLoopKey((k) => k + 1);
  }, []);

  const handleNoFace = useCallback(() => {
    clearProcessTimeout();
    processingRef.current = false;
    attemptsRef.current += 1;
    setScanState(attemptsRef.current >= MAX_ATTEMPTS ? 'no-match' : 'ready');
  }, []);

  const handleError = useCallback((message: string) => {
    clearProcessTimeout();
    processingRef.current = false;
    setWebViewError(message);
    attemptsRef.current += 1;
    setScanState(attemptsRef.current >= MAX_ATTEMPTS ? 'no-match' : 'ready');
  }, []);

  const handleDescriptor = useCallback(
    async (descriptor: number[]) => {
      clearProcessTimeout();
      processingRef.current = false;

      if (isVerifyMode && pendingStaffId) {
        // Verify mode — face captured, look up the name to show it
        try {
          const staff = await fetchStaff(pendingStaffId);
          setScanState('recognised');
          setMatchedStaff({ staffId: pendingStaffId, staffName: staff.full_name, confidence: 100 });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.spring(buttonAnim, { toValue: 1, useNativeDriver: false }).start();
        } catch {
          // Couldn't fetch name — still proceed
          setScanState('recognised');
          setMatchedStaff({ staffId: pendingStaffId, staffName: '', confidence: 100 });
          Animated.spring(buttonAnim, { toValue: 1, useNativeDriver: false }).start();
        }
        return;
      }

      const match = matchDescriptor(descriptor, descriptorsRef.current);
      if (!match) {
        attemptsRef.current += 1;
        setScanState(attemptsRef.current >= MAX_ATTEMPTS ? 'no-match' : 'ready');
        return;
      }

      // Face matched — fetch name to show before clock-in
      try {
        const staff = await fetchStaff(match.staffId);
        setScanState('recognised');
        setMatchedStaff({ staffId: match.staffId, staffName: staff.full_name, confidence: match.confidence });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.spring(buttonAnim, { toValue: 1, useNativeDriver: false }).start();
      } catch {
        attemptsRef.current += 1;
        setScanState(attemptsRef.current >= MAX_ATTEMPTS ? 'no-match' : 'ready');
      }
    },
    [isVerifyMode, pendingStaffId, buttonAnim],
  );

  const handleClockIn = useCallback(async () => {
    if (!matchedStaff) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { staff, eventType, isLate } = await resolveClockIn(matchedStaff.staffId, coords);
      navigation.replace('Confirmation', {
        staffId:        matchedStaff.staffId,
        staffName:      staff.full_name,
        department:     staff.department,
        branchName:     staff.branch_name ?? '',
        eventType,
        timestamp:      Date.now(),
        coords,
        isLate,
        faceVerified:   !isVerifyMode,
        faceConfidence: matchedStaff.confidence,
      });
    } catch (err: any) {
      const title =
        err instanceof LocationError   ? 'Not at Your Office'  :
        err instanceof ShiftError      ? 'Outside Shift Hours' :
        err instanceof DayCompleteError ? 'Day Complete'        : 'Error';
      Alert.alert(title, err.message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    }
  }, [matchedStaff, coords, isVerifyMode, navigation]);

  const buttonBg = buttonAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [colors.surfaceRaised, colors.accent],
  });
  const buttonBorder = buttonAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [colors.border, colors.accent],
  });

  if (scanState === 'no-permission') {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.center}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Camera Access Needed</Text>
          <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
            Enable camera permission in Settings to use facial recognition.
          </Text>
          <TouchableOpacity
            style={[styles.pill, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate('ManualID', { coords })}
          >
            <Text style={[styles.pillText, { color: colors.accentText }]}>Use Staff ID Instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isScanning = ['ready', 'capturing', 'processing'].includes(scanState);
  const statusLabel: Partial<Record<ScanState, string>> = {
    'requesting-permission': 'Requesting camera access...',
    'loading-models':        'Loading face recognition...',
    'ready':                 'Looking for your face...',
    'capturing':             'Scanning...',
    'processing':            'Checking...',
    'recognised':            isVerifyMode ? 'Face captured' : 'Face recognised',
    'no-match':              'No face recognised',
  };
  const dotColor =
    scanState === 'recognised' ? colors.accent :
    scanState === 'no-match'   ? '#888' :
    isScanning                 ? colors.warning : colors.textMuted;

  return (
    <View style={styles.container}>
      {permission?.granted && (
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
      )}

      <FaceProcessorWebView
        ref={processorRef}
        modelsUrl={MODELS_URL}
        faceApiUrl={FACE_API_URL}
        onReady={handleModelsReady}
        onDescriptor={handleDescriptor}
        onNoFace={handleNoFace}
        onError={handleError}
      />

      {(scanState === 'requesting-permission' || scanState === 'loading-models') && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#FFF" size="large" />
          <Text style={styles.loadingText}>{statusLabel[scanState]}</Text>
        </View>
      )}

      {/* WebView error — visible during testing so you know what's failing */}
      {webViewError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText} numberOfLines={3}>{webViewError}</Text>
        </View>
      ) : null}

      {/* Oval guide */}
      <View style={styles.ovalWrapper} pointerEvents="none">
        <View style={[styles.oval, { borderColor: dotColor }]} />
      </View>

      {/* Top bar */}
      <SafeAreaView style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.screenTitle}>
          {isVerifyMode ? 'Capture Face' : 'Facial Recognition'}
        </Text>
        <View style={{ width: 60 }} />
      </SafeAreaView>

      {/* Bottom controls */}
      <SafeAreaView style={styles.bottomBar} edges={['bottom']}>
        {/* Status pill */}
        <View style={styles.statusPill}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={styles.statusText}>{statusLabel[scanState] ?? ''}</Text>
        </View>

        {/* Recognised name card */}
        {scanState === 'recognised' && matchedStaff?.staffName ? (
          <View style={[styles.nameCard, { backgroundColor: 'rgba(0,0,0,0.65)', borderColor: colors.accent + '55' }]}>
            <Text style={[styles.nameCardLabel, { color: colors.textSecondary }]}>
              {isVerifyMode ? 'Clocking in as' : 'Face recognised'}
            </Text>
            <Text style={[styles.nameCardName, { color: '#FFFFFF' }]}>
              {matchedStaff.staffName}
            </Text>
            {!isVerifyMode && (
              <Text style={[styles.nameCardConfidence, { color: colors.accent }]}>
                {matchedStaff.confidence}% match
              </Text>
            )}
          </View>
        ) : null}

        {/* Clock-in confirm button */}
        <Animated.View style={[styles.clockBtnOuter, { borderColor: buttonBorder }]}>
          <TouchableOpacity
            style={styles.clockBtnInner}
            onPress={handleClockIn}
            disabled={scanState !== 'recognised'}
            activeOpacity={0.8}
          >
            <Animated.View style={[styles.clockBtnFill, { backgroundColor: buttonBg }]}>
              <Text style={[
                styles.clockBtnText,
                { color: scanState === 'recognised' ? '#FFF' : colors.textMuted },
              ]}>
                {scanState === 'recognised' ? 'Tap to Clock In' : 'Clock In'}
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>

        {/* Fallback — show prominently when no match, subtly when scanning */}
        {scanState === 'no-match' ? (
          <TouchableOpacity
            style={[styles.pill, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate('ManualID', { coords })}
          >
            <Text style={[styles.pillText, { color: colors.accentText }]}>
              Use Staff ID Instead
            </Text>
          </TouchableOpacity>
        ) : isScanning ? (
          <TouchableOpacity
            style={[styles.ghostPill, { borderColor: 'rgba(255,255,255,0.2)' }]}
            onPress={() => navigation.navigate('ManualID', { coords })}
          >
            <Text style={styles.ghostPillText}>Use Staff ID Instead</Text>
          </TouchableOpacity>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const OVAL_W = 240;
const OVAL_H = 310;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  errorTitle: { fontSize: font.xl, fontWeight: '600', textAlign: 'center' },
  errorBody:  { fontSize: font.md, textAlign: 'center', lineHeight: 24 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center', gap: spacing.md,
  },
  loadingText: { color: '#F0F0F0', fontSize: font.md },

  ovalWrapper: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  oval: { width: OVAL_W, height: OVAL_H, borderRadius: OVAL_W / 2, borderWidth: 2, backgroundColor: 'transparent' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  backBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  backText: { color: '#F0F0F0', fontSize: font.md },
  screenTitle: { color: '#F0F0F0', fontSize: font.md, fontWeight: '600' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl, gap: spacing.md,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: '#F0F0F0', fontSize: font.sm },

  errorBanner: {
    position: 'absolute',
    bottom: 200,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(200,0,0,0.85)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorBannerText: { color: '#FFF', fontSize: font.xs, lineHeight: 16 },

  nameCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  nameCardLabel: { fontSize: font.xs, letterSpacing: 1, textTransform: 'uppercase' },
  nameCardName:  { fontSize: font.xl, fontWeight: '600' },
  nameCardConfidence: { fontSize: font.sm, fontWeight: '500' },

  // Clock-in button
  clockBtnOuter: {
    width: 180, height: 56,
    borderRadius: radius.full,
    borderWidth: 2,
    overflow: 'hidden',
  },
  clockBtnInner: { flex: 1 },
  clockBtnFill: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.full,
  },
  clockBtnText: { fontSize: font.md, fontWeight: '700', letterSpacing: 0.5 },

  pill: {
    borderRadius: radius.full, paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl, alignItems: 'center',
  },
  pillText: { fontSize: font.md, fontWeight: '700' },

  ghostPill: {
    borderRadius: radius.full, borderWidth: 1,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg,
  },
  ghostPillText: { color: 'rgba(255,255,255,0.5)', fontSize: font.sm },
});
