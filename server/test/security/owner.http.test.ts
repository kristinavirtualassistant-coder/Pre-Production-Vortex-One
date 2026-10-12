/**
 * Platform Owner portal: authentication, authorization, isolation, audit, support mode, backups, protected tables.
 * Runs against the real app in production mode as the least-privileged database role.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { requireOrganizationAdmin, requireOrganizationMember } from '../../security/platformAuthorization';
import {
  addTestUser, adminClient, api, cleanupTestTenants, createPlatformOwner, createTestTenant, loginWithMfa, ownerApi, pass,
  provisionOwnerAsAdmin, removeOwnerAsAdmin, requirePool, startTestApp,
} from './httpHarness';

const app = await startTestApp();
const pool = requirePool();
const run = randomUUID().slice(0, 8);

const owner = await createPlatformOwner(app, 'owner');
const A = await createTestTenant(app, 'ownA', 'admin');
const A2 = await addTestUser(app, A, 'ownAmember', 'member');
const B = await createTestTenant(app, 'ownB', 'admin');
const createdOrgs: string[] = [];

const auditRows = async (action: string, extra = '') =>
  (await pool.query(`SELECT * FROM platform_audit_logs WHERE action = $1 ${extra} ORDER BY created_at DESC`, [action])).rows;
const ownerGetPaths = ['/api/owner/session', '/api/owner/overview', '/api/owner/organizations', '/api/owner/users', '/api/owner/usage',
  '/api/owner/audit-logs', '/api/owner/system', '/api/owner/backups', '/api/owner/settings'];

try {
  console.log('\n--- Owner portal: authentication and authorization ---');

  // 1. unauthenticated
  for (const path of ownerGetPaths) {
    const r = await api(app, 'GET', path, null);
    assert.equal(r.status, 401, `${path} unauthenticated -> 401 (got ${r.status})`);
    assert.ok(!/organizations|users"|total/i.test(r.text.replace('Authentication required', '')), `${path} leaks nothing before auth`);
  }
  pass('unauthenticated requests to every owner endpoint are rejected with 401 and no data');

  // 2/3. ordinary customer user and organization admin
  for (const [who, label] of [[A2, 'customer member'], [A, 'organization admin'], [B, 'other organization admin']] as const) {
    for (const path of ownerGetPaths) {
      const r = await ownerApi(app, 'GET', path, who);
      assert.equal(r.status, 403, `${label} ${path} -> 403 (got ${r.status})`);
      assert.deepEqual(r.json, { error: 'Forbidden' }, `${label} gets a generic body`);
    }
  }
  const denied = await auditRows('owner.access_denied', `AND actor_user_id = '${A.userId}'`);
  assert.ok(denied.length >= ownerGetPaths.length, 'denied owner access attempts are audited (and survive the request rollback)');
  assert.equal(denied[0].result, 'denied');
  pass('customer users and organization admins are denied (403) and every attempt is audited');

  // 3b. client-supplied flags are never trusted
  const spoof = await ownerApi(app, 'GET', '/api/owner/overview?platform_owner=true&role=platform_owner&organizationId=x', A, undefined,
    { 'x-platform-owner': 'true', 'x-user-role': 'platform_owner', 'x-role': 'platform_owner', 'x-organization-id': A.organizationId });
  assert.equal(spoof.status, 403);
  const spoofBody = await ownerApi(app, 'POST', '/api/owner/organizations', A, { name: `Spoof ${run}`, platform_owner: true, role: 'platform_owner' });
  assert.equal(spoofBody.status, 403);
  assert.equal((await pool.query('SELECT 1 FROM organizations WHERE name = $1', [`Spoof ${run}`])).rowCount, 0);
  pass('spoofed platform_owner flags in headers, query or body do not grant access');

  // 4. the platform owner
  for (const path of ownerGetPaths) {
    const r = await ownerApi(app, 'GET', path, owner);
    assert.equal(r.status, 200, `owner ${path} -> 200 (got ${r.status}: ${r.text.slice(0, 120)})`);
    assert.equal(r.json && typeof r.json === 'object', true);
  }
  const me = await ownerApi(app, 'GET', '/api/owner/session', owner);
  assert.equal(me.json.owner.role, 'platform_owner');
  assert.equal(me.json.owner.mfaVerified, true);
  pass('the provisioned platform owner is accepted on every owner endpoint');

  // 5. unknown route: authorization first, 404 only for the owner
  assert.equal((await api(app, 'GET', '/api/owner/does-not-exist', null)).status, 401);
  assert.equal((await ownerApi(app, 'GET', '/api/owner/does-not-exist', A)).status, 403);
  assert.equal((await ownerApi(app, 'GET', '/api/owner/does-not-exist', owner)).status, 404);
  pass('unknown owner routes reveal nothing to non-owners');

  // 6. MFA: required for the owner in production
  const staleOwnerSession = await (async () => {
    // a session created without MFA, then MFA enabled afterwards: must not satisfy the owner portal
    await pool.query('UPDATE users SET mfa_enabled = false WHERE id = $1', [owner.userId]);
    const plain = await fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-session-transport': 'bearer' }, body: JSON.stringify({ email: owner.email, password: 'Correct-Horse-Battery-9' }) });
    const body: any = await plain.json();
    await pool.query('UPDATE users SET mfa_enabled = true WHERE id = $1', [owner.userId]);
    return body.token as string;
  })();
  const noMfa = await ownerApi(app, 'GET', '/api/owner/overview', { auth: { Authorization: `Bearer ${staleOwnerSession}` } });
  assert.equal(noMfa.status, 403);
  assert.equal(noMfa.json.code, 'MFA_REQUIRED');
  await pool.query('UPDATE users SET mfa_enabled = false WHERE id = $1', [owner.userId]);
  const mfaOff = await ownerApi(app, 'GET', '/api/owner/overview', owner);
  assert.equal(mfaOff.status, 403, 'owner without MFA enabled is refused in production');
  await pool.query('UPDATE users SET mfa_enabled = true WHERE id = $1', [owner.userId]);
  assert.equal((await ownerApi(app, 'GET', '/api/owner/overview', owner)).status, 200);
  pass('owner portal requires an MFA-verified session in production');

  console.log('\n--- Owner portal: CSRF, refresh and expiry ---');
  const noHeader = await api(app, 'POST', '/api/owner/organizations', owner, { name: `NoCsrf ${run}` });
  assert.equal(noHeader.status, 403);
  const badOrigin = await ownerApi(app, 'POST', '/api/owner/organizations', owner, { name: `BadOrigin ${run}` }, { origin: 'https://evil.example' });
  assert.equal(badOrigin.status, 403);
  assert.equal((await pool.query('SELECT 1 FROM organizations WHERE name IN ($1,$2)', [`NoCsrf ${run}`, `BadOrigin ${run}`])).rowCount, 0);
  pass('state-changing owner requests need the owner header and a same-origin Origin');

  // refresh: cookie only (no Authorization header) keeps working; an expired session is rejected
  const cookieLogin = await (async () => {
    const t = await loginWithMfa(app, owner.email, owner.mfaSecret);
    const sess = await pool.query('SELECT 1 FROM auth_sessions WHERE token_hash = $1', [(await import('../../services/postgresqlAuth')).hashSessionToken(t)]);
    assert.equal(sess.rowCount, 1);
    return t;
  })();
  const viaCookie = await fetch(`${app.baseUrl}/api/owner/session`, { headers: { cookie: `__Host-vortex_session=${cookieLogin}; vortex_session=${cookieLogin}` } });
  assert.equal(viaCookie.status, 200, 'a reload sends only the HttpOnly cookie and stays authenticated');
  assert.equal(viaCookie.headers.get('cache-control'), 'no-store');
  await pool.query("UPDATE auth_sessions SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE token_hash = $1", [(await import('../../services/postgresqlAuth')).hashSessionToken(cookieLogin)]);
  const expired = await ownerApi(app, 'GET', '/api/owner/session', { auth: { Authorization: `Bearer ${cookieLogin}` } });
  assert.equal(expired.status, 401);
  pass('owner pages stay authenticated across refresh via the HttpOnly cookie; expired sessions get 401');

  console.log('\n--- Owner portal: organization management ---');
  for (const [method, path, body] of [
    ['POST', '/api/owner/organizations', { name: `Denied ${run}` }],
    ['POST', `/api/owner/organizations/${B.organizationId}/suspend`, { reason: 'because' }],
    ['POST', `/api/owner/organizations/${B.organizationId}/activate`, {}],
    ['PUT', `/api/owner/users/${A2.userId}/role`, { role: 'admin' }],
    ['POST', `/api/owner/users/${A2.userId}/deactivate`, {}],
    ['POST', `/api/owner/support/start`, { orgId: B.organizationId, reason: 'a long enough reason' }],
  ] as const) {
    for (const who of [A, A2]) assert.equal((await ownerApi(app, method, path, who, body)).status, 403, `${method} ${path} denied to customers`);
  }
  assert.equal((await pool.query('SELECT status FROM organizations WHERE id = $1', [B.organizationId])).rows[0].status, 'active');
  assert.equal((await pool.query('SELECT role FROM users WHERE id = $1', [A2.userId])).rows[0].role, 'member');
  pass('organization creation, suspension, role changes and support start require the platform owner');

  const created = await ownerApi(app, 'POST', '/api/owner/organizations', owner, { name: `Acme Realty ${run}`, billingEmail: `billing.${run}@security-test.invalid` });
  assert.equal(created.status, 201, created.text);
  createdOrgs.push(created.json.id);
  assert.equal(created.json.status, 'active');
  assert.equal((await ownerApi(app, 'POST', '/api/owner/organizations', owner, { name: `acme realty ${run}` })).status, 409);
  assert.equal((await ownerApi(app, 'POST', '/api/owner/organizations', owner, { name: 'x' })).status, 400);
  const createdAudit = await auditRows('owner.organization_created', `AND target_id = '${created.json.id}'`);
  assert.equal(createdAudit.length, 1);
  assert.equal(createdAudit[0].actor_user_id, owner.userId);
  assert.equal(createdAudit[0].actor_role, 'platform_owner');
  assert.equal(createdAudit[0].result, 'success');
  assert.ok(createdAudit[0].ip_address !== undefined);
  pass('owner creates an organization; it is validated, de-duplicated and audited with actor, role, target and result');

  const search = await ownerApi(app, 'GET', `/api/owner/organizations?search=${encodeURIComponent('Acme Realty ' + run)}&status=active`, owner);
  assert.equal(search.json.organizations.length, 1);
  assert.equal((await ownerApi(app, 'GET', '/api/owner/organizations?status=bogus', owner)).status, 400);
  const injection = await ownerApi(app, 'GET', `/api/owner/organizations?search=${encodeURIComponent("'; DROP TABLE organizations;--")}`, owner);
  assert.equal(injection.status, 200);
  assert.equal((await pool.query("SELECT to_regclass('organizations') AS t")).rows[0].t, 'organizations');
  const detail = await ownerApi(app, 'GET', `/api/owner/organizations/${A.organizationId}`, owner);
  assert.equal(detail.status, 200);
  assert.equal(detail.json.user_count, 2);
  assert.equal((await ownerApi(app, 'GET', '/api/owner/organizations/does_not_exist', owner)).status, 404);
  assert.equal((await ownerApi(app, 'GET', '/api/owner/organizations/bad%20id%3B--', owner)).status, 400);
  pass('organization search/filter/detail work, reject bad input, and are injection-safe');

  const orgUsers = await ownerApi(app, 'GET', `/api/owner/organizations/${A.organizationId}/users`, owner);
  assert.equal(orgUsers.json.users.length, 2);
  const orgUsage = await ownerApi(app, 'GET', `/api/owner/organizations/${A.organizationId}/usage`, owner);
  assert.equal(typeof orgUsage.json.counts.users, 'number');
  assert.equal((await ownerApi(app, 'GET', `/api/owner/organizations/${A.organizationId}/activity`, owner)).status, 200);

  // suspension really locks the tenant out
  assert.equal((await api(app, 'GET', '/api/auth/me', A)).status, 200);
  const noReason = await ownerApi(app, 'POST', `/api/owner/organizations/${A.organizationId}/suspend`, owner, {});
  assert.equal(noReason.status, 400);
  const suspended = await ownerApi(app, 'POST', `/api/owner/organizations/${A.organizationId}/suspend`, owner, { reason: 'Non-payment' });
  assert.equal(suspended.status, 200);
  assert.equal(suspended.json.status, 'suspended');
  assert.equal((await api(app, 'GET', '/api/auth/me', A)).status, 401, "an existing session of a suspended organization stops working immediately");
  const blockedLogin = await fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: A.email, password: 'Correct-Horse-Battery-9' }) });
  assert.equal(blockedLogin.status, 403);
  assert.equal(((await blockedLogin.json()) as any).code, 'ORGANIZATION_NOT_ACTIVE');
  assert.equal((await api(app, 'GET', '/api/auth/me', B)).status, 200, 'other tenants are unaffected');
  const reactivated = await ownerApi(app, 'POST', `/api/owner/organizations/${A.organizationId}/activate`, owner);
  assert.equal(reactivated.json.status, 'active');
  A.token = await (await import('./httpHarness')).login(app, A.email);
  A.auth = { Authorization: `Bearer ${A.token}` };
  assert.equal((await api(app, 'GET', '/api/auth/me', A)).status, 200);
  assert.equal((await auditRows('owner.organization_suspended', `AND target_id = '${A.organizationId}'`)).length, 1);
  assert.equal((await auditRows('owner.organization_activated', `AND target_id = '${A.organizationId}'`)).length, 1);
  pass('suspending an organization locks it out immediately; activation restores it; both are audited');

  // dangerous action protections
  const ownOrg = await ownerApi(app, 'POST', `/api/owner/organizations/${owner.organizationId}/suspend`, owner, { reason: 'oops oops' });
  assert.equal(ownOrg.status, 409, "the owner's own organization is protected");
  const noConfirm = await ownerApi(app, 'POST', `/api/owner/organizations/${created.json.id}/deactivate`, owner, { reason: 'cleanup' });
  assert.equal(noConfirm.status, 400);
  assert.equal(noConfirm.json.code, 'CONFIRMATION_REQUIRED');
  const wrongConfirm = await ownerApi(app, 'POST', `/api/owner/organizations/${created.json.id}/deactivate`, owner, { reason: 'cleanup', confirmName: 'nope' });
  assert.equal(wrongConfirm.status, 400);
  const deact = await ownerApi(app, 'POST', `/api/owner/organizations/${created.json.id}/deactivate`, owner, { reason: 'cleanup', confirmName: `Acme Realty ${run}` });
  assert.equal(deact.json.status, 'deactivated');
  assert.equal((await pool.query('SELECT 1 FROM organizations WHERE id = $1', [created.json.id])).rowCount, 1, 'deactivation is a soft delete: the row remains');
  pass('deactivation requires typing the organization name, is a soft delete, and the owner org is protected');

  console.log('\n--- Owner portal: user management ---');
  const users = await ownerApi(app, 'GET', `/api/owner/users?orgId=${A.organizationId}`, owner);
  assert.equal(users.json.users.length, 2);
  assert.ok(!/password|mfa_secret|backup|token_hash|session|secret/i.test(users.text.replace(/mfaEnabled/g, '')), 'no credentials or secrets are exposed');
  assert.equal((await ownerApi(app, 'GET', '/api/owner/users?search=' + encodeURIComponent(A2.email.slice(0, 8)), owner)).status, 200);
  const lookup = await ownerApi(app, 'GET', `/api/owner/users/${A2.userId}`, owner);
  assert.equal(lookup.json.organizationId, A.organizationId);
  assert.ok('lastLoginAt' in lookup.json);

  const promote = await ownerApi(app, 'PUT', `/api/owner/users/${A2.userId}/role`, owner, { role: 'manager' });
  assert.equal(promote.json.role, 'manager');
  const roleAudit = await auditRows('owner.user_role_changed', `AND target_id = '${A2.userId}'`);
  assert.deepEqual([roleAudit[0].details.from, roleAudit[0].details.to], ['member', 'manager']);
  for (const bad of ['platform_owner', 'owner', 'superuser', '', 5, null]) {
    assert.equal((await ownerApi(app, 'PUT', `/api/owner/users/${A2.userId}/role`, owner, { role: bad })).status, 400, `role ${String(bad)} is not assignable`);
  }
  assert.equal((await pool.query('SELECT role FROM users WHERE id = $1', [A2.userId])).rows[0].role, 'manager');
  pass('owner can assign supported roles only; platform_owner can never be assigned through the API');

  assert.equal((await ownerApi(app, 'PUT', `/api/owner/users/${owner.userId}/role`, owner, { role: 'member' })).status, 409, 'the owner account is protected');
  assert.equal((await ownerApi(app, 'POST', `/api/owner/users/${owner.userId}/deactivate`, owner)).status, 409);
  const lastAdmin = await ownerApi(app, 'PUT', `/api/owner/users/${A.userId}/role`, owner, { role: 'member' });
  assert.equal(lastAdmin.status, 409);
  assert.equal(lastAdmin.json.code, 'LAST_ADMIN');
  pass('the owner account and the last administrator of an organization are protected');

  assert.equal((await api(app, 'GET', '/api/auth/me', A2)).status, 200);
  const off = await ownerApi(app, 'POST', `/api/owner/users/${A2.userId}/deactivate`, owner);
  assert.equal(off.json.active, false);
  assert.equal((await api(app, 'GET', '/api/auth/me', A2)).status, 401, 'deactivation revokes sessions');
  const on = await ownerApi(app, 'POST', `/api/owner/users/${A2.userId}/activate`, owner);
  assert.equal(on.json.active, true);
  const removed = await ownerApi(app, 'POST', `/api/owner/users/${A2.userId}/remove-membership`, owner);
  assert.equal(removed.json.active, false);
  for (const action of ['owner.user_deactivated', 'owner.user_activated', 'owner.user_membership_removed']) {
    assert.ok((await auditRows(action, `AND target_id = '${A2.userId}'`)).length >= 1, `${action} audited`);
  }
  pass('user activation/deactivation/membership removal work, revoke sessions and are audited');

  console.log('\n--- Owner portal: tenant isolation and middleware ---');
  // Customer endpoints still isolate tenants and ignore a manipulated organization id.
  const campaign = await api(app, 'POST', '/api/campaigns', A, { name: `Isolation ${run}` });
  assert.equal(campaign.status, 201);
  const cross = await api(app, 'GET', '/api/campaigns', B);
  assert.ok(!cross.text.includes(`Isolation ${run}`), 'organization B cannot see organization A data');
  const manipulated = await api(app, 'GET', `/api/campaigns?orgId=${A.organizationId}`, B, undefined, { 'x-organization-id': A.organizationId });
  assert.ok([401, 403].includes(manipulated.status), 'a manipulated organization id is rejected');
  pass('organization A data stays invisible to organization B; manipulated organization ids are rejected');

  const res = () => { const o: any = { code: 0, body: null }; o.status = (c: number) => { o.code = c; return o; }; o.json = (b: unknown) => { o.body = b; return o; }; return o as Response & { code: number }; };
  const call = (mw: (q: Request, r: Response, n: NextFunction) => unknown, req: any) => { let nexted = false; const r = res(); mw(req, r, () => { nexted = true; }); return { nexted, r }; };
  const mk = (role: string, orgId: string, params: any = {}, body: any = {}, query: any = {}) => ({ dbUser: { id: 'u', organization_id: orgId, role }, params, body, query });
  assert.equal(call(requireOrganizationAdmin('organizationId'), mk('admin', 'orgA', { organizationId: 'orgA' })).nexted, true);
  assert.equal(call(requireOrganizationAdmin('organizationId'), mk('admin', 'orgA', { organizationId: 'orgB' })).r.code, 403, 'org admin cannot address another organization');
  assert.equal(call(requireOrganizationAdmin('organizationId'), mk('admin', 'orgA', {}, { organizationId: 'orgB' })).r.code, 403);
  assert.equal(call(requireOrganizationAdmin(), mk('member', 'orgA')).r.code, 403, 'a member is not an organization admin');
  assert.equal(call(requireOrganizationAdmin(), { params: {}, body: {}, query: {} } as any).r.code, 401);
  assert.equal(call(requireOrganizationMember('organizationId'), mk('member', 'orgA', {}, {}, { organizationId: 'orgB' })).r.code, 403);
  assert.equal(call(requireOrganizationMember('organizationId'), mk('member', 'orgA', { organizationId: 'orgA' })).nexted, true);
  pass('requireOrganizationAdmin / requireOrganizationMember resolve the organization from the session only');

  console.log('\n--- Owner portal: audit log protection ---');
  const logs = await ownerApi(app, 'GET', '/api/owner/audit-logs?limit=200', owner);
  assert.equal(logs.status, 200);
  assert.ok(logs.json.entries.length > 5);
  const actions = new Set(logs.json.entries.map((e: any) => e.action));
  for (const a of ['owner.organization_created', 'owner.organization_suspended', 'owner.user_role_changed', 'owner.access_denied']) assert.ok(actions.has(a), `${a} appears in the audit log`);
  const filtered = await ownerApi(app, 'GET', `/api/owner/audit-logs?action=owner.user_&orgId=${A.organizationId}`, owner);
  assert.ok(filtered.json.entries.every((e: any) => e.action.startsWith('owner.user_') && e.organization_id === A.organizationId));
  for (const [method, path] of [['PUT', '/api/owner/audit-logs'], ['DELETE', '/api/owner/audit-logs'], ['POST', '/api/owner/audit-logs'], ['PATCH', '/api/owner/audit-logs/x']] as const) {
    assert.ok([403, 404].includes((await ownerApi(app, method, path, A)).status));
    assert.equal((await ownerApi(app, method, path, owner)).status, 404, 'no endpoint can modify the audit log, even for the owner');
  }
  await assert.rejects(pool.query("UPDATE platform_audit_logs SET result = 'success'"), /permission denied|append-only/);
  await assert.rejects(pool.query('DELETE FROM platform_audit_logs'), /permission denied|append-only/);
  await assert.rejects(pool.query('TRUNCATE platform_audit_logs'), /permission denied|append-only/);
  const admin = await adminClient();
  try {
    await assert.rejects(admin.query("UPDATE platform_audit_logs SET result = 'success'"), /append-only/, 'even an administrator hits the append-only trigger');
    await assert.rejects(admin.query('DELETE FROM platform_audit_logs'), /append-only/);
    await assert.rejects(admin.query('TRUNCATE platform_audit_logs'), /append-only/);
  } finally { await admin.end(); }
  pass('the owner audit log is append-only at the database level and has no modifying endpoint');

  const failedBefore = (await auditRows('owner.login_failed')).length;
  await fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: owner.email, password: 'wrong-password-123' }) });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await auditRows('owner.login_failed')).length, failedBefore + 1, 'failed owner login is audited');
  await fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: A.email, password: 'wrong-password-123' }) });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await auditRows('owner.login_failed')).length, failedBefore + 1, 'failed customer logins are not mixed into the owner trail');
  assert.equal((await ownerApi(app, 'POST', '/api/owner/session/start', owner)).status, 200);
  assert.ok((await auditRows('owner.login', `AND actor_user_id = '${owner.userId}'`)).length >= 1);
  pass('owner login and failed owner login are audited');

  console.log('\n--- Owner portal: no public path to platform_owner ---');
  for (const path of ['/api/owner/register', '/api/owner/signup', '/api/owner/invite', '/api/owner/owners', '/api/owner/platform-owners', '/api/owner/login', '/api/owner/password-reset']) {
    for (const method of ['GET', 'POST', 'PUT']) {
      assert.equal((await api(app, method, path, null, method === 'GET' ? undefined : {})).status, 401, `${method} ${path} requires authentication`);
      assert.ok([403, 404].includes((await ownerApi(app, method, path, A, method === 'GET' ? undefined : {})).status));
      assert.equal((await ownerApi(app, method, path, owner, method === 'GET' ? undefined : { email: 'x@y.invalid' })).status, 404, `${method} ${path} does not exist even for the owner`);
    }
  }
  const signupAttempt = await api(app, 'POST', '/api/auth/signup', null, { email: `owner.${run}@security-test.invalid`, password: 'Correct-Horse-Battery-9', name: 'x', organizationName: `Owner Wannabe ${run}`, role: 'platform_owner', platform_owner: true, isPlatformOwner: true });
  createdOrgs.push(...(await pool.query('SELECT id FROM organizations WHERE name = $1', [`Owner Wannabe ${run}`])).rows.map((r) => r.id));
  const wannabe = await pool.query('SELECT role FROM users WHERE lower(email) = $1', [`owner.${run}@security-test.invalid`]);
  assert.ok(wannabe.rows[0]?.role !== 'platform_owner');
  assert.equal((await pool.query('SELECT 1 FROM platform_owners po JOIN users u ON u.id = po.user_id WHERE lower(u.email) = $1', [`owner.${run}@security-test.invalid`])).rowCount, 0, `sign-up with owner flags creates no owner (status ${signupAttempt.status})`);
  // the database refuses the runtime role and everything outside the provisioning script
  await assert.rejects(pool.query("INSERT INTO platform_owners (user_id) VALUES ($1)", [A.userId]), /permission denied/);
  await assert.rejects(pool.query('DELETE FROM platform_owners'), /permission denied/);
  await assert.rejects(pool.query("UPDATE users SET role = 'platform_owner' WHERE id = $1", [A.userId]), /users_role_valid|violates check/);
  const adm = await adminClient();
  try {
    await assert.rejects(adm.query("INSERT INTO platform_owners (user_id) VALUES ($1)", [A.userId]), /provisioning script/, 'even admin SQL needs the provisioning flag');
    await adm.query('BEGIN');
    await adm.query("SELECT set_config('vortex_one.platform_provisioning','on',true)");
    await assert.rejects(adm.query("INSERT INTO platform_owners (user_id) VALUES ($1)", [A.userId]), /duplicate key|uq_platform_owner_singleton/, 'exactly one platform owner is allowed');
    await adm.query('ROLLBACK');
  } finally { await adm.end(); }
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM platform_owners')).rows[0].n, 1);
  pass('there is no registration/invite/owner-management endpoint; the database allows exactly one owner, written only by the provisioning script');

  // a customer who is promoted nowhere stays a customer after an owner-ish login attempt
  assert.equal((await ownerApi(app, 'GET', '/api/owner/session', A)).status, 403);

  console.log('\n--- Owner portal: support mode ---');
  const early = await ownerApi(app, 'GET', `/api/owner/support/${B.organizationId}/summary`, owner);
  assert.equal(early.status, 403);
  assert.equal(early.json.code, 'SUPPORT_SESSION_REQUIRED');
  assert.ok((await auditRows('owner.support_data_denied', `AND organization_id = '${B.organizationId}'`)).length >= 1);
  assert.equal((await ownerApi(app, 'POST', '/api/owner/support/start', owner, { orgId: B.organizationId, reason: 'short' })).status, 400);
  const start = await ownerApi(app, 'POST', '/api/owner/support/start', owner, { orgId: B.organizationId, reason: 'Investigating a billing question', minutes: 500 });
  assert.equal(start.status, 201, start.text);
  const windowMin = (new Date(start.json.expires_at).getTime() - new Date(start.json.started_at).getTime()) / 60000;
  assert.ok(windowMin <= 60.1, `support window is capped at 60 minutes (got ${windowMin})`);
  assert.equal((await ownerApi(app, 'POST', '/api/owner/support/start', owner, { orgId: A.organizationId, reason: 'Second session attempt now' })).status, 409);
  const sess = await ownerApi(app, 'GET', '/api/owner/session', owner);
  assert.equal(sess.json.supportSession.organization_id, B.organizationId);
  assert.equal((await ownerApi(app, 'GET', `/api/owner/support/${A.organizationId}/summary`, owner)).status, 403, 'a support window only covers its own organization');
  const summary = await ownerApi(app, 'GET', `/api/owner/support/${B.organizationId}/summary`, owner);
  assert.equal(summary.status, 200);
  assert.ok(!/password|token_hash|mfa_secret/i.test(summary.text));
  const started = (await auditRows('owner.support_session_started', `AND organization_id = '${B.organizationId}'`))[0];
  assert.equal(started.actor_user_id, owner.userId);
  assert.equal(started.details.reason, 'Investigating a billing question');
  assert.ok((await auditRows('owner.support_data_viewed', `AND organization_id = '${B.organizationId}'`)).length >= 1);
  assert.equal((await ownerApi(app, 'POST', '/api/owner/support/end', owner)).status, 200);
  assert.equal((await ownerApi(app, 'GET', '/api/owner/session', owner)).json.supportSession, null);
  assert.equal((await ownerApi(app, 'GET', `/api/owner/support/${B.organizationId}/summary`, owner)).status, 403);
  assert.ok((await auditRows('owner.support_session_ended', `AND organization_id = '${B.organizationId}'`)).length >= 1);
  const again = await ownerApi(app, 'POST', '/api/owner/support/start', owner, { orgId: B.organizationId, reason: 'Second investigation window' });
  await pool.query("UPDATE platform_support_sessions SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 second', started_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes' WHERE id = $1", [again.json.id]);
  assert.equal((await ownerApi(app, 'GET', '/api/owner/session', owner)).json.supportSession, null, 'an elapsed support window closes by itself');
  assert.ok((await auditRows('owner.support_session_expired', `AND organization_id = '${B.organizationId}'`)).length >= 1);
  pass('support mode is explicit, reasoned, time-boxed, single-organization, exit-able and fully audited');

  console.log('\n--- Owner portal: backups, system, settings ---');
  const backups0 = await ownerApi(app, 'GET', '/api/owner/backups', owner);
  for (const t of backups0.json.targets) {
    assert.equal(t.status, 'not_configured', `${t.target} is reported as not configured when no run was recorded`);
    assert.equal(t.lastSuccessfulBackupAt, null);
  }
  assert.equal(backups0.json.liveDatabase.reachable, true);
  const adm2 = await adminClient();
  try {
    await adm2.query("INSERT INTO platform_backup_runs (id, target, status, finished_at, details) VALUES ('bk1','postgresql','success',CURRENT_TIMESTAMP,'{}')");
    await adm2.query("INSERT INTO platform_backup_runs (id, target, status, started_at, finished_at, error) VALUES ('bk2','google_drive','failure',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'Drive quota exceeded')");
  } finally { await adm2.end(); }
  const backups1 = (await ownerApi(app, 'GET', '/api/owner/backups', owner)).json.targets;
  const byTarget = Object.fromEntries(backups1.map((t: any) => [t.target, t]));
  assert.equal(byTarget.postgresql.status, 'success');
  assert.ok(byTarget.postgresql.lastSuccessfulBackupAt);
  assert.equal(byTarget.google_drive.status, 'failure');
  assert.equal(byTarget.google_drive.lastFailure.error, 'Drive quota exceeded');
  assert.equal(byTarget.google_drive.lastSuccessfulBackupAt, null, 'a failed target never shows a success time');
  assert.equal(byTarget.google_sheets.status, 'not_configured');
  pass('backup status reflects only recorded runs; unconfigured targets say "not configured"');

  const system = await ownerApi(app, 'GET', '/api/owner/system', owner);
  assert.equal(system.json.status, 'ok');
  assert.equal(system.json.database.status, 'ok');
  const settings = await ownerApi(app, 'GET', '/api/owner/settings', owner);
  assert.ok(settings.json.settings.every((s: any) => ['implemented', 'unavailable', 'planned'].includes(s.status) && s.editable === false));
  for (const secret of [process.env.AUTH_SESSION_PEPPER, process.env.AUTH_ENCRYPTION_KEY, process.env.INTEGRATION_ENCRYPTION_KEY, process.env.SECURITY_TEST_ADMIN_URL, 'vortex_app_test_password']) {
    if (secret) assert.ok(!settings.text.includes(secret) && !system.text.includes(secret) && !backups0.text.includes(secret), 'no secret value is ever exposed');
  }
  const overview = (await ownerApi(app, 'GET', '/api/owner/overview', owner)).json;
  assert.equal(overview.organizations.total, overview.organizations.active + overview.organizations.suspended + overview.organizations.deactivated);
  assert.equal(overview.users.total, (await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n, 'dashboard numbers come from the database');
  assert.ok(Array.isArray(overview.recentAuditEvents));
  pass('system, settings and dashboard report real data and expose no secrets');

  console.log('Owner portal security tests passed.');
} finally {
  await removeOwnerAsAdmin().catch(() => {});
  const admin = await adminClient();
  try { await admin.query('DELETE FROM platform_backup_runs'); } finally { await admin.end(); }
  await pool.query('DELETE FROM campaign WHERE organization_id = ANY($1)', [[A.organizationId, B.organizationId]]).catch(() => {});
  await pool.query('DELETE FROM platform_support_sessions WHERE organization_id = ANY($1)', [[A.organizationId, B.organizationId]]).catch(() => {});
  for (const id of createdOrgs) await cleanupTestTenants({ organizationId: id });
  await pool.query('DELETE FROM organization_invites WHERE organization_id = ANY($1)', [createdOrgs]).catch(() => {});
  await cleanupTestTenants(A, B, owner);
  await app.close();
  await pool.end().catch(() => {});
}
void provisionOwnerAsAdmin;
