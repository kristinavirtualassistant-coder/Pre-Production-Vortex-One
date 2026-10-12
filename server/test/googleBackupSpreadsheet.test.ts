import assert from 'node:assert/strict';
import { findOrCreateSpreadsheet } from '../services/googleBackupService';

type Call = { url: string; method: string };
const realFetch = globalThis.fetch;

function mockFetch(handler: (url: string, method: string) => unknown): Call[] {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input);
    const method = init.method || 'GET';
    calls.push({ url, method });
    return { ok: true, status: 200, json: async () => handler(url, method) } as Response;
  }) as typeof fetch;
  return calls;
}

try {
  // Lookup is restricted to the backup folder, and an existing spreadsheet there is reused without creating another.
  let calls = mockFetch((url) => (url.includes('/drive/v3/files?q=') ? { files: [{ id: 'sheet_existing' }] } : {}));
  assert.equal(await findOrCreateSpreadsheet('tok', 'folder_1'), 'sheet_existing');
  assert.equal(calls.length, 1);
  assert.ok(decodeURIComponent(calls[0].url).includes("'folder_1' in parents"), 'lookup is scoped to the backup folder');

  // A new spreadsheet is created in Drive root, so it must be moved: add the backup folder and remove the old parents.
  calls = mockFetch((url, method) => {
    if (url.includes('/drive/v3/files?q=')) return { files: [] };
    if (url.startsWith('https://sheets.googleapis.com/v4/spreadsheets')) return { spreadsheetId: 'sheet_new' };
    if (method === 'GET') return { parents: ['root_parent'] };
    return { id: 'sheet_new' };
  });
  assert.equal(await findOrCreateSpreadsheet('tok', 'folder_1'), 'sheet_new');
  const patch = calls.find((c) => c.method === 'PATCH');
  assert.ok(patch, 'the new spreadsheet is moved with a Drive update');
  assert.ok(patch!.url.includes('addParents=folder_1'));
  assert.ok(patch!.url.includes('removeParents=root_parent'), 'old parents are removed so the move succeeds');

  console.log('googleBackupSpreadsheet.test passed');
} finally {
  globalThis.fetch = realFetch;
}
