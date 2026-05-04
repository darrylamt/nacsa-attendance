import { useEffect, useState, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import {
  getQueue,
  removeFromQueue,
  incrementAttempts,
  isExpired,
  getPendingCount,
} from '../utils/queue';
import { postClockEvent } from '../services/api';

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  const syncQueue = useCallback(async () => {
    const queue = await getQueue();
    if (queue.length === 0) return;

    setSyncing(true);

    for (const event of queue) {
      if (isExpired(event)) {
        await removeFromQueue(event.localId);
        continue;
      }
      try {
        const res = await postClockEvent(event.payload);
        if (res.success) {
          await removeFromQueue(event.localId);
        } else {
          await incrementAttempts(event.localId);
        }
      } catch {
        await incrementAttempts(event.localId);
      }
    }

    setSyncing(false);
    await refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable) {
        syncQueue();
      }
    });

    return unsubscribe;
  }, [refreshCount, syncQueue]);

  return { pendingCount, syncing, syncQueue, refreshCount };
}
