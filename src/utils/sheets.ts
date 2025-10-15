type CreateSheetResult = { spreadsheetId: string };
type UpsertResult = { success: boolean; updated: boolean; rowNumber?: number; reg_code?: string };

async function postToAppsScript(body: any) {
  // In development we proxy requests through the dev server at /api/sheets
  // The Vite middleware will forward to the configured Apps Script URL and
  // handle CORS/preflight. In production you should provide a server-side
  // proxy that behaves similarly.
  const proxyPath = '/api/sheets';

  const res = await fetch(proxyPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apps Script error: ${res.status} ${text}`);
  }
  return res.json();
}

export async function createSpreadsheet(title: string): Promise<CreateSheetResult> {
  return postToAppsScript({ action: 'createEvent', eventName: title, problemStatements: [] });
}

export async function createTab(spreadsheetId: string, tabName: string): Promise<any> {
  return postToAppsScript({ action: 'createTab', spreadsheetId, tabName });
}

export async function upsertRegistration(spreadsheetId: string, tabName: string, registration: any): Promise<UpsertResult> {
  return postToAppsScript({ action: 'upsertRegistration', spreadsheetId, tabName, registration });
}

export async function bulkSync(events: any[]): Promise<any> {
  return postToAppsScript({ action: 'bulkSync', events });
}

// Helper for appending registrations without updating existing ones
export async function appendRegistration(spreadsheetId: string, tabName: string, registration: any): Promise<UpsertResult> {
  if (!registration.reg_code) {
    throw new Error('Registration code is required');
  }

  // First try to find if this registration already exists
  const existingRow = await findRowInSheet(spreadsheetId, tabName, 'reg_code', registration.reg_code);
  
  if (existingRow && existingRow.found) {
    // Update existing registration
    return postToAppsScript({
      action: 'updateRow',
      spreadsheetId,
      tabName,
      searchKey: 'reg_code',
      searchValue: registration.reg_code,
      data: registration
    });
  } else {
    // Append new registration
    return postToAppsScript({
      action: 'appendRow',
      spreadsheetId,
      tabName,
      data: registration
    });
  }
}

// Keep this for backward compatibility
export const updateRegistrationInSheet = upsertRegistration;
export async function findRowInSheet(spreadsheetId: string, tabName: string, searchKey: string, searchValue: string) {
  return postToAppsScript({ action: 'findRow', spreadsheetId, tabName, searchKey, searchValue });
}

export default {
  createSpreadsheet,
  createTab,
  upsertRegistration,
  bulkSync,
};