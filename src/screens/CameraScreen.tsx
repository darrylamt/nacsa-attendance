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
import { rs, rf } from '../utils/responsive';
import { isCacheReady, downloadModels, getCachedHtmlUri } from '../services/modelCache';

type Props = NativeStackScreenProps<RootStackParamList, 'Camera'>;

type ScanState =
  | 'requesting-permission'
  | 'loading-models'
  | 'idle'           // models ready, waiting for user tap
  | 'processing'     // photo taken, face-api.js working
  | 'recognised'
  | 'no-match'
  | 'no-permission';

export function CameraScreen({ navigation, route }: Props) {
  const colors = useColors();
  const { coords, pendingStaffId } = route.params;
  const isVerifyMode = !!pendingStaffId;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState]         = useState<ScanState>('requesting-permission');
  const [webViewError, setWebViewError]   = useState<string | null>(null);
  const [localCacheUri, setLocalCacheUri] = useState<string | null>(null);
  const [downloadPct, setDownloadPct]     = useState<number>(0);
  const [matchedStaff, setMatchedStaff]   = useState<{
    staffId: string;
    staffName: string;
    confidence: number;
  } | null>(null);

  const buttonAnim    = useRef(new Animated.Value(0)).current;
  const cameraRef     = useRef<CameraView>(null);
  const processorRef  = useRef<FaceProcessorRef>(null);
  const processingRef = useRef(false);
  const descriptorsRef = useRef<FaceDescriptorEntry[]>([]);

  useEffect(() => {
    (async () => {
      const { granted } = permission?.granted ? permission : await requestPermission();
      if (!granted) { setScanState('no-permission'); return; }

      // Check local model cache — download if missing
      const cached = await isCacheReady();
      if (cached) {
        setLocalCacheUri(getCachedHtmlUri());
      } else {
        setScanState('loading-models');
        try {
          await downloadModels(FACE_API_URL, MODELS_URL, setDownloadPct);
          setLocalCacheUri(getCachedHtmlUri());
        } catch {
          // Download failed (offline on first run) — use remote HTML
          setLocalCacheUri(null);
        }
      }

      if (isVerifyMode && pendingStaffId) {
        try {
          const staff = await fetchStaff(pendingStaffId);
          if (staff.face_descriptor) {
            descriptorsRef.current = [{ staff_id: pendingStaffId, descriptor: staff.face_descriptor }];
          }
        } catch { /* no descriptor — any face accepted */ }
      } else {
        fetchDescriptors().then((d) => { descriptorsRef.current = d; }).catch(() => {});
      }
    })();
  }, []);

  const handleModelsReady = useCallback(() => {
    setScanState('idle');
  }, []);

  const handleScan = useCallback(async () => {
    if (processingRef.current || !cameraRef.current) return;
    // Allow scan from idle OR no-match (Try Again)
    if (scanState !== 'idle' && scanState !== 'no-match') return;
    if (scanState === 'no-match') setScanState('idle');
    processingRef.current = true;
    setScanState('processing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.2,
        exif: false,
        skipProcessing: true,   // suppress visual capture flash
      });
      if (photo?.base64) {
        processorRef.current?.processImage(photo.base64);
      } else {
        processingRef.current = false;
        setScanState('idle');
      }
    } catch {
      processingRef.current = false;
      setScanState('idle');
    }
  }, [scanState]);

  const handleNoFace = useCallback(() => {
    processingRef.current = false;
    setScanState('no-match');
  }, []);

  const handleError = useCallback((message: string) => {
    processingRef.current = false;
    setWebViewError(message);
    setScanState('idle');
  }, []);

  const handleDescriptor = useCallback(
    async (descriptor: number[]) => {
      processingRef.current = false;

      if (isVerifyMode && pendingStaffId) {
        try {
          const staff = await fetchStaff(pendingStaffId);
          setScanState('recognised');
          setMatchedStaff({ staffId: pendingStaffId, staffName: staff.full_name, confidence: 100 });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.spring(buttonAnim, { toValue: 1, useNativeDriver: false }).start();
        } catch {
          setScanState('recognised');
          setMatchedStaff({ staffId: pendingStaffId, staffName: '', confidence: 100 });
          Animated.spring(buttonAnim, { toValue: 1, useNativeDriver: false }).start();
        }
        return;
      }

      const match = matchDescriptor(descriptor, descriptorsRef.current);
      if (!match) {
        setScanState('no-match');
        return;
      }

      try {
        const staff = await fetchStaff(match.staffId);
        setScanState('recognised');
        setMatchedStaff({ staffId: match.staffId, staffName: staff.full_name, confidence: match.confidence });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Animated.spring(buttonAnim, { toValue: 1, useNativeDriver: false }).start();
      } catch {
        setScanState('no-match');
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
        err instanceof LocationError    ? 'Not at Your Office'  :
        err instanceof ShiftError       ? 'Outside Shift Hours' :
        err instanceof DayCompleteError ? 'Day Complete'        : 'Error';
      Alert.alert(title, err.message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    }
  }, [matchedStaff, coords, isVerifyMode, navigation]);

  const buttonBg = buttonAnim.interpolate({
    inputRange: [0, 1], outputRange: [colors.surfaceRaised, colors.accent],
  });
  const buttonBorderColor = buttonAnim.interpolate({
    inputRange: [0, 1], outputRange: [colors.border, colors.accent],
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

  const isScanning   = scanState === 'idle' || scanState === 'no-match';
  const isProcessing = scanState === 'processing' || scanState === 'loading-models' || scanState === 'requesting-permission';

  const statusLabel: Partial<Record<ScanState, string>> = {
    'requesting-permission': 'Starting camera...',
    'loading-models':        'Loading face recognition...',
    'idle':                  'Centre your face then tap Scan',
    'processing':            'Checking...',
    'recognised':            isVerifyMode ? 'Face captured' : 'Face recognised',
    'no-match':              'No face recognised — try again',
  };

  const dotColor =
    scanState === 'recognised' ? colors.accent :
    scanState === 'no-match'   ? colors.error  :
    isProcessing               ? colors.warning : 'rgba(255,255,255,0.4)';

  return (
    <View style={styles.container}>
      {permission?.granted && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
        />
      )}

      {/* Hidden face-api.js processor — off-screen, NOT opacity:0 */}
      <FaceProcessorWebView
        ref={processorRef}
        localCacheUri={localCacheUri}
        modelsUrl={MODELS_URL}
        faceApiUrl={FACE_API_URL}
        onReady={handleModelsReady}
        onDescriptor={handleDescriptor}
        onNoFace={handleNoFace}
        onError={handleError}
      />

      {/* Loading overlay */}
      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#FFF" size="large" />
          <Text style={styles.loadingText}>{statusLabel[scanState]}</Text>
          {scanState === 'loading-models' && downloadPct > 0 && downloadPct < 1 && (
            <>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(downloadPct * 100)}%` as any }]} />
              </View>
              <Text style={styles.progressText}>
                {Math.round(downloadPct * 100)}% — one-time download
              </Text>
            </>
          )}
        </View>
      )}

      {/* WebView error banner */}
      {webViewError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText} numberOfLines={2}>{webViewError}</Text>
        </View>
      ) : null}

      {/* Face oval */}
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

        {/* Lens tip */}
        {(scanState === 'idle' || scanState === 'no-match') && (
          <View style={styles.tipPill}>
            <Text style={styles.tipText}>
              Wipe your front camera clean before scanning
            </Text>
          </View>
        )}

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
            <Text style={[styles.nameCardName, { color: '#FFF' }]}>{matchedStaff.staffName}</Text>
            {!isVerifyMode && (
              <Text style={[styles.nameCardConfidence, { color: colors.accent }]}>
                {matchedStaff.confidence}% match
              </Text>
            )}
          </View>
        ) : null}

        {/* Scan button (idle/no-match) or Clock In button (recognised) */}
        {scanState === 'recognised' ? (
          <Animated.View style={[styles.actionBtnOuter, { borderColor: buttonBorderColor }]}>
            <TouchableOpacity style={styles.actionBtnInner} onPress={handleClockIn} activeOpacity={0.8}>
              <Animated.View style={[styles.actionBtnFill, { backgroundColor: buttonBg }]}>
                <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Tap to Clock In</Text>
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <TouchableOpacity
            style={[
              styles.scanBtn,
              { backgroundColor: isScanning ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                borderColor: isScanning ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)' },
            ]}
            onPress={handleScan}
            disabled={!isScanning}
            activeOpacity={0.7}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={[styles.scanBtnText, { color: isScanning ? '#FFF' : 'rgba(255,255,255,0.4)' }]}>
                {scanState === 'no-match' ? 'Try Again' : 'Scan'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Manual ID fallback */}
        <TouchableOpacity
          style={styles.ghostPill}
          onPress={() => navigation.navigate('ManualID', { coords })}
        >
          <Text style={styles.ghostPillText}>Use Staff ID Instead</Text>
        </TouchableOpacity>

      </SafeAreaView>
    </View>
  );
}

const OVAL_W = rs(220);
const OVAL_H = rs(290);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D' },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  errorTitle: { fontSize: rf(font.xl), fontWeight: '600', textAlign: 'center' },
  errorBody:  { fontSize: rf(font.md), textAlign: 'center', lineHeight: rs(24) },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center', justifyContent: 'center', gap: spacing.md,
  },
  loadingText: { color: '#F0F0F0', fontSize: rf(font.md) },
  progressTrack: {
    width: rs(200), height: 4, backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FFF', borderRadius: 2 },
  progressText: { color: 'rgba(255,255,255,0.6)', fontSize: rf(font.xs) },

  errorBanner: {
    position: 'absolute', bottom: rs(200), left: spacing.lg, right: spacing.lg,
    backgroundColor: 'rgba(200,0,0,0.85)', borderRadius: radius.md, padding: spacing.md,
  },
  errorBannerText: { color: '#FFF', fontSize: rf(font.xs), lineHeight: rs(16) },

  ovalWrapper: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  oval: { width: OVAL_W, height: OVAL_H, borderRadius: OVAL_W / 2, borderWidth: 2, backgroundColor: 'transparent' },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
  },
  backBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  backText: { color: '#F0F0F0', fontSize: rf(font.md) },
  screenTitle: { color: '#F0F0F0', fontSize: rf(font.md), fontWeight: '600' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingHorizontal: spacing.xl,
    paddingBottom: rs(32), gap: spacing.md,
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  statusDot:  { width: rs(8), height: rs(8), borderRadius: rs(4) },
  statusText: { color: '#F0F0F0', fontSize: rf(font.sm) },

  nameCard: {
    borderWidth: 1, borderRadius: radius.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    alignItems: 'center', gap: 2, width: '100%',
  },
  nameCardLabel:      { fontSize: rf(font.xs), letterSpacing: 1, textTransform: 'uppercase' },
  nameCardName:       { fontSize: rf(font.xl), fontWeight: '600' },
  nameCardConfidence: { fontSize: rf(font.sm), fontWeight: '500' },

  actionBtnOuter: { width: rs(180), height: rs(52), borderRadius: radius.full, borderWidth: 2, overflow: 'hidden' },
  actionBtnInner: { flex: 1 },
  actionBtnFill:  { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  actionBtnText:  { fontSize: rf(font.md), fontWeight: '700', letterSpacing: 0.5 },

  scanBtn: {
    width: rs(120), height: rs(52), borderRadius: radius.full,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  scanBtnText: { fontSize: rf(font.md), fontWeight: '600', letterSpacing: 1 },

  pill: { borderRadius: radius.full, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center' },
  pillText: { fontSize: rf(font.md), fontWeight: '700' },

  tipPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.full,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  tipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: rf(font.xs),
    textAlign: 'center',
  },

  ghostPill: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  ghostPillText: { color: 'rgba(255,255,255,0.4)', fontSize: rf(font.sm) },
});
