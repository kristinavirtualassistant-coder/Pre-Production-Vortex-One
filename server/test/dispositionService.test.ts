import assert from 'node:assert/strict';
import { applyCallDisposition } from '../services/dispositionService';

const queries: string[] = [];
const client = {
  async query(sql: string) {
    queries.push(sql);
    if (sql.includes('SELECT id, lead_id')) return { rows: [{ id: 'call_1', lead_id: 'lead_1', campaign_id: 'camp_1', phone_number: '5551234567' }] };
    return { rows: [] };
  },
  release() {},
};
const pool = { async connect() { return client; } } as any;
await applyCallDisposition(pool, { organizationId: 'org_test', callId: 'call_1', disposition: 'call_back_later', note: 'Follow up next week', followUpAt: '2026-09-10T16:00:00Z' });
assert.ok(queries.some((q) => q.includes('UPDATE call')));
assert.ok(queries.some((q) => q.includes('UPDATE campaign_contact')));
assert.ok(queries.some((q) => q.includes('INSERT INTO activities')));
assert.ok(queries.some((q) => q.includes('INSERT INTO tasks')));
assert.equal(queries[0], 'BEGIN');
assert.equal(queries.at(-1), 'COMMIT');
console.log('disposition service tests passed');
