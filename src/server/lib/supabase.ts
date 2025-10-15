import { createClient } from '@supabase/supabase-js';
import { Database } from '../../../types/supabase';

const supabaseUrl = process.env.VITE_SUPABASE_URL as string;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export type Event = Database['public']['Tables']['events']['Row'];
export type ProblemStatement = Database['public']['Tables']['problem_statements']['Row'];
export type Registration = Database['public']['Tables']['registrations']['Row'];