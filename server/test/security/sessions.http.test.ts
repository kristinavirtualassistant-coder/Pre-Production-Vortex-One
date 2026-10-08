/** Session lifecycle: idle timeout, absolute lifetime, revocation, revoke-all, rotation, cookie-only transport. */
import assert from 'node:assert/strict';
import { api, cleanupTestTenants, createTestTenant, login, pass, requirePool, startTestApp } from './httpHarness';

const app = await startTestApp();
const pool = requirePool();
const tenant = await createTestTenant(app, 'sess', 'admin');
const authed = (token: string) => ({ auth: { Authorization: `Bearer ${token}` } });
const me = (token: string) => api(app, 'GET', '/api/auth/me', authed(token));
const hashOf = async (token: string) => (await import('../../services/postgresqlAuth')).hashSessionToken(token);
const PASSWORD = 'Correct-Horse-Battery-9';

try {
  console.log('\n--- Security: sessions ---');
  assert.equal((await me(tenant.token)).status, 200);

  // Cookie-only transport: no token in the JSON body unless an API client opts in.
  const plain = await fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.77' }, body: JSON.stringify({ email: tenant.email, password: PASSWORD }) });
  const plainBody: any = await plain.json();
  assert.equal(plain.status, 200);
  assert.equal(plainBody.token, undefined, 'token is not returned in the JSON body by default');
  const cookie = plain.headers.get('set-cookie') || '';
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Max-Age=2592000/, 'cookie lifetime is the 30 day absolute lifetime');
  pass('login sets an HttpOnly 30-day cookie and does not return the token in the body');

  // Absolute lifetime is stored at issue.
  const life = await pool.query("SELECT (expires_at - created_at) AS span FROM auth_sessions WHERE token_hash=$1", [await hashOf(tenant.token)]);
  assert.ok(life.rows[0], 'session row exists');
  const days = Number(await pool.query("SELECT EXTRACT(EPOCH FROM (expires_at - created_at))/86400 AS d FROM auth_sessions WHERE token_hash=$1", [await hashOf(tenant.token)]).then((r) => r.rows[0].d));
  assert.ok(days > 29.9 && days < 30.1, `absolute lifetime is ~30 days (got ${days})`);
  pass('new sessions expire after 30 days (absolute)');

  // Idle timeout.
  const idle = await login(app, tenant.email);
  assert.equal((await me(idle)).status, 200);
  await pool.query("UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP - INTERVAL '25 hours' WHERE token_hash=$1", [await hashOf(idle)]);
  assert.equal((await me(idle)).status, 401);
  pass('a session idle for more than 24h is rejected');
  const nearIdle = await login(app, tenant.email);
  await pool.query("UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP - INTERVAL '23 hours' WHERE token_hash=$1", [await hashOf(nearIdle)]);
  assert.equal((await me(nearIdle)).status, 200);
  pass('a session idle for less than 24h is accepted (and refreshed)');

  // Absolute expiry.
  const old = await login(app, tenant.email);
  await pool.query("UPDATE auth_sessions SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE token_hash=$1", [await hashOf(old)]);
  assert.equal((await me(old)).status, 401);
  pass('a session past its absolute expiry is rejected');

  // Logout revokes server-side.
  const out = await login(app, tenant.email);
  assert.equal((await api(app, 'POST', '/api/auth/logout', authed(out))).status, 204);
  assert.equal((await me(out)).status, 401);
  pass('logout revokes the session server-side');

  // Revoke by id, revoke others, revoke all.
  const a = await login(app, tenant.email);
  const b = await login(app, tenant.email);
  const list = await api(app, 'GET', '/api/auth/sessions', authed(a));
  assert.equal(list.status, 200);
  const bRow = (await pool.query('SELECT id FROM auth_sessions WHERE token_hash=$1', [await hashOf(b)])).rows[0];
  assert.equal((await api(app, 'POST', `/api/auth/sessions/${bRow.id}/revoke`, authed(a))).status, 200);
  assert.equal((await me(b)).status, 401);
  assert.equal((await me(a)).status, 200);
  pass('revoke-by-id revokes exactly that session');

  const c = await login(app, tenant.email);
  assert.equal((await api(app, 'POST', '/api/auth/sessions/revoke-others', authed(a))).status, 200);
  assert.equal((await me(c)).status, 401);
  assert.equal((await me(a)).status, 200);
  pass('revoke-others keeps only the current session');

  const other = await createTestTenant(app, 'sessOther', 'admin');
  const otherSession = (await pool.query('SELECT id FROM auth_sessions WHERE token_hash=$1', [await hashOf(other.token)])).rows[0];
  assert.equal((await api(app, 'POST', `/api/auth/sessions/${otherSession.id}/revoke`, authed(a))).status, 404);
  assert.equal((await me(other.token)).status, 200);
  pass("a user cannot revoke another user's session by id");
  await cleanupTestTenants(other);

  assert.equal((await api(app, 'POST', '/api/auth/sessions/revoke-all', authed(a))).status, 200);
  assert.equal((await me(a)).status, 401);
  pass('revoke-all revokes every session including the current one');

  // Rotation: a presented session is revoked when the user authenticates again.
  const stale = await login(app, tenant.email);
  const rotated = await fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-session-transport': 'bearer', authorization: `Bearer ${stale}`, 'x-forwarded-for': '192.0.2.78' }, body: JSON.stringify({ email: tenant.email, password: PASSWORD }) });
  assert.equal(rotated.status, 200);
  assert.equal((await me(stale)).status, 401, 'the presented session was revoked on login');
  assert.equal((await me(((await rotated.json()) as any).token)).status, 200);
  pass('logging in again rotates away the session that was presented');

  // Disabled user.
  const live = await login(app, tenant.email);
  await pool.query('UPDATE users SET disabled_at=CURRENT_TIMESTAMP WHERE id=$1', [tenant.userId]);
  assert.equal((await me(live)).status, 401);
  pass('disabling the user invalidates existing sessions');
} finally {
  await cleanupTestTenants(tenant);
  await app.close();
  await pool.end().catch(() => {});
}
