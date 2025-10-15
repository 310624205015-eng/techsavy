import { supabase } from '../lib/supabase';
import { appendRegistration } from '../../utils/sheets';
import { Database } from '../../../types/supabase';

type Tables = Database['public']['Tables'];
type Registration = Tables['registrations']['Row'];
type Event = Tables['events']['Row'];
type ProblemStatement = Tables['problem_statements']['Row'];

export function useAppendSheetSync() {
  const appendToSheet = async (registrationId: string): Promise<{ success: boolean; error?: any }> => {
    try {
      // fetch registration with related event and problem
      const { data: reg, error } = await supabase
        .from('registrations')
        .select('*, event_id, problem_statement_id')
        .eq('id', registrationId)
        .single() as { data: Registration | null; error: any };
      if (error || !reg) throw error || new Error('Registration not found');

      // fetch event and problem statement
      const eventResult = await supabase
        .from('events')
        .select('id, name, sheet_id')
        .eq('id', reg.event_id)
        .single() as { data: Event | null; error: any };

      const problemResult = await supabase
        .from('problem_statements')
        .select('id, title')
        .eq('id', reg.problem_statement_id)
        .single() as { data: ProblemStatement | null; error: any };
      
      if (!eventResult.data || eventResult.error) throw new Error('Event not found');
      if (!problemResult.data || problemResult.error) throw new Error('Problem statement not found');

      const event = eventResult.data;
      const problem = problemResult.data;

      if (!event.sheet_id) throw new Error('Event spreadsheet not found');

      // Always append to sheet
      await appendRegistration(
        event.sheet_id,
        problem.title || `Problem-${problem.id}`,
        {
          ...reg,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      );
      return { success: true };
    } catch (error) {
      console.error('Error appending to sheet:', error);
      return { success: false, error };
    }
  };

  return { appendToSheet };
}