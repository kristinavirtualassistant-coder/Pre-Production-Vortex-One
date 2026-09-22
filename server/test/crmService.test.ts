import assert from 'node:assert/strict';
import { upsertCanonicalLead } from '../services/crmService';

const queries: string[] = [];
const client = {
  async query(sql: string, values?: unknown[]) {
    queries.push(sql);
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
    if (sql.includes('FROM properties')) return { rows: [{ id: 'prop_1', owner_id: 'owner_1', address: '1 Main St' }], rowCount: 1 };
    if (sql.includes('FROM leads')) return { rows: [], rowCount: 0 };
    if (sql.includes('INSERT INTO leads')) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  },
  release() {},
};
const pool = { async connect() { return client; } } as any;

const created = await upsertCanonicalLead(pool, {
  organizationId: 'org_test', ownerId: 'owner_1', propertyId: 'prop_1',
  ownerName: 'Test Owner', propertyAddress: '1 Main St',
});
assert.equal(created.created, true);
assert.ok(created.leadId.startsWith('lead_'));
assert.ok(queries[0] === 'BEGIN');
assert.ok(queries.some((sql) => sql.includes('FOR UPDATE')));
assert.ok(queries.some((sql) => sql.includes('INSERT INTO leads')));
assert.ok(queries.at(-1) === 'COMMIT');

console.log('crm service canonical lead test passed');

const mismatchClient = {
  async query(sql: string) {
    if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
    if (sql.includes('FROM properties')) return { rows: [{ id: 'prop_1', owner_id: 'different_owner' }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  },
  release() {},
};
await assert.rejects(
  upsertCanonicalLead({ async connect() { return mismatchClient; } } as any, {
    organizationId: 'org_test', ownerId: 'owner_1', propertyId: 'prop_1', ownerName: 'Owner', propertyAddress: '1 Main',
  }),
  /Property owner does not match canonical owner/,
);
