import { fetchStaff, fetchTodayAttendance } from '../services/api';
import { ClockEventType, Coords, StaffProfile, AttendanceRow } from '../types';
import { isWithinRadius, isWithinShift, checkIsLate, haversineDistance, formatDistance } from './locationCheck';

export interface ClockInContext {
  staff: StaffProfile;
  eventType: ClockEventType;
  isLate: boolean;
}

export class LocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationError';
  }
}

export class ShiftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShiftError';
  }
}

export class DayCompleteError extends Error {
  constructor(firstName: string) {
    super(`${firstName}, all clock events for today have already been recorded.`);
    this.name = 'DayCompleteError';
  }
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0];
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Derive next clock event type from today's DB attendance rows. */
export function deriveEventType(rows: AttendanceRow[]): ClockEventType | null {
  const openRow    = rows.find((r) => !r.clockout_time);
  const closedRows = rows.filter((r) => !!r.clockout_time);

  if (rows.length === 0)                    return 'clock-in-arrival';
  if (openRow   && closedRows.length === 0) return 'clock-out-lunch';
  if (!openRow  && closedRows.length === 1) return 'clock-in-lunch';
  if (openRow   && closedRows.length === 1) return 'clock-out-eod';

  return null; // day complete
}

export async function resolveClockIn(
  staffId: string,
  coords: Coords,
): Promise<ClockInContext> {
  const staff = await fetchStaff(staffId);
  const name  = firstName(staff.full_name);

  // Location check first
  if (staff.branch_lat !== null && staff.branch_lng !== null) {
    const branchCoords = { latitude: staff.branch_lat, longitude: staff.branch_lng };
    if (!isWithinRadius(coords, branchCoords, staff.allowed_radius)) {
      const dist = formatDistance(haversineDistance(coords, branchCoords));
      throw new LocationError(
        `${name}, you need to be at ${staff.branch_name ?? 'your office'} to clock in.\n\nYou're currently ${dist} away.`,
      );
    }
  }

  // Shift time check second
  if (staff.shift_start && staff.shift_end) {
    if (!isWithinShift(staff.shift_start, staff.shift_end)) {
      const start = staff.shift_start.slice(0, 5);
      const end   = staff.shift_end.slice(0, 5);
      throw new ShiftError(
        `${greeting()}, ${name}. Clocking is only available between ${start} and ${end}.`,
      );
    }
  }

  // Derive next event
  const todayRows  = await fetchTodayAttendance(staffId);
  const eventType  = deriveEventType(todayRows);

  if (!eventType) {
    throw new DayCompleteError(name);
  }

  const isLate = eventType === 'clock-in-arrival' ? checkIsLate(staff.shift_late) : false;

  return { staff, eventType, isLate };
}
