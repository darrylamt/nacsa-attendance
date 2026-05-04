import { Coords } from '../types';

/** Haversine distance between two coordinates in metres. */
export function haversineDistance(a: Coords, b: Coords): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude  - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      sinLon * sinLon;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** True if device coords are within the branch allowed radius. */
export function isWithinRadius(
  device: Coords,
  branch: Coords,
  radiusMetres: number,
): boolean {
  return haversineDistance(device, branch) <= radiusMetres;
}

/** True if current time falls within shift_start → shift_end (HH:MM:SS strings). */
export function isWithinShift(shiftStart: string, shiftEnd: string): boolean {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= toMins(shiftStart) && nowMins <= toMins(shiftEnd);
}

/** True if the current time is past shift_late — marks the clock-in as late. */
export function checkIsLate(shiftLate: string): boolean {
  const [h, m] = shiftLate.split(':').map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() > h * 60 + m;
}

/** Human-readable distance string, e.g. "142 m" or "1.4 km". */
export function formatDistance(metres: number): string {
  return metres < 1000
    ? `${Math.round(metres)} m`
    : `${(metres / 1000).toFixed(1)} km`;
}
