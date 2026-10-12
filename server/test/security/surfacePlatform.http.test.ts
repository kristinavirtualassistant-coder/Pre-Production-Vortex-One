/**
 * APP_SURFACE=platform: the customer platform service has no Owner Portal at all, even for the provisioned owner.
 */
import assert from 'node:assert/strict';
import { api, cleanupTestTenants, createPlatformOwner, createTestTenant, ownerApi, pass, removeOwnerAsAdmin, startTestApp } from './httpHarness';

process.env.APP_SURFACE = 'platform';
const app = await startTestApp();
const owner = await createPlatformOwner(app, 'surfplatowner');
const customer = await createTestTenant(app, 'surfplatcust', 'admin');

try {
  console.log('\n--- Platform surface ---');
  for (const path of ['/api/owner/session', '/api/owner/overview', '/api/owner/organizations']) {
    const r = await ownerApi(app, 'GET', path, owner);
    assert.equal(r.status, 404, `${path} does not exist on the platform surface, even for the owner (got ${r.status})`);
  }
  for (const path of ['/owner', '/owner/login', '/owner/organizations']) {
    const r = await fetch(`${app.baseUrl}${path}`, { redirect: 'manual' });
    assert.equal(r.status, 404, `${path} is not served by the platform (got ${r.status})`);
  }
  pass('the Owner Portal pages and API are 404 on the platform, including for the owner');

  const me = await api(app, 'GET', '/api/auth/me', customer);
  assert.equal(me.status, 200, 'customer API works');
  const signup = await fetch(`${app.baseUrl}/api/auth/signup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.notEqual(signup.status, 404, 'sign-up route exists on the platform (it validates/refuses on its own terms)');
  pass('customer authentication and API are unaffected');
} finally {
  delete process.env.APP_SURFACE;
  await removeOwnerAsAdmin().catch(() => {});
  await cleanupTestTenants(owner, customer);
  await app.close();
}
console.log('\nPlatform surface security tests passed.');
process.exit(0);
