import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Event = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  max_team_size: number;
  registration_deadline?: string;
  sheet_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type ProblemStatement = {
  id: string;
  event_id: string;
  title: string;
  description: string;
  sheet_tab_name?: string | null;
  created_at: string;
};

export type Registration = {
  id: string;
  event_id: string;
  problem_statement_id: string;
  team_name: string;
  college_name: string;
  contact_number: string;
  email: string;
  team_size: number;
  team_members: string[];
  is_locked: boolean;
  reg_code: string;
  created_at: string;
  updated_at: string;
};
