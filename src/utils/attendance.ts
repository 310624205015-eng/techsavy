import { supabase } from '../lib/supabase';

export async function getAttendanceLink(regCode: string): Promise<string> {
  const { data, error } = await supabase
    .rpc('get_team_attendance_url', { reg_code: regCode });

  if (error) throw error;
  
  // Get the current domain and construct the full URL
  const baseDomain = window.location.origin;
  return `${baseDomain}${data}`;
}

export async function copyAttendanceLink(regCode: string): Promise<void> {
  try {
    const link = await getAttendanceLink(regCode);
    await navigator.clipboard.writeText(link);
  } catch (error) {
    console.error('Error copying attendance link:', error);
    throw error;
  }
}