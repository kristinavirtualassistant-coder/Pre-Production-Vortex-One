/** Sign-up policy, anti-enumeration, MFA replay protection, demo-mode gate, email validation. */
process.env.RATE_LIMIT_MULTIPLIER = '1000';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTotpSecret, encryptMfaSecret, totpCode } from '../../services/accountSecurity';
import { isDemoModeEnabled } from '../../security/demoMode';
import { api, cleanupTestTenants, createTestTenant, pass, requirePool, startTestApp } from './httpHarness';

const app = await startTestApp();
const pool = requirePool();
const tenant = await createTestTenant(app, 'abuse', 'admin');
const run = randomUUID().slice(0, 8);
const PASSWORD = 'Correct-Horse-Battery-9';
const createdOrgs: string[] = [];

try {
  console.log('\n--- Security: authentication abuse protection ---');

  // Demo mode is never enabled in production, whatever the flags say.
  assert.equal(isDemoModeEnabled({ NODE_ENV: 'production', DEMO_MODE_ENABLED: 'true', VORTEX_ONE_SEED_DEMO_DATA: '1' } as any), false);
  assert.equal(isDemoModeEnabled({ NODE_ENV: 'development' } as any), false);
  assert.equal(isDemoModeEnabled({ NODE_ENV: 'development', DEMO_MODE_ENABLED: 'true' } as any), true);
  pass('demo mode is off by default and can never be enabled in production');

  // Anti-enumeration: signing up with a registered email looks exactly like a new sign-up.
  const fresh = await api(app, 'POST', '/api/auth/signup', null, { email: `new.${run}@security-test.invalid`, password: PASSWORD, name: 'New User', organizationName: `Abuse Org ${run}` });
  const dup = await api(app, 'POST', '/api/auth/signup', null, { email: tenant.email, password: PASSWORD, name: 'Dup', organizationName: `Abuse Org Dup ${run}` });
  assert.equal(fresh.status, 201, fresh.text);
  assert.equal(dup.status, 201, 'existing email gets the same status as a new account');
  assert.deepEqual(Object.keys(dup.json).sort(), Object.keys(fresh.json).sort().filter((k) => k !== 'verificationUrl'));
  assert.ok(!/already exists|registered/i.test(dup.text));
  const orgRows = await pool.query("SELECT 1 FROM organizations WHERE name=$1", [`Abuse Org Dup ${run}`]);
  assert.equal(orgRows.rowCount, 0, 'no organization was created for the duplicate sign-up');
  pass('sign-up with an existing email is indistinguishable from a new sign-up and creates nothing');

  const orgCollision = await api(app, 'POST', '/api/auth/signup', null, { email: `other.${run}@security-test.invalid`, password: PASSWORD, name: 'Other', organizationName: `Abuse Org ${run}` });
  assert.equal(orgCollision.status, 409);
  assert.ok(!/organization/i.test(orgCollision.json.error), 'organization-name collision message is generic');
  pass('organization-name collisions return a generic error');

  // Email validation regex is no longer double-escaped (it used to reject every address).
  const bad = await api(app, 'POST', '/api/auth/signup', null, { email: 'not-an-email', password: PASSWORD, name: 'x', organizationName: 'Bad Email Org' });
  assert.equal(bad.status, 400);
  pass('invalid emails are rejected, valid ones accepted');

  // Sign-up policy toggles are read per request.
  process.env.SIGNUP_ENABLED = 'false';
  const closed = await api(app, 'POST', '/api/auth/signup', null, { email: `closed.${run}@security-test.invalid`, password: PASSWORD, name: 'x', organizationName: `Closed Org ${run}` });
  assert.equal(closed.status, 403);
  delete process.env.SIGNUP_ENABLED;
  process.env.SIGNUP_ALLOWED_DOMAINS = 'allowed.invalid';
  const wrongDomain = await api(app, 'POST', '/api/auth/signup', null, { email: `x.${run}@security-test.invalid`, password: PASSWORD, name: 'x', organizationName: `Domain Org ${run}` });
  assert.equal(wrongDomain.status, 403);
  delete process.env.SIGNUP_ALLOWED_DOMAINS;
  pass('SIGNUP_ENABLED=false and SIGNUP_ALLOWED_DOMAINS restrict organization creation');

  // MFA: a TOTP code can be used once.
  const secret = createTotpSecret();
  await pool.query('UPDATE users SET mfa_enabled=true, mfa_secret=$1, mfa_last_totp_step=NULL WHERE id=$2', [encryptMfaSecret(secret), tenant.userId]);
  const challenge = async () => {
    const r = await fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.9' }, body: JSON.stringify({ email: tenant.email, password: PASSWORD }) });
    const body: any = await r.json();
    assert.ok(body.challengeToken, `MFA challenge issued (${JSON.stringify(body)})`);
    return body.challengeToken as string;
  };
  const code = totpCode(secret);
  const first = await api(app, 'POST', '/api/auth/mfa/verify', null, { challengeToken: await challenge(), code });
  assert.equal(first.status, 200, first.text);
  const replay = await api(app, 'POST', '/api/auth/mfa/verify', null, { challengeToken: await challenge(), code });
  assert.equal(replay.status, 401, 'the same TOTP code cannot be replayed');
  pass('TOTP codes cannot be replayed');
  await pool.query('UPDATE users SET mfa_enabled=false, mfa_secret=NULL WHERE id=$1', [tenant.userId]);
} finally {
  const orgs = await pool.query("SELECT id FROM organizations WHERE name LIKE $1", [`%${run}`]);
  for (const o of orgs.rows) createdOrgs.push(o.id);
  for (const id of createdOrgs) await cleanupTestTenants({ organizationId: id });
  await pool.query("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE '%security-test.invalid%'").catch(() => {});
  await cleanupTestTenants(tenant);
  await app.close();
  await pool.end().catch(() => {});
}
