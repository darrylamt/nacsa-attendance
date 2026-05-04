import { FaceDescriptorEntry } from '../types';

/**
 * Euclidean distance between two 128-d face descriptor vectors.
 * Identical to the distance face-api.js uses — vectors from the web
 * portal are directly comparable here.
 * Threshold: < 0.5 = same person (face-api.js uses 0.6; we're slightly stricter).
 */
// face-api.js default is 0.6. Use the same value so enrolled descriptors
// from the web portal match at the same rate as on the web.
const MATCH_THRESHOLD = 0.6;

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export interface FaceMatchResult {
  staffId: string;
  distance: number;
  confidence: number; // 0-100, stored in face_confidence DB column
}

/**
 * Compare a captured descriptor against all enrolled descriptors.
 * Returns the best match if it's within the threshold, otherwise null.
 */
export function matchDescriptor(
  captured: number[],
  enrolled: FaceDescriptorEntry[],
): FaceMatchResult | null {
  let best: FaceMatchResult | null = null;

  for (const entry of enrolled) {
    if (entry.descriptor.length !== captured.length) continue;

    const dist = euclideanDistance(captured, entry.descriptor);
    if (dist < MATCH_THRESHOLD && (!best || dist < best.distance)) {
      // Convert distance to a 0-100 confidence score
      const confidence = Math.round((1 - dist / MATCH_THRESHOLD) * 100);
      best = { staffId: entry.staff_id, distance: dist, confidence };
    }
  }

  return best;
}
