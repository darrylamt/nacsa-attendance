export type ClockEventType =
  | 'clock-in-arrival'
  | 'clock-out-lunch'
  | 'clock-in-lunch'
  | 'clock-out-eod';

export interface ClockEvent {
  id: string;
  staffId: string;
  staffName: string;
  type: ClockEventType;
  timestamp: number;
}

export interface Coords {
  latitude: number;
  longitude: number;
}

export interface StaffProfile {
  staff_id: string;
  full_name: string;
  department: string;
  face_descriptor: number[] | null;
  branch_name: string | null;
  branch_lat: number | null;
  branch_lng: number | null;
  allowed_radius: number;
  shift_start: string;
  shift_end: string;
  shift_late: string;
}

export interface AttendanceRow {
  id: number;
  clock_in_time: string;
  clockout_time: string | null;
}

export interface FaceDescriptorEntry {
  staff_id: string;
  descriptor: number[];
}

export type RootStackParamList = {
  Home: undefined;
  NotificationSettings: undefined;
  // pendingStaffId: set when coming from ManualID — camera verifies face for that specific staff
  Camera: { coords: Coords; pendingStaffId?: string };
  ManualID: { coords: Coords };
  Confirmation: {
    staffId: string;
    staffName: string;
    department: string;
    branchName: string;
    eventType: ClockEventType;
    timestamp: number;
    coords: Coords;
    isLate: boolean;
    faceVerified: boolean;
    faceConfidence: number;
  };
};

export const CLOCK_EVENT_LABELS: Record<ClockEventType, string> = {
  'clock-in-arrival':  'Clock In',
  'clock-out-lunch':   'Clock Out (Lunch)',
  'clock-in-lunch':    'Clock In (Lunch Return)',
  'clock-out-eod':     'Clock Out',
};

export interface NotificationSetting {
  type: ClockEventType;
  enabled: boolean;
  time: string; // "HH:MM"
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSetting[] = [
  { type: 'clock-in-arrival',  enabled: true, time: '08:45' },
  { type: 'clock-out-lunch',   enabled: true, time: '12:30' },
  { type: 'clock-in-lunch',    enabled: true, time: '13:30' },
  { type: 'clock-out-eod',     enabled: true, time: '16:45' },
];

export const CLOCK_EVENT_ICONS: Record<ClockEventType, string> = {
  'clock-in-arrival':  '→',
  'clock-out-lunch':   '⏸',
  'clock-in-lunch':    '▶',
  'clock-out-eod':     '■',
};
