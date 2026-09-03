import assert from 'node:assert/strict';
import { applyCallDisposition } from '../services/dispositionService';

function makeClient(options: { call?: any; dispositionEventExists?: boolean; failOn?: string } = {}) {
  const queries: Array<{ sql: string; values?: any[] }> = [];
  const client = {
    async query(sql: string, values?: any[]) {
      queries.push({ sql, values });
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (options.failOn && sql.includes(options.failOn)) throw new Error('forced failure');
      if (sql.includes('SELECT c.id, c.lead_id, c.campaign_id')) {
        return { rows: options.call === undefined ? [{ id: 'call_1', lead_id: 'lead_1', campaign_id: 'camp_1', phone_number: '(555) 123-4567', assigned_agent: 'agent_9' }] : (options.call ? [options.call] : []) };
      }
      if (sql.includes('SELECT 1 FROM call_event')) return { rowCount: options.dispositionEventExists ? 1 : 0, rows: [] };
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  return {
    client,
    pool: { async connect() { return client; } } as any,
    queries,
  };
}

{
  const mock = makeClient();
  const result = await applyCallDisposition(mock.pool, {
    organizationId: 'org_test', callId: 'call_1', disposition: 'call_back_later',
    note: 'Follow up next week', followUpAt: '2026-09-10T16:00:00Z', createdBy: 'agent_9',
  });
  assert.equal(result.status, 'applied');
  assert.ok(mock.queries.some((q) => q.sql.includes('INSERT INTO call_event')));
  assert.ok(mock.queries.some((q) => q.sql.includes('UPDATE call')));
  assert.ok(mock.queries.some((q) => q.sql.includes('UPDATE campaign_contact')));
  assert.ok(mock.queries.some((q) => q.sql.includes('UPDATE leads')));
  assert.ok(mock.queries.some((q) => q.sql.includes('INSERT INTO activities')));
  assert.ok(mock.queries.some((q) => q.sql.includes('INSERT INTO tasks')));
  assert.equal(mock.queries[0].sql, 'BEGIN');
  assert.equal(mock.queries.at(-1)?.sql, 'COMMIT');
}

{
  const mock = makeClient({ dispositionEventExists: true });
  const result = await applyCallDisposition(mock.pool, {
    organizationId: 'org_test', callId: 'call_1', disposition: 'interested', createdBy: 'agent_9',
  });
  assert.equal(result.status, 'duplicate_ignored');
  assert.equal(mock.queries.at(-1)?.sql, 'ROLLBACK');
  assert.equal(mock.queries.filter((q) => q.sql.includes('UPDATE call')).length, 0);
}

{
  const mock = makeClient({ failOn: 'INSERT INTO activities' });
  await assert.rejects(() => applyCallDisposition(mock.pool, {
    organizationId: 'org_test', callId: 'call_1', disposition: 'interested', createdBy: 'agent_9',
  }), /forced failure/);
  assert.equal(mock.queries.at(-1)?.sql, 'ROLLBACK');
}

{
  const mock = makeClient();
  await applyCallDisposition(mock.pool, {
    organizationId: 'org_test', callId: 'call_1', disposition: 'do_not_call', note: 'Requested DNC', createdBy: 'agent_9',
  });
  const suppression = mock.queries.find((q) => q.sql.includes('INSERT INTO suppression_record'));
  assert.ok(suppression, 'DNC disposition must create durable suppression in the same transaction');
  assert.equal(suppression?.values?.[1], 'org_test');
  assert.equal(suppression?.values?.[2], '5551234567');
  assert.equal(mock.queries.filter((q) => q.sql.includes('INSERT INTO tasks')).length, 0);
}

{
  const mock = makeClient({ call: null });
  await assert.rejects(() => applyCallDisposition(mock.pool, {
    organizationId: 'other_org', callId: 'call_1', disposition: 'interested',
  }), /Call not found/);
}

{
  const mock = makeClient();
  await assert.rejects(() => applyCallDisposition(mock.pool, {
    organizationId: 'org_test', callId: 'call_1', disposition: 'call_back_later',
  }), /followUpAt is required/);
}

{
  const mock = makeClient();
  await assert.rejects(() => applyCallDisposition(mock.pool, {
    organizationId: 'org_test', callId: 'call_1', disposition: 'interested', followUpAt: 'not-a-date',
  }), /valid timestamp/);
}

console.log('disposition service tests passed');
