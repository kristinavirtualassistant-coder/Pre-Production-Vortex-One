import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { getGoogleWorkspaceAccessToken } from './integrationOAuth';

type BackupContact = {
  id: string;
  organization_id: string;
  owner_id?: string | null;
  full_name: string;
  phone_numbers: unknown;
  email_addresses: unknown;
  created_at?: string;
  updated_at?: string;
};

async function googleJson(url: string, token: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || `Google API request failed (${response.status})`);
  return body;
}

async function findOrCreateFolder(token: string, name: string): Promise<string> {
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`);
  const found = await googleJson(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1&fields=files(id,name)`,
    token,
  );
  if (found.files?.[0]?.id) return found.files[0].id;

  const created = await googleJson('https://www.googleapis.com/drive/v3/files?fields=id,name', token, {
    method: 'POST',
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return created.id;
}

async function findOrCreateSpreadsheet(token: string, folderId: string): Promise<string> {
  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.spreadsheet' and name='Vortex One Backup' and trashed=false`);
  const found = await googleJson(
    `https://www.googleapis.com/drive/v3/files?q=${q}&pageSize=1&fields=files(id,name,parents)`,
    token,
  );
  if (found.files?.[0]?.id) return found.files[0].id;

  const created = await googleJson('https://sheets.googleapis.com/v4/spreadsheets', token, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: 'Vortex One Backup' },
      sheets: [{ properties: { title: 'Contacts' } }],
    }),
  });

  if (created.spreadsheetId && folderId) {
    await googleJson(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(created.spreadsheetId)}?addParents=${encodeURIComponent(folderId)}&fields=id,parents`,
      token,
      { method: 'PATCH', body: JSON.stringify({}) },
    );
  }
  return created.spreadsheetId;
}

async function recordEvent(
  pool: Pool,
  args: {
    organizationId: string;
    entityType: string;
    entityId: string;
    destination: 'google_sheets' | 'google_drive';
    status: 'pending' | 'success' | 'failed';
    contentHash: string;
    externalId?: string | null;
    externalUrl?: string | null;
    error?: string | null;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO backup_events
      (id,organization_id,entity_type,entity_id,destination,status,content_hash,external_id,external_url,error,attempts,completed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,CASE WHEN $6='success' THEN CURRENT_TIMESTAMP ELSE NULL END)
     ON CONFLICT (organization_id,entity_type,entity_id,destination,content_hash)
     DO UPDATE SET status=EXCLUDED.status,external_id=EXCLUDED.external_id,external_url=EXCLUDED.external_url,error=EXCLUDED.error,attempts=backup_events.attempts+1,completed_at=EXCLUDED.completed_at`,
    [
      `backup_${randomUUID()}`, args.organizationId, args.entityType, args.entityId,
      args.destination, args.status, args.contentHash, args.externalId || null,
      args.externalUrl || null, args.error || null,
    ],
  );
}

async function backupContactToSheets(
  pool: Pool,
  token: string,
  contact: BackupContact,
  contentHash: string,
): Promise<void> {
  const folderId = await findOrCreateFolder(token, 'Vortex One Backups');
  const spreadsheetId = await findOrCreateSpreadsheet(token, folderId);
  const values = [[
    contact.id,
    contact.organization_id,
    contact.owner_id || '',
    contact.full_name,
    JSON.stringify(contact.phone_numbers || []),
    JSON.stringify(contact.email_addresses || []),
    contact.created_at || '',
    contact.updated_at || '',
    contentHash,
  ]];

  await googleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/Contacts!A:I:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    token,
    { method: 'POST', body: JSON.stringify({ values }) },
  );

  await recordEvent(pool, {
    organizationId: contact.organization_id,
    entityType: 'contact',
    entityId: contact.id,
    destination: 'google_sheets',
    status: 'success',
    contentHash,
    externalId: spreadsheetId,
    externalUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  });
}

async function backupContactToDrive(
  pool: Pool,
  token: string,
  contact: BackupContact,
  contentHash: string,
): Promise<void> {
  const folderId = await findOrCreateFolder(token, 'Vortex One Backups');
  const metadata = {
    name: `contact-${contact.id}-${contentHash.slice(0, 12)}.json`,
    mimeType: 'application/json',
    parents: [folderId],
  };
  const payload = JSON.stringify({ entity: 'contact', exported_at: new Date().toISOString(), record: contact }, null, 2);
  const boundary = `vortex-${randomUUID()}`;
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\\r\\nContent-Type: application/json; charset=UTF-8\\r\\n\\r\\n${JSON.stringify(metadata)}\\r\\n--${boundary}\\r\\nContent-Type: application/json\\r\\n\\r\\n`,
  );
  const data = enc.encode(payload);
  const tail = enc.encode(`\\r\\n--${boundary}--`);
  const body = new Uint8Array(head.length + data.length + tail.length);
  body.set(head, 0); body.set(data, head.length); body.set(tail, head.length + data.length);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result?.error?.message || `Google Drive upload failed (${response.status})`);

  await recordEvent(pool, {
    organizationId: contact.organization_id,
    entityType: 'contact',
    entityId: contact.id,
    destination: 'google_drive',
    status: 'success',
    contentHash,
    externalId: result.id,
    externalUrl: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
  });
}

/**
 * Back up a committed PostgreSQL contact to Google Sheets and Google Drive.
 * Backup failures are recorded and deliberately do not fail the primary database mutation.
 */
export async function backupContact(contact: BackupContact): Promise<{
  sheets: 'success' | 'failed' | 'skipped';
  drive: 'success' | 'failed' | 'skipped';
}> {
  const pool = (await import('../db/db')).getPgPool();
  if (!pool) return { sheets: 'skipped', drive: 'skipped' };

  const payload = JSON.stringify(contact);
  const contentHash = createHash('sha256').update(payload).digest('hex');

  let token: string;
  try {
    token = await getGoogleWorkspaceAccessToken(pool, contact.organization_id);
  } catch (error: any) {
    const message = error?.message || 'Google Workspace is not connected';
    for (const destination of ['google_sheets', 'google_drive'] as const) {
      await recordEvent(pool, {
        organizationId: contact.organization_id,
        entityType: 'contact',
        entityId: contact.id,
        destination,
        status: 'failed',
        contentHash,
        error: message,
      }).catch(() => undefined);
    }
    return { sheets: 'failed', drive: 'failed' };
  }

  const result = { sheets: 'failed' as const, drive: 'failed' as const };
  try { await backupContactToSheets(pool, token, contact, contentHash); result.sheets = 'success'; }
  catch (error: any) {
    await recordEvent(pool, {
      organizationId: contact.organization_id, entityType: 'contact', entityId: contact.id,
      destination: 'google_sheets', status: 'failed', contentHash, error: error?.message || String(error),
    }).catch(() => undefined);
  }
  try { await backupContactToDrive(pool, token, contact, contentHash); result.drive = 'success'; }
  catch (error: any) {
    await recordEvent(pool, {
      organizationId: contact.organization_id, entityType: 'contact', entityId: contact.id,
      destination: 'google_drive', status: 'failed', contentHash, error: error?.message || String(error),
    }).catch(() => undefined);
  }

  return result;
}
