import { useState, useCallback } from 'react';
import { syncManager } from '../lib/syncManager';

export function useSheetSync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsert = useCallback(async (registrationId: string) => {
    setSyncing(true);
    setError(null);
    try {
      await syncManager.upsertRegistration(registrationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync with sheet');
      console.error('Sheet sync error:', err);
    } finally {
      setSyncing(false);
    }
  }, []);

  const ensureEvent = useCallback(async (eventId: string) => {
    try {
      await syncManager.ensureEventSpreadsheet(eventId);
    } catch (err) {
      console.error('ensureEvent error:', err);
      throw err;
    }
  }, []);

  const ensureTab = useCallback(async (eventId: string, psId: string) => {
    try {
      await syncManager.ensureProblemTab(eventId, psId);
    } catch (err) {
      console.error('ensureTab error:', err);
      throw err;
    }
  }, []);

  return { upsert, syncing, error, ensureEvent, ensureTab };
}