import { supabase } from './supabase';

type SheetResponse = {
  status: number;
  error?: string;
  spreadsheetId?: string;
  rowNumber?: number;
  reg_code?: string;
  success?: boolean;
  tabName?: string;
  updated?: boolean;
};

export class SyncManager {
  private static instance: SyncManager | null = null;
  private inProgress = new Map<string, boolean>();

  private constructor() {
    // Set up database subscription for real-time sync
    this.setupSubscriptions();
  }

  private async setupSubscriptions() {
    // Listen for event changes
    supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            try {
              await this.ensureEventSpreadsheet(payload.new.id);
            } catch (error) {
              console.error('Failed to sync event:', error);
            }
          }
        }
      )
      .subscribe();

    // Listen for problem statement changes
    supabase
      .channel('problems-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'problem_statements' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            try {
              await this.ensureProblemTab(payload.new.event_id, payload.new.id);
            } catch (error) {
              console.error('Failed to sync problem:', error);
            }
          }
        }
      )
      .subscribe();

    // Listen for registration changes
    supabase
      .channel('registrations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'registrations' },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            try {
              await this.syncRegistration(payload.new.id);
            } catch (error) {
              console.error('Failed to sync registration:', error);
            }
          }
        }
      )
      .subscribe();
  }

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  private key(prefix: string, id?: string): string {
    return `${prefix}:${id || 'global'}`;
  }

  private async postToSheet(action: string, data: any): Promise<SheetResponse> {
    const proxyPath = '/api/sheets';
    const res = await fetch(proxyPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });

    const response = await res.json();
    if (!res.ok || response.status >= 400) {
      throw new Error(response.error || 'Failed to sync with sheet');
    }
    return response;
  }

  /**
   * Ensures that an event has a spreadsheet created
   * Returns the spreadsheet ID
   */
  public async ensureEventSpreadsheet(eventId: string): Promise<string> {
    const k = this.key('ensureEvent', eventId);
    if (this.inProgress.get(k)) {
      throw new Error('Event sync already in progress');
    }
    this.inProgress.set(k, true);

    try {
      // Get event details
      const { data: event, error } = await supabase
        .from('events')
        .select('id, name, sheet_id')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      if (!event) throw new Error('Event not found');

      // If sheet_id exists, return it
      if (event.sheet_id) return event.sheet_id;

      // Create new spreadsheet via Apps Script
      const res = await this.postToSheet('syncEvent', {
        eventId: event.id
      });

      if (!res.spreadsheetId) throw new Error('Failed to create spreadsheet');

      return res.spreadsheetId;
    } finally {
      this.inProgress.delete(k);
    }
  }

  /**
   * Creates or updates a problem statement tab in the event's spreadsheet
   */
  public async ensureProblemTab(eventId: string, problemId: string): Promise<void> {
    const k = this.key('ensureProblem', `${eventId}-${problemId}`);
    if (this.inProgress.get(k)) {
      return; // Silently skip if already in progress
    }
    this.inProgress.set(k, true);

    try {
      await this.postToSheet('syncProblem', { eventId, problemId });
    } finally {
      this.inProgress.delete(k);
    }
  }

  /**
   * Syncs a single registration to Google Sheets
   */
  public async syncRegistration(registrationId: string): Promise<SheetResponse> {
    const k = this.key('syncReg', registrationId);
    if (this.inProgress.get(k)) {
      throw new Error('Sync already in progress for this registration');
    }
    this.inProgress.set(k, true);

    try {
      // Sync via Apps Script
      const response = await this.postToSheet('syncRegistration', {
        registrationId
      });

      return response;
    } finally {
      this.inProgress.delete(k);
    }
  }

  /**
   * Updates a single registration and syncs it
   */
  public async upsertRegistration(registrationId: string): Promise<void> {
    const k = this.key('upsertReg', registrationId);
    if (this.inProgress.get(k)) {
      throw new Error('Registration sync already in progress');
    }
    this.inProgress.set(k, true);

    try {
      // Sync registration via Apps Script
      await this.postToSheet('syncRegistration', { registrationId });
    } finally {
      this.inProgress.delete(k);
    }
  }

  /**
   * Updates a registration by code and syncs it
   */
  public async updateRegistrationByCode(
    eventId: string,
    regCode: string,
    updates: any
  ): Promise<boolean> {
    const k = this.key('updateByCode', regCode);
    if (this.inProgress.get(k)) {
      throw new Error('Registration update already in progress');
    }
    this.inProgress.set(k, true);

    try {
      // Update in database
      const { data: reg, error } = await supabase
        .from('registrations')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('reg_code', regCode)
        .eq('event_id', eventId)
        .select('id')
        .single();

      if (error) throw error;
      if (!reg) throw new Error('Failed to update registration');

      // Sync to sheets
      await this.postToSheet('syncRegistration', { registrationId: reg.id });

      return true;
    } finally {
      this.inProgress.delete(k);
    }
  }

  /**
   * Syncs all registrations for an event
   */
  public async syncAllRegistrations(eventId: string): Promise<SheetResponse> {
    const k = this.key('syncAll', eventId);
    if (this.inProgress.get(k)) {
      throw new Error('Bulk sync already in progress for this event');
    }
    this.inProgress.set(k, true);

    try {
      const response = await this.postToSheet('syncAllRegistrations', {
        eventId
      });

      return response;
    } finally {
      this.inProgress.delete(k);
    }
  }

  /**
   * Does a complete sync of an event's registrations
   * Alias for syncAllRegistrations
   */
  public async bulkSyncForEvent(eventId: string): Promise<void> {
    await this.syncAllRegistrations(eventId);
  }

  /**
   * Appends a new registration to the sheet
   */
  public async appendRegistration(registrationId: string): Promise<void> {
    const k = this.key('appendReg', registrationId);
    if (this.inProgress.get(k)) {
      throw new Error('Sync already in progress for this registration');
    }
    this.inProgress.set(k, true);

    try {
      // Get registration details
      const { data: reg, error } = await supabase
        .from('registrations')
        .select(`
          *,
          events:event_id (id, name, sheet_id),
          problem_statements:problem_statement_id (id, title)
        `)
        .eq('id', registrationId)
        .single();

      if (error) throw error;
      if (!reg) throw new Error('Registration not found');

      // Ensure we have the event spreadsheet
      await this.ensureEventSpreadsheet(reg.event_id);

      // Ensure the problem statement tab exists
      await this.ensureProblemTab(reg.event_id, reg.problem_statement_id);

      // Sync via Apps Script
      await this.postToSheet('syncRegistration', { registrationId });
    } finally {
      this.inProgress.delete(k);
    }
  }

  /**
   * Bulk syncs multiple events with all their data
   */
  public async bulkSync(events: any[]): Promise<SheetResponse> {
    const k = this.key('bulkSync');
    if (this.inProgress.get(k)) {
      throw new Error('Bulk sync already in progress');
    }
    this.inProgress.set(k, true);

    try {
      const response = await this.postToSheet('bulkSync', {
        events
      });

      return response;
    } finally {
      this.inProgress.delete(k);
    }
  }

  /**
   * Adds a new problem statement tab to an event spreadsheet
   */
  public async addProblemStatement(
    eventId: string,
    problemId: string,
    problemTitle: string
  ): Promise<void> {
    const k = this.key('addProblem', `${eventId}:${problemId}`);
    if (this.inProgress.get(k)) return;
    this.inProgress.set(k, true);

    try {
      // Ensure spreadsheet exists
      const sheetId = await this.ensureEventSpreadsheet(eventId);

      // Add problem statement tab
      await this.postToSheet('addProblemStatement', {
        spreadsheetId: sheetId,
        problemStatement: {
          title: problemTitle
        }
      });
    } finally {
      this.inProgress.delete(k);
    }
  }
}

export const syncManager = SyncManager.getInstance();