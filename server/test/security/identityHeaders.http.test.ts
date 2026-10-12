/**
 * The authenticated PostgreSQL user (session -> users -> organization -> role) is the ONLY source of identity.
 * Client-supplied x-user-id / x-user-email / x-user-role / x-organization-id and query/body organization ids
 * must never change who the caller is or which tenant they act in.
 */
import assert from 'node:assert/strict';
import { addTestUser, api, cleanupTestTenants, createTestTenant, pass, requirePool, startTestApp } from './httpHarness';

const app = await startTestApp();
const pool = requirePool();
const tenantA = await createTestTenant(app, 'idenA', 'admin');
const tenantB = await createTestTenant(app, 'idenB', 'admin');
const memberA = await addTestUser(app, tenantA, 'idenAmember', 'member');
const MARKER = 'IDENTITY-MARKER-A';

try {
  console.log('\n--- Security: canonical tenant identity ---');
  const campaign = await api(app, 'POST', '/api/campaigns', tenantA, { name: MARKER });
  assert.equal(campaign.status, 201, `tenant A creates a campaign (${campaign.text})`);

  let me = await api(app, 'GET', '/api/auth/me', tenantA, undefined, { 'x-user-id': tenantB.userId, 'x-user-email': tenantB.email, 'x-user-role': 'admin' });
  assert.equal(me.status, 200);
  assert.equal(me.json.user?.id ?? me.json.id, tenantA.userId);
  assert.equal(me.json.user?.email ?? me.json.email, tenantA.email);
  assert.ok(!me.text.includes(tenantB.userId) && !me.text.includes(tenantB.email));
  pass('spoofed x-user-id / x-user-email / x-user-role headers do not change the authenticated identity');

  let res = await api(app, 'GET', '/api/campaigns', tenantB, undefined, { 'x-organization-id': tenantA.organizationId });
  assert.ok([401, 403].includes(res.status), `organization header naming another tenant is rejected (got ${res.status})`);
  assert.ok(!res.text.includes(MARKER));
  pass('x-organization-id naming another tenant is rejected and returns no data');

  res = await api(app, 'GET', `/api/campaigns?organizationId=${encodeURIComponent(tenantA.organizationId)}`, tenantB);
  assert.ok([401, 403].includes(res.status), `?organizationId=<other tenant> is rejected (got ${res.status})`);
  assert.ok(!res.text.includes(MARKER));
  pass('?organizationId= naming another tenant is rejected and returns no data');

  res = await api(app, 'POST', '/api/campaigns', tenantB, { name: 'attack', organizationId: tenantA.organizationId });
  assert.ok([401, 403].includes(res.status), `body organizationId naming another tenant is rejected (got ${res.status})`);
  res = await api(app, 'POST', '/api/campaigns', tenantB, { name: 'attack', organization_id: tenantA.organizationId });
  assert.ok([401, 403].includes(res.status));
  const leaked = await pool.query("SELECT 1 FROM campaign WHERE name='attack'");
  assert.equal(leaked.rowCount, 0);
  pass('body organizationId / organization_id naming another tenant cannot create data in that tenant');

  res = await api(app, 'GET', '/api/campaigns', tenantB, undefined, { 'x-organization-id': tenantB.organizationId });
  assert.equal(res.status, 200);
  assert.ok(!res.text.includes(MARKER));
  pass("a client organization id that matches the authenticated organization is accepted; the tenant sees only its own data");

  res = await api(app, 'POST', '/api/campaigns', memberA, { name: 'member-attempt' }, { 'x-user-role': 'admin', 'x-user-id': tenantA.userId });
  assert.equal(res.status, 403);
  pass('a spoofed x-user-role header cannot escalate a member to a role that can create campaigns');

  res = await api(app, 'POST', '/api/campaigns', null, { name: 'anon' }, { 'x-user-id': tenantA.userId, 'x-organization-id': tenantA.organizationId });
  assert.equal(res.status, 401);
  pass('identity headers without a valid session are never an authentication mechanism');
} finally {
  await pool.query('DELETE FROM campaign WHERE organization_id = ANY($1)', [[tenantA.organizationId, tenantB.organizationId]]).catch(() => {});
  await cleanupTestTenants(tenantA, tenantB);
  await app.close();
}
console.log('Identity header security tests passed.');
