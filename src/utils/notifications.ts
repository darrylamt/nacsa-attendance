import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationSetting, DEFAULT_NOTIFICATION_SETTINGS, CLOCK_EVENT_LABELS, ClockEventType } from '../types';

const SETTINGS_KEY = 'nacsa:notif_settings';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getNotificationSettings(): Promise<NotificationSetting[]> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
  try {
    const saved: NotificationSetting[] = JSON.parse(raw);
    // Merge with defaults in case new event types were added
    return DEFAULT_NOTIFICATION_SETTINGS.map((def) => {
      const found = saved.find((s) => s.type === def.type);
      return found ?? def;
    });
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

export async function saveNotificationSettings(settings: NotificationSetting[]): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const NOTIF_BODY: Record<ClockEventType, (name: string) => string> = {
  'clock-in-arrival':  (n) => `Good morning ${n}, time to clock in for the day.`,
  'clock-out-lunch':   (n) => `${n}, time to clock out for your lunch break.`,
  'clock-in-lunch':    (n) => `${n}, lunch is over — don't forget to clock back in.`,
  'clock-out-eod':     (n) => `${n}, it's almost end of day — remember to clock out.`,
};

/**
 * Schedule daily repeating notifications for all enabled event types.
 * Called once when the user saves their settings.
 * Uses the staff's first name for personalised messages.
 */
export async function applyNotificationSettings(
  settings: NotificationSetting[],
  firstName: string,
): Promise<void> {
  // Cancel all existing scheduled notifications first
  await Notifications.cancelAllScheduledNotificationsAsync();

  const granted = await requestNotificationPermission();
  if (!granted) return;

  for (const setting of settings) {
    if (!setting.enabled) continue;

    const [h, m] = setting.time.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: CLOCK_EVENT_LABELS[setting.type],
        body:  NOTIF_BODY[setting.type](firstName),
        data:  { type: setting.type },
      },
      trigger: {
        type:    Notifications.SchedulableTriggerInputTypes.DAILY,
        hour:    h,
        minute:  m,
      },
    });
  }
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
