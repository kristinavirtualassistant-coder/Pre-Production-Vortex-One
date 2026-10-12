/**
 * APP_SURFACE=owner: the Owner Portal service exposes only the portal shell, sign-in/MFA/logout and /api/owner.
 * No sign-up, password reset, customer API, webhook or billing endpoint exists on this surface.
 */
import assert from 'node:assert/strict';
import { resolveAppSurface } from '../../security/appSurface';
import { api, cleanupTestTenants, createPlatformOwner, createTestTenant, ownerApi, pass, removeOwnerAsAdmin, startTestApp } from './httpHarness';

assert.equal(resolveAppSurface({}), 'combined');
assert.equal(resolveAppSurface({ APP_SURFACE: 'Owner' }), 'owner');
assert.throws(() => resolveAppSurface({ APP_SURFACE: 'both' }), /APP_SURFACE must be/);
pass('APP_SURFACE is validated; an unknown value refuses to start');

process.env.APP_SURFACE = 'owner';
const app = await startTestApp();
const owner = await createPlatformOwner(app, 'surfowner');
const customer = await createTestTenant(app, 'surfcust', 'admin');

const raw = (method: string, path: string, body?: unknown) =>
  fetch(`${app.baseUrl}${path}`, { method, redirect: 'manual', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });

try {
  console.log('\n--- Owner surface ---');
  assert.equal((await raw('GET', '/api/health')).status, 200);
  assert.equal((await raw('GET', '/api/ready')).status, 200);
  pass('health and readiness probes are served');

  const absent: Array<[string, string, unknown?]> = [
    ['POST', '/api/auth/signup', { email: 'x@example.invalid', password: 'Correct-Horse-Battery-9', organizationName: 'X', name: 'X' }],
    ['POST', '/api/auth/password-reset/request', { email: 'x@example.invalid' }],
    ['POST', '/api/auth/password-reset/confirm', { token: 'x', password: 'Correct-Horse-Battery-9' }],
    ['POST', '/api/auth/verify-email', { token: 'x' }],
    ['GET', '/api/auth/me'],
    ['POST', '/api/auth/mfa/setup', {}],
    ['GET', '/api/leads'],
    ['GET', '/api/workflows'],
    ['POST', '/api/billing/webhook', {}],
    ['POST', '/api/communications/webhooks/twilio', {}],
    ['POST', '/internal/scheduler/workflows', {}],
  ];
  for (const [method, path, body] of absent) {
    const r = await raw(method, path, body);
    assert.equal(r.status, 404, `${method} ${path} is absent on the owner surface (got ${r.status})`);
  }
  // Even an authenticated customer session reaches no customer API here.
  const asCustomer = await api(app, 'GET', '/api/leads', customer);
  assert.equal(asCustomer.status, 404);
  pass('sign-up, password reset, email verification, MFA setup, customer API, webhooks and scheduler are all 404');

  assert.equal((await raw('GET', '/api/owner/overview')).status, 401, 'owner API still requires authentication');
  const customerOnOwner = await ownerApi(app, 'GET', '/api/owner/overview', customer);
  assert.equal(customerOnOwner.status, 403, 'a customer admin is not the owner');
  const session = await ownerApi(app, 'GET', '/api/owner/session', owner);
  assert.equal(session.status, 200, `the provisioned owner signs in with MFA and reaches the portal (got ${session.status})`);
  pass('owner sign-in + MFA works; non-owners are refused; unauthenticated requests get 401');

  for (const path of ['/', '/dashboard', '/signup', '/settings']) {
    const r = await raw('GET', path);
    assert.equal(r.status, 302, `${path} redirects`);
    assert.equal(r.headers.get('location'), '/owner');
  }
  assert.equal((await raw('POST', '/anything', {})).status, 404);
  pass('every non-portal page redirects to /owner; other methods are 404');
} finally {
  delete process.env.APP_SURFACE;
  await removeOwnerAsAdmin().catch(() => {});
  await cleanupTestTenants(owner, customer);
  await app.close();
}
console.log('\nOwner surface security tests passed.');
process.exit(0);
