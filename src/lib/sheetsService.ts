/**
 * Google Sheets Service (Google Sheets API v4)
 * Provides real Google Sheets operations: creating spreadsheets, writing rows,
 * reading sheet values, and 1-click export of Properties and CRM Leads directly to Google Sheets.
 */

import { Property, LeadRecord } from '../types';

export interface SheetRowValue {
  [key: string]: any;
}

export interface GoogleSpreadsheetInfo {
  id: string;
  name: string;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

/**
 * Creates a new Google Spreadsheet in the user's Google Drive.
 */
export async function createGoogleSpreadsheet(
  accessToken: string,
  title: string,
  sheetTitle: string = 'Sheet1'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: sheetTitle,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to create Google Spreadsheet: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
  };
}

/**
 * Appends rows of data to a specific range in a Google Spreadsheet.
 */
export async function appendSheetRows(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null | undefined)[][]
): Promise<{ updatedRows: number; updatedRange: string }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to append rows to Google Sheet: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    updatedRows: data.updates?.updatedRows || values.length,
    updatedRange: data.updates?.updatedRange || range,
  };
}

/**
 * Updates a range of cells in a Google Spreadsheet (e.g. for header rows).
 */
export async function updateSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null | undefined)[][]
): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to update sheet cells: ${response.statusText}`);
  }
}

/**
 * Reads values from a specified Google Spreadsheet range.
 */
export async function readSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    spreadsheetId
  )}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to read Google Sheet values: ${response.statusText}`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Lists Google Spreadsheets accessible by the user via Google Drive API.
 */
export async function listSpreadsheets(
  accessToken: string,
  pageSize: number = 25
): Promise<GoogleSpreadsheetInfo[]> {
  const query = "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&pageSize=${pageSize}&fields=files(id,name,webViewLink,createdTime,modifiedTime)&orderBy=modifiedTime desc`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error?.message || `Failed to list Google Spreadsheets: ${response.statusText}`);
  }

  const data = await response.json();
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    webViewLink: f.webViewLink,
    createdTime: f.createdTime,
    modifiedTime: f.modifiedTime,
  }));
}

/**
 * High-Level: Exports an array of Properties directly into a brand new Google Spreadsheet.
 */
export async function exportPropertiesToGoogleSheet(
  accessToken: string,
  properties: Property[],
  sheetTitleName: string = 'Vortex One - Properties Intelligence'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; totalExported: number }> {
  const timestamp = new Date().toISOString().split('T')[0];
  const fullTitle = `${sheetTitleName} (${timestamp})`;

  // 1. Create Spreadsheet
  const { spreadsheetId, spreadsheetUrl } = await createGoogleSpreadsheet(
    accessToken,
    fullTitle,
    'Properties'
  );

  // 2. Define Headers
  const headers = [
    'APN / Parcel ID',
    'Street Address',
    'City',
    'State',
    'ZIP',
    'County',
    'Owner Name',
    'Property Type',
    'Units Count',
    'Square Feet',
    'Year Built',
    'Estimated Value ($)',
    'Assessed Tax Value ($)',
    'Estimated Equity ($)',
    'Mortgage Balance ($)',
    'Absentee Owner',
    'Corporate Owned',
    'Tax Delinquent',
    'Last Sale Date',
    'Last Sale Price ($)',
    'Latitude',
    'Longitude',
    'Tags',
  ];

  // 3. Map Data Rows
  const rows = properties.map((p) => [
    p.apn || '',
    p.address || '',
    p.city || '',
    p.state || 'CA',
    p.zip || '',
    p.county || 'Orange County',
    p.owner_name || '',
    p.property_type || '',
    p.units_count ?? '',
    p.square_feet ?? '',
    p.year_built ?? '',
    p.estimated_value ?? '',
    p.assessed_tax_value ?? '',
    p.estimated_equity ?? '',
    p.mortgage_balance ?? '',
    p.is_absentee_owner ? 'YES' : 'NO',
    p.is_corporate_owned ? 'YES' : 'NO',
    p.tax_delinquent ? 'YES' : 'NO',
    p.last_sale_date || '',
    p.last_sale_price ?? '',
    p.latitude ?? '',
    p.longitude ?? '',
    (p.tags || []).join(', '),
  ]);

  // 4. Update Header and Append Rows
  await updateSheetValues(accessToken, spreadsheetId, 'Properties!A1:W1', [headers]);
  if (rows.length > 0) {
    await appendSheetRows(accessToken, spreadsheetId, 'Properties!A2:W', rows);
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    totalExported: properties.length,
  };
}

/**
 * High-Level: Exports CRM Leads directly into a brand new Google Spreadsheet.
 */
export async function exportLeadsToGoogleSheet(
  accessToken: string,
  leads: LeadRecord[],
  sheetTitleName: string = 'Vortex One - CRM Pipeline Leads'
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; totalExported: number }> {
  const timestamp = new Date().toISOString().split('T')[0];
  const fullTitle = `${sheetTitleName} (${timestamp})`;

  // 1. Create Spreadsheet
  const { spreadsheetId, spreadsheetUrl } = await createGoogleSpreadsheet(
    accessToken,
    fullTitle,
    'CRM Leads'
  );

  // 2. Define Headers
  const headers = [
    'Lead ID',
    'Owner / Prospect Name',
    'Subject Property Address',
    'Primary Phone',
    'Primary Email',
    'Lead Score',
    'Classification',
    'Pipeline Stage',
    'Disposition',
    'Assigned Agent',
    'DNC Compliant',
    'Key Factors',
    'Last Activity Date',
    'Next Recommended Action',
    'CRM Tags',
    'Notes',
  ];

  // 3. Map Data Rows
  const rows = leads.map((l) => [
    l.id || '',
    l.owner_name || '',
    l.property_address || '',
    l.phone_number || '',
    l.email || '',
    l.lead_score ?? 0,
    l.classification || l.priority_tier || 'medium_priority',
    l.stage || 'identified',
    l.disposition || 'uncontacted',
    l.assigned_agent || 'sub_agent_2',
    l.dnc_compliant ? 'YES' : 'NO',
    (l.factors || []).map((f) => f.factor || f.description).filter(Boolean).join('; '),
    l.last_activity_date || '',
    l.next_recommended_action || '',
    (l.tags || []).join(', '),
    l.notes || '',
  ]);

  // 4. Update Header and Append Rows
  await updateSheetValues(accessToken, spreadsheetId, 'CRM Leads!A1:P1', [headers]);
  if (rows.length > 0) {
    await appendSheetRows(accessToken, spreadsheetId, 'CRM Leads!A2:P', rows);
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    totalExported: leads.length,
  };
}
