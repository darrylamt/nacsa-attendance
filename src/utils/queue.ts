import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClockPayload } from '../services/api';
import { ClockEventType } from '../types';

const QUEUE_KEY = 'nacsa:clock_queue';
const MAX_ATTEMPTS = 3;

export interface QueuedEvent {
  localId: string;
  payload: ClockPayload;
  staffName: string;
  eventType: ClockEventType;
  timestamp: number;
  queuedAt: number;
  attempts: number;
}

export async function enqueueEvent(
  event: Omit<QueuedEvent, 'queuedAt' | 'attempts'>,
): Promise<void> {
  const queue = await getQueue();
  queue.push({ ...event, queuedAt: Date.now(), attempts: 0 });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueue(): Promise<QueuedEvent[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function removeFromQueue(localId: string): Promise<void> {
  const queue = await getQueue();
  await AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(queue.filter((e) => e.localId !== localId)),
  );
}

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

export async function incrementAttempts(localId: string): Promise<void> {
  const queue = await getQueue();
  await AsyncStorage.setItem(
    QUEUE_KEY,
    JSON.stringify(
      queue.map((e) =>
        e.localId === localId ? { ...e, attempts: e.attempts + 1 } : e,
      ),
    ),
  );
}

export function isExpired(event: QueuedEvent): boolean {
  return event.attempts >= MAX_ATTEMPTS;
}

export function newLocalId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
