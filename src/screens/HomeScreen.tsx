import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useColors, font, spacing, radius } from '../theme/colors';
import { rs, rf } from '../utils/responsive';
import { RootStackParamList } from '../types';
import { formatDate } from '../utils/clockLogic';
import { useOfflineSync } from '../hooks/useOfflineSync';
import NetInfo from '@react-native-community/netinfo';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const colors = useColors();
  const [time, setTime]       = useState(new Date());
  const [locating, setLocating] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const { pendingCount, syncing, syncQueue, refreshCount } = useOfflineSync();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!(state.isConnected && state.isInternetReachable));
    });
    return unsubscribe;
  }, []);

  useFocusEffect(useCallback(() => { refreshCount(); }, [refreshCount]));

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClockIn = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Location access is needed to verify you are at your office. Please enable it in Settings.',
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      navigation.navigate('Camera', {
        coords: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        },
      });
    } catch {
      Alert.alert('Location Error', 'Could not get your location. Please try again.');
    } finally {
      setLocating(false);
    }
  };

  const handleManualID = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Location access is needed to verify you are at your office.',
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      navigation.navigate('ManualID', {
        coords: {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        },
      });
    } catch {
      Alert.alert('Location Error', 'Could not get your location. Please try again.');
    } finally {
      setLocating(false);
    }
  };

  const hm = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const secs = String(time.getSeconds()).padStart(2, '0');
  const [hmMain, ampm] = hm.split(' ');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={colors.bg === '#FFFFFF' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.bg}
      />

      <View style={styles.container}>
        {/* Offline banner */}
        {!isOnline && (
          <View style={[styles.offlineBanner, { backgroundColor: colors.warning + '22', borderColor: colors.warning + '55' }]}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.warning} />
            <Text style={[styles.offlineText, { color: colors.warning }]}>
              You're offline — clock-in unavailable
            </Text>
          </View>
        )}

        <View style={styles.headerRow}>
          <View style={{ width: 40 }} />
          <View style={styles.header}>
          <Image
            source={require('../../LOGO_NACSA.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.orgFull, { color: colors.text }]}>
            National Commission on Small Arms{'\n'}and Light Weapons
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Staff Attendance
          </Text>
          </View>
          <TouchableOpacity
            style={[styles.bellBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate('NotificationSettings')}
          >
            <Ionicons name="notifications-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.clockBlock}>
          <View style={styles.timeRow}>
            <Text style={[styles.time, { color: colors.text }]}>{hmMain}</Text>
            <View style={styles.timeRight}>
              <Text style={[styles.secs, { color: colors.accent }]}>{secs}</Text>
              <Text style={[styles.ampm, { color: colors.textSecondary }]}>{ampm}</Text>
            </View>
          </View>
          <Text style={[styles.date, { color: colors.textSecondary }]}>
            {formatDate(time.getTime())}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.startButton,
              { backgroundColor: isOnline ? colors.accent : colors.textMuted },
            ]}
            onPress={isOnline ? handleClockIn : undefined}
            disabled={locating || !isOnline}
            activeOpacity={0.85}
          >
            {locating ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <Text style={[styles.startText, { color: colors.accentText }]}>
                Clock In
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.manualLink, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={handleManualID}
            disabled={locating}
          >
            <Text style={[styles.manualLinkText, { color: colors.textSecondary }]}>
              Use Staff ID
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          {pendingCount > 0 ? (
            <TouchableOpacity
              style={[styles.syncBadge, { backgroundColor: colors.info + '18', borderColor: colors.info + '55' }]}
              onPress={syncQueue}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={colors.info} />
              ) : (
                <View style={[styles.syncDot, { backgroundColor: colors.info }]} />
              )}
              <Text style={[styles.syncText, { color: colors.info }]}>
                {syncing
                  ? 'Syncing...'
                  : `${pendingCount} clock event${pendingCount > 1 ? 's' : ''} pending sync`}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              {locating ? 'Getting your location...' : 'Location is verified before clocking'}
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  offlineText: { fontSize: font.sm, fontWeight: '500' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  header: { alignItems: 'center', flex: 1 },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  logo: { width: 160, height: 60 },
  orgFull: {
    fontSize: rf(font.xs),
    fontWeight: '600',
    letterSpacing: 0.4,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: spacing.xs,
    lineHeight: rs(16),
  },
  subtitle: { fontSize: rf(font.sm), letterSpacing: 1, marginTop: spacing.xs },
  clockBlock: { alignItems: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  time: { fontSize: rf(68), fontWeight: '100', letterSpacing: -2, lineHeight: rf(76) },
  timeRight: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    paddingBottom: 8,
    gap: 2,
  },
  secs: { fontSize: rf(26), fontWeight: '200', letterSpacing: -1, lineHeight: rf(28) },
  ampm: { fontSize: rf(font.sm), fontWeight: '400', letterSpacing: 1 },
  date: { fontSize: rf(font.md), fontWeight: '300', marginTop: spacing.sm },
  actions: { gap: spacing.md, alignItems: 'center' },
  startButton: {
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    width: '100%',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  startText: { fontSize: font.lg, fontWeight: '700', letterSpacing: 0.5 },
  manualLink: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'center',
  },
  manualLinkText: { fontSize: font.sm, fontWeight: '500', letterSpacing: 0.3 },
  footer: { alignItems: 'center' },
  footerText: { fontSize: font.sm, letterSpacing: 0.5 },
  syncBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: 1, borderRadius: radius.full,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  syncText: { fontSize: font.sm, fontWeight: '500' },
});
