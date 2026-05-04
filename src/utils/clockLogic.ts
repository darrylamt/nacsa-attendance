import { ClockEvent, ClockEventType } from '../types';

const SEQUENCE: ClockEventType[] = [
  'clock-in-arrival',
  'clock-out-lunch',
  'clock-in-lunch',
  'clock-out-eod',
];

export function getNextEventType(todayEvents: ClockEvent[]): ClockEventType {
  if (todayEvents.length === 0) return 'clock-in-arrival';

  const last = todayEvents[todayEvents.length - 1];
  const lastIdx = SEQUENCE.indexOf(last.type);

  // Cycle completed — start new day pattern from arrival
  if (lastIdx === SEQUENCE.length - 1 || lastIdx === -1) return 'clock-in-arrival';

  return SEQUENCE[lastIdx + 1];
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
