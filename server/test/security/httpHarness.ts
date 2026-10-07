import http from 'node:http';
import { createHmac, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Pool } from 'pg';
import { getPgPool } from '../../db/db';
import { hashPassword } from '../../services/postgresqlAuth';
import { ensurePostgreSQLAuthSchema } from '../../db/postgresqlAuthSchema';

export interface TestApp {
  baseUrl: string;
  close: () => Promise<void>;
}

/** Boots the REAL Express application (all middleware, routes, migrations) on an ephemeral port. */
export async function startTestApp(): Promise<TestApp> {
  const { createApp } = await import('../../../server');
  const app = await createApp({ serveFrontend: false, backgroundTimers: false });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}

export function requirePool(): Pool {
  const pool = getPgPool();
  if (!pool) throw new Error('Security HTTP tests require PostgreSQL (set DATABASE_URL / SQL_*)');
  return pool;
}

export interface TestTenant {
  organizationId: string;
  userId: string;
  email: string;
  role: string;
  token: string;
  auth: { Authorization: string };
}

const TEST_PASSWORD = 'Correct-Horse-Battery-9';

/** Creates an organization + verified user directly in PostgreSQL, then signs in through the real login route. */
export async function createTestTenant(app: TestApp, label: string, role = 'admin'): Promise<TestTenant> {
  const pool = requirePool();
  await ensurePostgreSQLAuthSchema(pool);
  const suffix = randomUUID().slice(0, 8);
  const organizationId = `org_sec_${label}_${suffix}`;
  const userId = `user_sec_${label}_${suffix}`;
  const email = `${label}.${suffix}@security-test.invalid`;
  await pool.query('INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3)', [organizationId, `Security ${label} ${suffix}`, `sec-${label}-${suffix}`]);
  await pool.query(
    `INSERT INTO users (id,organization_id,email,name,role,password_hash,email_verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)`,
    [userId, organizationId, email, `Security ${label}`, role, await hashPassword(TEST_PASSWORD)],
  );
  const token = await login(app, email);
  return { organizationId, userId, email, role, token, auth: { Authorization: `Bearer ${token}` } };
}

export async function addTestUser(app: TestApp, tenant: TestTenant, label: string, role: string): Promise<TestTenant> {
  const pool = requirePool();
  const suffix = randomUUID().slice(0, 8);
  const userId = `user_sec_${label}_${suffix}`;
  const email = `${label}.${suffix}@security-test.invalid`;
  await pool.query(
    `INSERT INTO users (id,organization_id,email,name,role,password_hash,email_verified_at)
     VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP)`,
    [userId, tenant.organizationId, email, `Security ${label}`, role, await hashPassword(TEST_PASSWORD)],
  );
  const token = await login(app, email);
  return { organizationId: tenant.organizationId, userId, email, role, token, auth: { Authorization: `Bearer ${token}` } };
}

export async function login(app: TestApp, email: string, password = TEST_PASSWORD): Promise<string> {
  const response = await fetch(`${app.baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body: any = await response.json().catch(() => ({}));
  if (response.status !== 200 || !body.token) throw new Error(`Test login failed (${response.status}): ${JSON.stringify(body)}`);
  return body.token as string;
}

export function stripeSignature(rawBody: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

export async function cleanupTestTenants(...tenants: Array<Pick<TestTenant, 'organizationId'>>): Promise<void> {
  const pool = requirePool();
  for (const tenant of tenants) {
    await pool.query('DELETE FROM auth_sessions WHERE user_id IN (SELECT id FROM users WHERE organization_id=$1)', [tenant.organizationId]).catch(() => {});
    await pool.query('DELETE FROM users WHERE organization_id=$1', [tenant.organizationId]).catch(() => {});
    await pool.query('DELETE FROM organizations WHERE id=$1', [tenant.organizationId]).catch(() => {});
  }
}

export interface HttpResult { status: number; text: string; json: any }

/** Issues a request as a tenant user (Authorization: Bearer <session>) and parses the response. */
export async function api(app: TestApp, method: string, path: string, tenant: Pick<TestTenant, 'auth'> | null, body?: unknown, headers: Record<string, string> = {}): Promise<HttpResult> {
  const response = await fetch(`${app.baseUrl}${path}`, {
    method,
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(tenant?.auth ?? {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: response.status, text, json };
}

export function pass(name: string): void {
  console.log(`  ✓ PASS: ${name}`);
}
