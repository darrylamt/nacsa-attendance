import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClockEvent, StaffProfile } from '../types';

const KEYS = {
  CLOCK_EVENTS: 'nacsa:clock_events',
  STAFF_PROFILES: 'nacsa:staff_profiles',
};

export async function getClockEvents(): Promise<ClockEvent[]> {
  const raw = await AsyncStorage.getItem(KEYS.CLOCK_EVENTS);
  return raw ? JSON.parse(raw) : [];
}

export async function saveClockEvent(event: ClockEvent): Promise<void> {
  const events = await getClockEvents();
  events.push(event);
  await AsyncStorage.setItem(KEYS.CLOCK_EVENTS, JSON.stringify(events));
}

export async function getTodayEvents(staffId: string): Promise<ClockEvent[]> {
  const events = await getClockEvents();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return events.filter(
    (e) => e.staffId === staffId && e.timestamp >= startOfDay.getTime(),
  );
}

export async function getAllTodayEvents(): Promise<ClockEvent[]> {
  const events = await getClockEvents();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return events.filter((e) => e.timestamp >= startOfDay.getTime());
}

export async function getStaffProfiles(): Promise<StaffProfile[]> {
  const raw = await AsyncStorage.getItem(KEYS.STAFF_PROFILES);
  return raw ? JSON.parse(raw) : [];
}

export async function getStaffProfile(id: string): Promise<StaffProfile | null> {
  const profiles = await getStaffProfiles();
  return profiles.find((p) => p.id === id) ?? null;
}

export async function saveStaffProfile(profile: StaffProfile): Promise<void> {
  const profiles = await getStaffProfiles();
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) {
    profiles[idx] = profile;
  } else {
    profiles.push(profile);
  }
  await AsyncStorage.setItem(KEYS.STAFF_PROFILES, JSON.stringify(profiles));
}
