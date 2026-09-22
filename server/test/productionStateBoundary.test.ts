import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WebhookHandler } from '../dialer/webhookHandler';
import { setPgPoolForTests } from '../db/db';

const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
assert.equal(serverSource.includes('res.json(inMemoryStore.calls);'), false, 'GET /api/calls must not fall back to in-memory calls');
assert.equal(serverSource.includes("{ id: 'evt_1', call_id: req.params.id"), false, 'GET /api/calls/:id/events must not synthesize events');
assert.equal(serverSource.includes("console.warn('PostgreSQL fetch calls fallback:'"), false, 'GET /api/calls must fail closed when PostgreSQL fails');
assert.equal(serverSource.includes("console.warn('PostgreSQL fetch call events fallback:'"), false, 'GET /api/calls/:id/events must fail closed when PostgreSQL fails');

setPgPoolForTests(null);
const result = await WebhookHandler.processWebhook('ringcentral', 'org_test', {
  eventId: `boundary_${Date.now()}`,
  telephonyCallId: 'telephony_1',
  status: 'completed',
});
assert.equal(result.status, 'error');
assert.match(result.error || '', /PostgreSQL is required for authoritative webhook processing/);

console.log('production state boundary checks passed');
