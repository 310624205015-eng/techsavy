// Environment variables - set these in your Apps Script project
const SUPABASE_URL = PropertiesService.getScriptProperties().getProperty('SUPABASE_URL');
const SUPABASE_KEY = PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY');

// Endpoints (Trigger-based, fetches data from Supabase):
// - action=syncEvent { eventId }              -> Creates/updates event spreadsheet
// - action=syncProblem { eventId, problemId } -> Creates/updates problem statement tab
// - action=syncRegistration { registrationId } -> Creates/updates registration row
// - action=syncAllRegistrations { eventId }    -> Sync all registrations for an event

// Supabase helper functions
function fetchFromSupabase(path, options = {}) {
  const url = `${SUPABASE_URL}${path}`;
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
  };
  
  const response = UrlFetchApp.fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers }
  });
  
  return JSON.parse(response.getContentText());
}

function doPost(e) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    // Parse the request body
    const payload = JSON.parse(e.postData.contents);
    const { action } = payload;

    // Handle different actions
    switch (action) {
      case 'syncEvent':
        return syncEvent(payload);
      case 'syncProblem':
        return syncProblem(payload);
      case 'syncRegistration':
        return syncRegistration(payload);
      case 'syncAllRegistrations':
        return syncAllRegistrations(payload);
      default:
        return jsonResponse(400, { error: 'Unknown action' }, headers);
    }
  } catch (error) {
    return jsonResponse(500, { error: error.message }, headers);
  }
}

function syncEvent(payload) {
  const { eventId } = payload;
  if (!eventId) return jsonResponse(400, { error: 'eventId required' });

  try {
    // Fetch event details from Supabase
    const { data: event, error } = fetchFromSupabase(`/rest/v1/events?id=eq.${eventId}&select=*`);
    if (error) throw error;
    if (!event || !event[0]) throw new Error('Event not found');
    
    const ev = event[0];
    let spreadsheetId = ev.sheet_id;

    // Create spreadsheet if doesn't exist
    if (!spreadsheetId) {
      const ss = SpreadsheetApp.create(ev.name || `Event-${ev.id}`);
      spreadsheetId = ss.getId();

      // Update sheet_id in Supabase
      fetchFromSupabase(`/rest/v1/events?id=eq.${eventId}`, {
        method: 'PATCH',
        payload: JSON.stringify({ sheet_id: spreadsheetId })
      });
    }

    return jsonResponse(200, { spreadsheetId });
  } catch (error) {
    return jsonResponse(500, { error: error.message });
  }
}

function syncProblem(payload) {
  const { eventId, problemId } = payload;
  if (!eventId || !problemId) {
    return jsonResponse(400, { error: 'eventId and problemId required' });
  }

  try {
    // Fetch event and problem details
    const [eventData, problemData] = Promise.all([
      fetchFromSupabase(`/rest/v1/events?id=eq.${eventId}&select=*`),
      fetchFromSupabase(`/rest/v1/problem_statements?id=eq.${problemId}&select=*`)
    ]);

    const event = eventData.data?.[0];
    const problem = problemData.data?.[0];
    
    if (!event) throw new Error('Event not found');
    if (!problem) throw new Error('Problem not found');

    // Ensure spreadsheet exists
    if (!event.sheet_id) {
      const syncResult = syncEvent({ eventId });
      const response = JSON.parse(syncResult.getContent());
      if (response.error) throw new Error(response.error);
      event.sheet_id = response.spreadsheetId;
    }

    // Create/update problem tab
    const ss = SpreadsheetApp.openById(event.sheet_id);
    const tabName = problem.title || `Problem-${problem.id}`;
    let sheet = ss.getSheetByName(tabName);

    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      const headers = [
        'reg_code',
        'team_name', 
        'email',
        'college_name',
        'contact_number',
        'team_size',
        'is_locked',
        'created_at',
        'updated_at'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#f3f4f6')
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
      sheet.autoResizeColumns(1, headers.length);
    }

    return jsonResponse(200, { 
      spreadsheetId: event.sheet_id,
      tabName,
      message: 'Problem tab synced successfully'
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message });
  }
}

function generateRegistrationCode(seed) {
  const timestamp = new Date().getTime().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 6);
  const sanitizedSeed = (seed || '').toString()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 4);
  return `${sanitizedSeed}${timestamp}${randomStr}`.toUpperCase();
}

function syncRegistration(payload) {
  const { registrationId } = payload;
  if (!registrationId) {
    return jsonResponse(400, { error: 'registrationId required' });
  }

  try {
    // Fetch registration with related data
    const { data: reg, error } = fetchFromSupabase(`/rest/v1/registrations?id=eq.${registrationId}&select=*,events(*),problem_statements(*)`);
    if (error) throw error;
    if (!reg || !reg[0]) throw new Error('Registration not found');

    const registration = reg[0];
    const event = registration.events;
    const problem = registration.problem_statements;

    // Ensure event spreadsheet and problem tab exist
    if (!event.sheet_id) {
      const syncResult = syncEvent({ eventId: event.id });
      const response = JSON.parse(syncResult.getContent());
      if (response.error) throw new Error(response.error);
      event.sheet_id = response.spreadsheetId;
    }

    await syncProblem({ eventId: event.id, problemId: problem.id });

    // Update/create registration row
    const ss = SpreadsheetApp.openById(event.sheet_id);
    const tabName = problem.title || `Problem-${problem.id}`;
    const sheet = ss.getSheetByName(tabName);
    
    if (!sheet) throw new Error('Problem tab not found');

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const now = new Date().toISOString();

    // Find existing row or prepare for new one
    let rowIndex = -1;
    if (registration.reg_code) {
      const data = sheet.getDataRange().getValues();
      const regCodeCol = headers.indexOf('reg_code');
      for (let i = 1; i < data.length; i++) {
        if (data[i][regCodeCol] === registration.reg_code) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    // Prepare row data
    const rowData = headers.map(header => {
      switch (header) {
        case 'reg_code': return registration.reg_code || generateRegistrationCode(registration.team_name || registration.email);
        case 'team_name': return registration.team_name || '';
        case 'email': return registration.email || '';
        case 'college_name': return registration.college_name || '';
        case 'contact_number': return registration.contact_number || '';
        case 'team_size': return registration.team_size || 1;
        case 'is_locked': return registration.is_locked ? 'true' : 'false';
        case 'created_at': return registration.created_at || now;
        case 'updated_at': return now;
        default: return registration[header] || '';
      }
    });

    // Update or append
    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
      rowIndex = sheet.getLastRow();
    }

    return jsonResponse(200, {
      success: true,
      spreadsheetId: event.sheet_id,
      tabName,
      rowIndex,
      reg_code: rowData[headers.indexOf('reg_code')]
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message });
  }
}

function syncAllRegistrations(payload) {
  const { eventId } = payload;
  if (!eventId) return jsonResponse(400, { error: 'eventId required' });

  try {
    // Fetch all data we need
    const [eventData, problemsData, registrationsData] = Promise.all([
      fetchFromSupabase(`/rest/v1/events?id=eq.${eventId}&select=*`),
      fetchFromSupabase(`/rest/v1/problem_statements?event_id=eq.${eventId}&select=*`),
      fetchFromSupabase(`/rest/v1/registrations?event_id=eq.${eventId}&select=*,events(*),problem_statements(*)`)
    ]);

    if (eventData.error || problemsData.error || registrationsData.error) {
      throw new Error('Failed to fetch data from Supabase');
    }

    const event = eventData.data?.[0];
    if (!event) throw new Error('Event not found');

    // Create or get spreadsheet
    let spreadsheetId = event.sheet_id;
    if (!spreadsheetId) {
      const ss = SpreadsheetApp.create(event.name || `Event-${event.id}`);
      spreadsheetId = ss.getId();
      fetchFromSupabase(`/rest/v1/events?id=eq.${eventId}`, {
        method: 'PATCH',
        payload: JSON.stringify({ sheet_id: spreadsheetId })
      });
    }

    const ss = SpreadsheetApp.openById(spreadsheetId);
    const problems = problemsData.data || [];
    const registrations = registrationsData.data || [];

    // Create/update sheets for each problem
    for (const problem of problems) {
      const tabName = problem.title || `Problem-${problem.id}`;
      let sheet = ss.getSheetByName(tabName);

      // Create sheet if it doesn't exist
      if (!sheet) {
        sheet = ss.insertSheet(tabName);
      }

      // Clear existing data but keep headers if they exist
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clear();
      }

      // Set up headers
      const headers = [
        'reg_code',
        'team_name', 
        'email',
        'college_name',
        'contact_number',
        'team_size',
        'is_locked',
        'created_at',
        'updated_at'
      ];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setBackground('#f3f4f6')
        .setFontWeight('bold')
        .setHorizontalAlignment('center');

      // Add all registrations for this problem
      const problemRegs = registrations.filter(reg => reg.problem_statements?.id === problem.id);
      const now = new Date().toISOString();

      const rowsData = problemRegs.map(reg => headers.map(header => {
        switch (header) {
          case 'reg_code': return reg.reg_code || generateRegistrationCode(reg.team_name || reg.email);
          case 'team_name': return reg.team_name || '';
          case 'email': return reg.email || '';
          case 'college_name': return reg.college_name || '';
          case 'contact_number': return reg.contact_number || '';
          case 'team_size': return reg.team_size || 1;
          case 'is_locked': return reg.is_locked ? 'true' : 'false';
          case 'created_at': return reg.created_at || now;
          case 'updated_at': return now;
          default: return reg[header] || '';
        }
      }));

      if (rowsData.length > 0) {
        sheet.getRange(2, 1, rowsData.length, headers.length).setValues(rowsData);
      }

      sheet.autoResizeColumns(1, headers.length);
    }

    return jsonResponse(200, {
      success: true,
      spreadsheetId,
      problemsUpdated: problems.length,
      registrationsSynced: registrations.length
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message });
  }
}

function jsonResponse(status, obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON).setContent(JSON.stringify(obj));
}

function createEvent(payload) {
  const eventName = payload.eventName;
  const problemStatements = Array.isArray(payload.problemStatements) ? payload.problemStatements : [];
  if (!eventName) return jsonResponse(400, { error: 'eventName required' });

  // Create or find spreadsheet by name
  const files = DriveApp.getFilesByName(eventName);
  let spreadsheetId;
  if (files.hasNext()) {
    spreadsheetId = files.next().getId();
  } else {
    const ss = SpreadsheetApp.create(eventName);
    spreadsheetId = ss.getId();
  }

  const ss = SpreadsheetApp.openById(spreadsheetId);

  // Remove default Sheet1 only if we will create other tabs
  if (problemStatements.length > 0) {
    const defaultSheet = ss.getSheetByName('Sheet1');
    if (defaultSheet) ss.deleteSheet(defaultSheet);
  }

  const headers = ['reg_code', 'email', 'team_name', 'college_name', 'contact_number', 'team_size', 'is_locked', 'created_at', 'updated_at'];
  if (problemStatements.length === 0) {
    const first = ss.getSheets()[0];
    if (first) first.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    problemStatements.forEach(title => {
      if (!title) return;
      let sh = ss.getSheetByName(title);
      if (!sh) sh = ss.insertSheet(title);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    });
  }

  return jsonResponse(200, { spreadsheetId });
}

function createTab(payload) {
  const spreadsheetId = payload.spreadsheetId;
  const tabName = payload.tabName || 'Sheet1';
  if (!spreadsheetId || !tabName) return jsonResponse(400, { error: 'spreadsheetId and tabName required' });

  const ss = SpreadsheetApp.openById(spreadsheetId);
  let sh = ss.getSheetByName(tabName);
  if (!sh) sh = ss.insertSheet(tabName);

  const headers = ['reg_code', 'email', 'team_name', 'college_name', 'contact_number', 'team_size', 'is_locked', 'created_at', 'updated_at'];
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  return jsonResponse(200, { spreadsheetId, tabName });
}

function upsertRegistration(payload) {
  try {
    const spreadsheetId = payload.spreadsheetId;
    const tabName = payload.tabName || 'Sheet1';
    const registration = payload.registration || {};
    if (!spreadsheetId || !registration) return jsonResponse(400, { error: 'spreadsheetId and registration required' });

    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sh = ss.getSheetByName(tabName);
    if (!sh) sh = ss.insertSheet(tabName);

    const headers = ['reg_code', 'email', 'team_name', 'college_name', 'contact_number', 'team_size', 'is_locked', 'created_at', 'updated_at'];
    
    // Ensure headers exist
    const firstRow = sh.getRange(1, 1, 1, headers.length).getValues()[0];
    if (firstRow.some(cell => !cell)) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    // Normalize members
    const members = Array.isArray(registration.team_members)
      ? registration.team_members
      : (typeof registration.team_members === 'string' ? registration.team_members.split(';').map(s => s.trim()).filter(Boolean) : []);
    const teamSize = Math.max(registration.team_size || members.length, members.length);

    // Read header and ensure team_member columns exist
    const headerRange = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 9));
    let header = headerRange.getValues()[0];
    const baseCols = ['reg_code', 'email', 'team_name', 'college_name', 'contact_number', 'team_size', 'is_locked', 'created_at', 'updated_at'];

    const currentMemberCols = header.filter(h => h && h.toString().startsWith('team_member_')).length;
    const neededMemberCols = Math.max(currentMemberCols, teamSize);

    const newHeader = baseCols.concat(Array.from({ length: neededMemberCols }, (_, i) => `team_member_${i + 1}`));
    if (header.length !== newHeader.length || !newHeader.every((h, i) => header[i] === h)) {
      sh.getRange(1, 1, 1, newHeader.length).setValues([newHeader]);
      header = newHeader;
    }

    // Ensure reg_code exists
    if (!registration.reg_code) {
      registration.reg_code = generateRegistrationCode(registration.team_name || registration.email || String(new Date().getTime()));
    }

    // Search for existing row by reg_code only
    const data = sh.getDataRange().getValues();
    const regCol = header.indexOf('reg_code');
    let existingRow = -1;
    if (regCol >= 0) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][regCol]) === String(registration.reg_code)) {
          existingRow = i + 1; // 1-based
          break;
        }
      }
    }

    // Build row values matching header
    const now = new Date().toISOString();
    const row = [];
    for (const col of header) {
      switch (col) {
        case 'reg_code': row.push(registration.reg_code || ''); break;
        case 'email': row.push(registration.email || ''); break;
        case 'team_name': row.push(registration.team_name || ''); break;
        case 'college_name': row.push(registration.college_name || registration.college || ''); break;
        case 'contact_number': row.push(registration.contact_number || registration.phone || ''); break;
        case 'team_size': row.push(teamSize || 0); break;
        case 'is_locked': row.push(registration.is_locked ? 'true' : 'false'); break;
        case 'created_at': row.push(registration.created_at || now); break;
        case 'updated_at': row.push(now); break;
        default:
          if (col && col.toString().startsWith('team_member_')) {
            const idx = parseInt(col.split('_').pop(), 10) - 1;
            row.push(members[idx] || '');
          } else {
            row.push(registration[col] || '');
          }
      }
    }

    if (existingRow > 0) {
      // preserve created_at when updating
      const existingValues = sh.getRange(existingRow, 1, 1, header.length).getValues()[0];
      const createdIdx = header.indexOf('created_at');
      if (createdIdx >= 0 && existingValues[createdIdx]) row[createdIdx] = existingValues[createdIdx];

      sh.getRange(existingRow, 1, 1, row.length).setValues([row]);
      return jsonResponse(200, { success: true, updated: true, rowNumber: existingRow, reg_code: registration.reg_code });
    } else {
      sh.appendRow(row);
      return jsonResponse(200, { success: true, updated: false, rowNumber: sh.getLastRow(), reg_code: registration.reg_code });
    }
  } catch (err) {
    return jsonResponse(500, { success: false, error: String(err) });
  }
}

function addProblemStatement(payload) {
  const { spreadsheetId, problemStatement } = payload;
  if (!spreadsheetId || !problemStatement || !problemStatement.title) {
    return jsonResponse(400, { error: 'spreadsheetId and problemStatement.title required' });
  }

  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const tabName = problemStatement.title;

    // Check if tab already exists
    let sheet = ss.getSheetByName(tabName);
    if (sheet) {
      return jsonResponse(200, { 
        spreadsheetId, 
        tabName,
        message: 'Tab already exists' 
      });
    }

    // Create new tab
    sheet = ss.insertSheet(tabName);

    // Set up headers
    const headers = [
      'reg_code',
      'team_name', 
      'email',
      'college_name',
      'contact_number',
      'team_size',
      'is_locked',
      'created_at',
      'updated_at'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // Format header row
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#f3f4f6')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // Auto-resize columns
    sheet.autoResizeColumns(1, headers.length);

    return jsonResponse(200, { 
      spreadsheetId, 
      tabName,
      message: 'Problem statement tab created successfully' 
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message || 'Failed to create problem statement tab' });
  }
}

function findRow(payload) {
  const spreadsheetId = payload.spreadsheetId;
  const tabName = payload.tabName;
  const searchKey = payload.searchKey;
  const searchValue = payload.searchValue;
  if (!spreadsheetId || !searchKey) return jsonResponse(400, { error: 'spreadsheetId and searchKey required' });

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sh = ss.getSheetByName(tabName);
  if (!sh) return jsonResponse(200, { rowNumber: null });

  const data = sh.getDataRange().getValues();
  const header = data[0] || [];
  const colIdx = header.indexOf(searchKey);
  if (colIdx < 0) return jsonResponse(200, { rowNumber: null });

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(searchValue)) return jsonResponse(200, { rowNumber: i + 1 });
  }
  return jsonResponse(200, { rowNumber: null });
}

function bulkSync(payload) {
  const events = Array.isArray(payload.events) ? payload.events : [];
  const results = [];

  for (const ev of events) {
    try {
      if (!ev || !ev.id) {
        results.push({ event_id: ev?.id || null, error: 'invalid event' });
        continue;
      }

      // ensure spreadsheet exists
      let ssId = ev.sheet_id;
      if (!ssId) {
        const res = createEvent({ eventName: ev.name || `Event-${ev.id}`, problemStatements: [] });
        const parsed = JSON.parse(res.getContent());
        ssId = parsed.spreadsheetId;
      }

      const ss = SpreadsheetApp.openById(ssId);
      const problemStatements = ev.problem_statements || [];
      const registrations = ev.registrations || [];

      for (const ps of problemStatements) {
        const tabName = ps.title || `Problem-${ps.id}`;
        let sh = ss.getSheetByName(tabName);
        if (!sh) sh = ss.insertSheet(tabName);

        // determine max team size
        let maxTeamSize = 0;
        const regs = registrations.filter(r => r.problem_statement_id === ps.id);
        regs.forEach(r => {
          const members = Array.isArray(r.team_members) ? r.team_members : (typeof r.team_members === 'string' ? r.team_members.split(';').map(s => s.trim()).filter(Boolean) : []);
          maxTeamSize = Math.max(maxTeamSize, members.length);
          if (!r.reg_code) r.reg_code = generateRegistrationCode(r.team_name || r.email || String(new Date().getTime()));
        });

        // Build new header including enough member columns
        const baseHeaders = ['reg_code', 'email', 'team_name', 'college_name', 'contact_number', 'team_size', 'is_locked', 'created_at', 'updated_at'];
        const memberHeaders = Array.from({ length: maxTeamSize }, (_, i) => `team_member_${i + 1}`);
        const headers = baseHeaders.concat(memberHeaders);

        sh.clearContents();
        sh.getRange(1, 1, 1, headers.length).setValues([headers]);

        // Write registrations
        if (regs.length > 0) {
          const now = new Date().toISOString();
          const rows = regs.map(r => {
            const members = Array.isArray(r.team_members) ? r.team_members : (typeof r.team_members === 'string' ? r.team_members.split(';').map(s => s.trim()).filter(Boolean) : []);
            const row = [
              r.reg_code || '',
              r.email || '',
              r.team_name || '',
              r.college_name || r.college || '',
              r.contact_number || r.phone || '',
              r.team_size || members.length || 0,
              r.is_locked ? 'true' : 'false',
              r.created_at || now,
              now
            ];
            return row.concat(members.concat(Array(maxTeamSize - members.length).fill('')));
          });
          sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
        }
      }

      results.push({
        event_id: ev.id,
        sheet_id: ssId,
        success: true,
        registrations_synced: registrations.length
      });
    } catch (err) {
      results.push({
        event_id: ev.id,
        error: String(err)
      });
    }
  }

  return jsonResponse(200, { results });
}

function generateRegistrationCode(seed) {
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, seed);
  return Array.from(hash).slice(0, 6).map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('').toUpperCase();
}

function jsonResponse(status, obj) {
  // Google Apps Script ContentService doesn't allow setting HTTP status codes from
  // the script. Return JSON that includes the intended status.
  const payload = Object.assign({ status }, obj);
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
