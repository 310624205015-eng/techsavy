import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { upsertRegistration as appendToSheet } from '../utils/sheets';

export function useAppendSheetSync() {
  const [syncing, setSyncing] = useState(false);

  const appendRegistration = async (registration: any) => {
    setSyncing(true);
    try {
      // Get event and problem statement info
      const [eventRes, problemRes] = await Promise.all([
        supabase.from('events').select('id, name, sheet_id').eq('id', registration.event_id).single(),
        supabase.from('problem_statements').select('id, title').eq('id', registration.problem_statement_id).single()
      ]);

      if (eventRes.error) throw eventRes.error;
      if (problemRes.error) throw problemRes.error;

      const event = eventRes.data;
      const problem = problemRes.data;

      if (!event?.sheet_id) {
        throw new Error('Event spreadsheet not found');
      }

      // Always append to sheet
      const sheetRes = await appendToSheet(
        event.sheet_id,
        problem.title || `Problem-${problem.id}`,
        {
          ...registration,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      );

      return sheetRes;
    } finally {
      setSyncing(false);
    }
  };

  return {
    appendRegistration,
    syncing
  };
}