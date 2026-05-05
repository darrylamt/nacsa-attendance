import { API_BASE, API_KEY } from '../config';
import { StaffProfile, AttendanceRow, FaceDescriptorEntry, ClockEventType, Coords } from '../types';
import { cacheDescriptors, getCachedDescriptors } from '../utils/storage';

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(options.headers ?? {}),
    },
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }

  return json;
}

export async function fetchStaff(staffId: string): Promise<StaffProfile> {
  const res = await request<{ success: boolean; data: StaffProfile }>(
    `?action=staff&staff_id=${encodeURIComponent(staffId)}`,
  );
  return res.data;
}

export async function fetchTodayAttendance(staffId: string): Promise<AttendanceRow[]> {
  const res = await request<{ success: boolean; data: AttendanceRow[] }>(
    `?action=today&staff_id=${encodeURIComponent(staffId)}`,
  );
  return res.data;
}

export async function fetchDescriptors(): Promise<FaceDescriptorEntry[]> {
  try {
    const res = await request<{ success: boolean; data: FaceDescriptorEntry[] }>(
      `?action=descriptors`,
    );
    // Cache for offline use
    cacheDescriptors(res.data).catch(() => {});
    return res.data;
  } catch {
    // Offline — return cached descriptors
    return getCachedDescriptors();
  }
}

export interface ClockPayload {
  staff_id: string;
  event_type: ClockEventType;
  latitude: number | null;
  longitude: number | null;
  face_verified: 0 | 1;
  face_confidence: number;
  is_late: 0 | 1;
}

export interface ClockResponse {
  success: boolean;
  test_mode?: boolean;
  message?: string;
  id?: number;
  rows_updated?: number;
}

export async function postClockEvent(payload: ClockPayload): Promise<ClockResponse> {
  return request<ClockResponse>('?action=clock', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
