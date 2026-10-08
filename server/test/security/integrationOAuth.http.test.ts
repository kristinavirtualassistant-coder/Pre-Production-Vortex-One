/** Integration OAuth: authenticated start, PKCE+state, browser-bound callback, no OAuth login / email auto-link. */
process.env.GOOGLE_INTEGRATION_CLIENT_ID = 'test-client-id';
process.env.GOOGLE_INTEGRATION_CLIENT_SECRET = 'test-client-secret';
import assert from 'node:assert/strict';
import { addTestUser, api, cleanupTestTenants, createTestTenant, pass, requirePool, startTestApp } from './httpHarness';

const app = await startTestApp();
const pool = requirePool();
const admin = await createTestTenant(app, 'oauth', 'admin');
const member = await addTestUser(app, admin, 'oauthMember', 'member');

try {
  console.log('\n--- Security: integration OAuth ---');
  assert.equal((await api(app, 'GET', '/api/integrations/oauth/start/google-workspace', null)).status, 401);
  assert.equal((await api(app, 'GET', '/api/integrations/oauth/start/google-workspace', member)).status, 403);
  pass('starting an OAuth connection requires an authenticated manager-or-above user');

  assert.equal((await api(app, 'GET', '/api/integrations/oauth/start/not-a-provider', admin)).status, 404);

  const start = await fetch(`${app.baseUrl}/api/integrations/oauth/start/google-workspace`, { headers: admin.auth });
  const startBody: any = await start.json();
  assert.equal(start.status, 200, JSON.stringify(startBody));
  const url = new URL(startBody.authorizationUrl);
  assert.equal(url.hostname, 'accounts.google.com');
  assert.ok(url.searchParams.get('state') && url.searchParams.get('state')!.length >= 40, 'unguessable state');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.ok(url.searchParams.get('code_challenge'));
  const setCookie = start.headers.get('set-cookie') || '';
  assert.match(setCookie, /vortex_oauth_nonce=/);
  assert.match(setCookie, /HttpOnly/);
  pass('start issues an unguessable state, PKCE S256 challenge and an HttpOnly browser nonce cookie');

  const state = url.searchParams.get('state')!;
  const nonce = decodeURIComponent((setCookie.match(/vortex_oauth_nonce=([^;]+)/) || [])[1]);

  const noCookie = await fetch(`${app.baseUrl}/api/integrations/oauth/callback/google-workspace?state=${state}&code=abc`, { redirect: 'manual' });
  assert.equal(noCookie.status, 302);
  assert.match(noCookie.headers.get('location') || '', /integrationError=/);
  const wrongCookie = await fetch(`${app.baseUrl}/api/integrations/oauth/callback/google-workspace?state=${state}&code=abc`, { redirect: 'manual', headers: { cookie: 'vortex_oauth_nonce=attacker-browser' } });
  assert.match(wrongCookie.headers.get('location') || '', /integrationError=/);
  const stillThere = await pool.query('SELECT 1 FROM integration_oauth_states WHERE organization_id=$1', [admin.organizationId]);
  assert.equal(stillThere.rowCount, 1, 'a failed cross-browser attempt does not consume the legitimate state');
  const connections = await pool.query('SELECT 1 FROM integration_connections WHERE organization_id=$1', [admin.organizationId]);
  assert.equal(connections.rowCount, 0);
  pass('a callback from a different browser (missing/wrong nonce) is refused and links nothing');
  void nonce;

  const unknownState = await fetch(`${app.baseUrl}/api/integrations/oauth/callback/google-workspace?state=bogus&code=abc`, { redirect: 'manual', headers: { cookie: `vortex_oauth_nonce=${nonce}` } });
  assert.match(unknownState.headers.get('location') || '', /integrationError=/);
  pass('an unknown state is refused');

  const list = await api(app, 'GET', '/api/integrations', admin);
  assert.equal(list.status, 200);
  assert.ok(!/access_token|refresh_token/.test(list.text), 'connection listing never exposes tokens');
  pass('connection listing never exposes tokens');

  // There is no OAuth sign-in surface, hence no auto-linking of an external identity to a user by email.
  for (const path of ['/api/auth/oauth/google', '/api/auth/google', '/api/auth/oauth/callback', '/api/auth/sso']) {
    const r = await api(app, 'GET', path, null);
    assert.ok([401, 404].includes(r.status), `${path} is not an OAuth login endpoint (got ${r.status})`);
  }
  pass('no OAuth login endpoints exist (no email-based account auto-linking is possible)');
} finally {
  await pool.query('DELETE FROM integration_oauth_states WHERE organization_id=$1', [admin.organizationId]).catch(() => {});
  await cleanupTestTenants(admin);
  await app.close();
  await pool.end().catch(() => {});
}
