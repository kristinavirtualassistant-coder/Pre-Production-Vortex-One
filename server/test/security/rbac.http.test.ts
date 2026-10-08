/**
 * RBAC permission matrix over HTTP. For each guarded route and each role, the response must be 403 exactly when
 * the role lacks the permission (and never 401/403 when it holds it). Also: unauthenticated -> 401, disabled
 * users rejected, and spoofed role headers never escalate.
 */
import assert from 'node:assert/strict';
import { PERMISSIONS, ROLES, can, type Permission } from '../../security/permissionMatrix';
import { addTestUser, api, cleanupTestTenants, createTestTenant, pass, requirePool, startTestApp, type TestTenant } from './httpHarness';

const app = await startTestApp();
const pool = requirePool();
const admin = await createTestTenant(app, 'rbac', 'admin');
const users: Record<string, TestTenant> = { admin };
for (const role of ROLES) if (role !== 'admin') users[role] = await addTestUser(app, admin, `rbac_${role}`, role);

const routes: Array<{ method: string; path: string; permission: Permission; body?: unknown }> = [
  { method: 'GET', path: '/api/db/status', permission: 'system:read' },
  { method: 'GET', path: '/api/cache/stats', permission: 'system:read' },
  { method: 'GET', path: '/api/cache/entries', permission: 'system:read' },
  { method: 'GET', path: '/api/operational/metrics', permission: 'metrics:read' },
  { method: 'GET', path: '/api/audit', permission: 'audit:read' },
  { method: 'GET', path: '/api/audit/logs', permission: 'audit:read' },
  { method: 'GET', path: '/api/billing', permission: 'billing:read' },
  { method: 'GET', path: '/api/billing/usage', permission: 'billing:read' },
  { method: 'GET', path: '/api/billing/invoices', permission: 'billing:read' },
  { method: 'GET', path: '/api/organization/billing', permission: 'billing:read' },
  { method: 'GET', path: '/api/webhooks', permission: 'webhooks:read' },
  { method: 'GET', path: '/api/imported-files', permission: 'files:read' },
  { method: 'GET', path: '/api/calls', permission: 'calls:read' },
  { method: 'POST', path: '/api/dial-batch', permission: 'dial:bulk', body: {} },
  { method: 'POST', path: '/api/communications/suppressions', permission: 'suppressions:write', body: {} },
];

try {
  console.log('\n--- Security: RBAC permission matrix ---');
  for (const r of routes) {
    for (const role of ROLES) {
      const res = await api(app, r.method, r.path, users[role], r.body);
      if (can(role, r.permission)) {
        assert.ok(res.status !== 401 && res.status !== 403, `${role} may ${r.method} ${r.path} (got ${res.status}: ${res.text.slice(0, 120)})`);
      } else {
        assert.equal(res.status, 403, `${role} must be denied ${r.method} ${r.path} (got ${res.status})`);
      }
    }
    const anon = await api(app, r.method, r.path, null, r.body);
    assert.equal(anon.status, 401, `anonymous ${r.method} ${r.path} -> 401 (got ${anon.status})`);
  }
  pass(`${routes.length} guarded routes x ${ROLES.length} roles match the permission matrix; anonymous gets 401`);

  const spoof = await api(app, 'GET', '/api/db/status', users.member, undefined, { 'x-user-role': 'admin', 'x-role': 'admin' });
  assert.equal(spoof.status, 403);
  pass('spoofed role headers do not escalate a member');

  await pool.query('UPDATE users SET disabled_at=CURRENT_TIMESTAMP WHERE id=$1', [users.manager.userId]);
  const disabled = await api(app, 'GET', '/api/billing', users.manager);
  assert.equal(disabled.status, 401, `disabled user's existing session is rejected (got ${disabled.status})`);
  pass('a disabled user is rejected even with a previously valid session');

  assert.ok(Object.keys(PERMISSIONS).length > 0);
} finally {
  await cleanupTestTenants(admin);
  await app.close();
  await pool.end().catch(() => {});
}
