import { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { syncManager } from '../../lib/syncManager';
import { Database } from '../../../types/supabase';

type Registration = Database['public']['Tables']['registrations']['Row'];

export async function handleRegistration(req: Request, res: Response) {

  try {
    const registration = req.body;

    // Insert into Supabase
    const { data, error } = await supabase
      .from('registrations')
      .insert(registration)
      .select('*')
      .maybeSingle() as { data: Registration | null; error: any };

    if (error) {
      console.error('Failed to create registration:', error);
      return res.status(500).json({ error: error.message });
    }

    if (data) {
      // Append to sheet without replacing existing data
      try {
        await syncManager.upsertRegistration(data.id);
      } catch (sheetError) {
        console.error('Failed to sync to sheet:', sheetError);
        // Don't fail the request if sheet sync fails, just log it
      }

      return res.status(200).json({ 
        success: true, 
        registration: data 
      });
    }

    return res.status(400).json({ error: 'Failed to create registration' });
  } catch (err) {
    console.error('Registration handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}