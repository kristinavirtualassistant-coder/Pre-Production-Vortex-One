import assert from 'node:assert/strict';
import fs from 'node:fs';

const serverSource = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');

function routeBody(marker: string, nextMarker: string): string {
  const start = serverSource.indexOf(marker);
  assert.ok(start >= 0, `route marker not found: ${marker}`);
  const end = serverSource.indexOf(nextMarker, start + marker.length);
  assert.ok(end > start, `route end marker not found after ${marker}`);
  return serverSource.slice(start, end);
}

{
  const body = routeBody("app.post('/api/calls/:id/drop-voicemail'", "app.patch('/api/calls/:id'");
  assert.match(body, /organization_id = \$3/, 'voicemail drop update must scope the call to authenticated organization');
  assert.match(body, /requireOrganizationId\(\(req as AuthRequest\)\.dbUser\?\.organization_id\)/, 'voicemail drop must derive tenant from auth context');
  assert.match(body, /status\(404\)/, 'voicemail drop must report a missing tenant-owned call as 404');
  assert.doesNotMatch(body, /Postgres call update skipped/, 'voicemail drop must not silently swallow authoritative database failures');
  assert.match(body, /client\.query\('BEGIN'\)/, 'voicemail drop must update the call and audit log transactionally');
  assert.match(body, /client\.query\('COMMIT'\)/, 'voicemail drop must commit only after the audit log succeeds');
}

{
  const body = routeBody("app.patch('/api/calls/:id'", "app.post('/api/calls/:id/notes'");
  assert.match(body, /organization_id = \$3/, 'PATCH call notes must scope updates to authenticated organization');
  assert.match(body, /requireOrganizationId\(\(req as AuthRequest\)\.dbUser\?\.organization_id\)/, 'PATCH call notes must derive tenant from auth context');
  assert.match(body, /status\(404\)/, 'PATCH call notes must report a missing tenant-owned call as 404');
}

{
  const body = routeBody("app.post('/api/calls/:id/notes'", "app.post('/api/calls/:id/end'");
  assert.match(body, /organization_id = \$3/, 'POST call notes must scope updates to authenticated organization');
  assert.match(body, /requireOrganizationId\(\(req as AuthRequest\)\.dbUser\?\.organization_id\)/, 'POST call notes must derive tenant from auth context');
  assert.match(body, /status\(404\)/, 'POST call notes must report a missing tenant-owned call as 404');
}

{
  const body = routeBody("app.post('/api/calls/:id/suggest-task'", "app.post('/api/ai/analyze-call'");
  assert.match(body, /organization_id = \$2/, 'task suggestion lookup must scope the call to authenticated organization');
  assert.match(body, /requireOrganizationId\(\(req as AuthRequest\)\.dbUser\?\.organization_id\)/, 'task suggestion must derive tenant from auth context');
}

{
  const body = routeBody("app.post('/api/calls/:id/disposition'", "app.post('/api/calls/:id/suggest-task'");
  assert.match(body, /const result = await applyCallDisposition/, 'disposition route must preserve the transactional service result');
  assert.match(body, /status: result\.status/, 'disposition response must expose idempotent result status');
  assert.match(body, /followUpTaskId: result\.followUpTaskId/, 'disposition response must expose follow-up task identity');
  assert.match(body, /status\(400\)/, 'disposition validation errors must be client errors');
  assert.match(body, /status\(404\)/, 'missing calls must be client-visible as 404');
}

console.log('call action tenant boundary tests passed');


{
  const body = routeBody("app.post('/api/calls/dial'", "  // DNC & Suppression List Management APIs");
  assert.match(body, /requireOrganizationId/, 'manual dial must derive tenant from authenticated context');
  assert.match(body, /getPgPool\(\)/, 'manual dial must require PostgreSQL');
  assert.match(body, /idempotencyKey/, 'manual dial must require an idempotency key');
  assert.match(body, /ManualDialService\.dial/, 'manual dial must use the authoritative dialing service');
  assert.doesNotMatch(body, /555-0100|Math\.random\(\).*duration|status: 'completed'/, 'manual dial route must not synthesize calls or fake completion data');
}
