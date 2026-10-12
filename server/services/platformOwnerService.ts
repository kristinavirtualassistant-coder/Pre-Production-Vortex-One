/**
 * Platform-owner service layer. Every function here assumes the CALLER already passed requirePlatformOwner; nothing in
 * this module decides who may call it. It uses the raw pool and explicit transactions so audit rows commit atomically
 * with the changes they describe and are not rolled back by the request-scoped tenant transaction.
 *
 * Secrets are never selected: no password hashes, MFA secrets/backup codes, session tokens or provider credentials.
 */
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { getRawPgPool, getDatabaseStatus } from '../db/db';
import { sessionAbsoluteDays, sessionIdleHours } from '../security/sessionPolicy';
import { ownerMfaRequired } from '../security/platformAuthorization';
import { isDemoModeEnabled } from '../security/demoMode';
import { hashSessionToken } from './postgresqlAuth';
import { sendSecurityEmail, createOneTimeToken, appUrl } from './accountSecurity';
import { logError } from '../security/logger';
import { recordPlatformAudit, recordPlatformAuditTx, type PlatformAuditEntry } from './platformAuditService';

export class OwnerError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'OwnerError'; }
}

export const SUPPORTED_ROLES = ['admin', 'executive', 'manager', 'agent', 'member'] as const;
export const ORGANIZATION_STATUSES = ['active', 'suspended', 'deactivated'] as const;
export type OrganizationStatus = (typeof ORGANIZATION_STATUSES)[number];
export const SUPPORT_MAX_MINUTES = 60;
export const SUPPORT_DEFAULT_MINUTES = 30;

export interface Actor { userId: string; organizationId: string; ip?: string | null; userAgent?: string | null }

function db(): Pool {
  const pool = getRawPgPool();
  if (!pool) throw new OwnerError(503, 'DATABASE_UNAVAILABLE', 'Database unavailable');
  return pool;
}

const ID_PATTERN = /^[A-Za-z0-9_.:-]{1,128}$/;
export function assertId(value: unknown, label = 'id'): string {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) throw new OwnerError(400, 'INVALID_ID', `Invalid ${label}`);
  return value;
}
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
function page(limit: unknown, offset: unknown) {
  const l = Math.min(200, Math.max(1, Number(limit) || 50));
  const o = Math.max(0, Number(offset) || 0);
  return { limit: l, offset: o };
}

async function withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

const audit = (actor: Actor, e: Omit<PlatformAuditEntry, 'actorUserId' | 'actorRole' | 'ipAddress' | 'userAgent'>): PlatformAuditEntry =>
  ({ actorUserId: actor.userId, actorRole: 'platform_owner', ipAddress: actor.ip ?? null, userAgent: actor.userAgent ?? null, ...e });

// ---------------------------------------------------------------- overview / usage

async function countOne(sql: string, params: unknown[] = []): Promise<number> {
  const r = await db().query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

export async function getOverview() {
  const pool = db();
  const orgs = await pool.query(`SELECT status, COUNT(*)::int AS n FROM organizations GROUP BY status`);
  const byStatus: Record<string, number> = { active: 0, suspended: 0, deactivated: 0 };
  for (const row of orgs.rows) byStatus[row.status] = row.n;
  const users = await pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE disabled_at IS NULL)::int AS active FROM users`);
  const [contacts, leads, properties, owners, calls, calls24h, campaigns, activeCampaigns] = await Promise.all([
    countOne('SELECT COUNT(*)::int AS n FROM contacts'),
    countOne('SELECT COUNT(*)::int AS n FROM leads'),
    countOne('SELECT COUNT(*)::int AS n FROM properties'),
    countOne('SELECT COUNT(*)::int AS n FROM property_owners'),
    countOne('SELECT COUNT(*)::int AS n FROM call'),
    countOne("SELECT COUNT(*)::int AS n FROM call WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'"),
    countOne('SELECT COUNT(*)::int AS n FROM campaign'),
    countOne("SELECT COUNT(*)::int AS n FROM campaign WHERE status = 'active'"),
  ]);
  const recentAudit = await pool.query(
    `SELECT id, actor_role, action, target_type, target_id, organization_id, result, created_at
       FROM platform_audit_logs ORDER BY created_at DESC LIMIT 10`);
  const recentActivity = await pool.query(
    `SELECT a.id, a.organization_id, o.name AS organization_name, a.agent, a.action, a.status, a.created_at
       FROM audit_logs a LEFT JOIN organizations o ON o.id = a.organization_id
      ORDER BY a.created_at DESC LIMIT 10`);
  return {
    organizations: { total: orgs.rows.reduce((s, r) => s + r.n, 0), ...byStatus },
    users: { total: users.rows[0].total, active: users.rows[0].active },
    data: { contacts, leads, properties, propertyOwners: owners },
    calls: { total: calls, last24h: calls24h },
    campaigns: { total: campaigns, active: activeCampaigns },
    recentAuditEvents: recentAudit.rows,
    recentSystemActivity: recentActivity.rows,
    backups: await getBackupStatus(),
    health: await getSystemHealth(),
  };
}

export async function getPlatformUsage() {
  const pool = db();
  const periods = await pool.query(
    `SELECT metric, COALESCE(SUM(used),0)::bigint AS used FROM organization_usage
      WHERE period_start = date_trunc('month', CURRENT_DATE)::date GROUP BY metric ORDER BY metric`);
  const perOrg = await pool.query(
    `SELECT o.id, o.name, o.status, COALESCE(b.plan,'free') AS plan,
            (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.disabled_at IS NULL) AS active_users,
            (SELECT COUNT(*)::int FROM leads l WHERE l.organization_id = o.id) AS leads,
            (SELECT COUNT(*)::int FROM call c WHERE c.organization_id = o.id) AS calls,
            (SELECT COUNT(*)::int FROM campaign c WHERE c.organization_id = o.id) AS campaigns
       FROM organizations o LEFT JOIN organization_billing b ON b.organization_id = o.id
      ORDER BY calls DESC, leads DESC LIMIT 50`);
  return { period: 'current_month', metrics: periods.rows.map((r) => ({ metric: r.metric, used: Number(r.used) })), organizations: perOrg.rows };
}

// ---------------------------------------------------------------- organizations

export async function listOrganizations(q: { search?: string; status?: string; limit?: unknown; offset?: unknown }) {
  const { limit, offset } = page(q.limit, q.offset);
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.status) {
    if (!ORGANIZATION_STATUSES.includes(q.status as OrganizationStatus)) throw new OwnerError(400, 'INVALID_STATUS', 'Invalid status filter');
    params.push(q.status); where.push(`o.status = $${params.length}`);
  }
  if (q.search?.trim()) {
    params.push(`%${escapeLike(q.search.trim().slice(0, 100))}%`);
    where.push(`(o.name ILIKE $${params.length} OR o.slug ILIKE $${params.length} OR o.id ILIKE $${params.length})`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await db().query(`SELECT COUNT(*)::int AS n FROM organizations o ${clause}`, params);
  params.push(limit, offset);
  const rows = await db().query(
    `SELECT o.id, o.name, o.slug, o.status, o.created_at, o.updated_at, COALESCE(b.plan,'free') AS plan,
            b.subscription_status,
            (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id) AS user_count,
            (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id AND u.disabled_at IS NULL) AS active_user_count
       FROM organizations o LEFT JOIN organization_billing b ON b.organization_id = o.id
       ${clause} ORDER BY o.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return { total: total.rows[0].n, limit, offset, organizations: rows.rows };
}

export async function getOrganization(id: string) {
  assertId(id, 'organization id');
  const r = await db().query(
    `SELECT o.id, o.name, o.slug, o.status, o.status_reason, o.status_changed_at, o.status_changed_by, o.billing_email, o.timezone,
            o.created_at, o.updated_at, COALESCE(b.plan,'free') AS plan, b.subscription_status, b.current_period_end,
            (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id) AS user_count
       FROM organizations o LEFT JOIN organization_billing b ON b.organization_id = o.id WHERE o.id = $1`, [id]);
  if (!r.rowCount) throw new OwnerError(404, 'NOT_FOUND', 'Organization not found');
  return r.rows[0];
}

export async function createOrganization(actor: Actor, input: { name?: unknown; billingEmail?: unknown; adminEmail?: unknown }) {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 2 || name.length > 255) throw new OwnerError(400, 'INVALID_NAME', 'Organization name must be 2-255 characters');
  const adminEmail = typeof input.adminEmail === 'string' && input.adminEmail.trim() ? input.adminEmail.trim().toLowerCase() : null;
  if (adminEmail && !/^\S+@\S+\.\S+$/.test(adminEmail)) throw new OwnerError(400, 'INVALID_EMAIL', 'Invalid administrator email');
  const billingEmail = typeof input.billingEmail === 'string' && input.billingEmail.trim() ? input.billingEmail.trim().toLowerCase().slice(0, 255) : null;

  let inviteToken: string | null = null;
  const created = await withTx(async (client) => {
    const dup = await client.query('SELECT 1 FROM organizations WHERE lower(name) = lower($1) LIMIT 1', [name]);
    if (dup.rowCount) throw new OwnerError(409, 'NAME_TAKEN', 'An organization with this name already exists');
    const id = `org_${randomUUID()}`;
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'organization';
    let slug = slugBase;
    for (let i = 0; i < 6; i += 1) {
      const candidate = i === 0 ? slugBase : `${slugBase}-${i + 1}`;
      if (!(await client.query('SELECT 1 FROM organizations WHERE slug = $1', [candidate])).rowCount) { slug = candidate; break; }
      if (i === 5) throw new OwnerError(409, 'SLUG_TAKEN', 'Could not allocate a unique slug');
    }
    await client.query('INSERT INTO organizations (id, name, slug, billing_email, status) VALUES ($1,$2,$3,$4,\'active\')', [id, name, slug, billingEmail]);
    if (adminEmail) {
      inviteToken = createOneTimeToken();
      await client.query(
        `INSERT INTO organization_invites (id, organization_id, email, role, token_hash, expires_at, invited_by)
         VALUES ($1,$2,$3,'admin',$4,CURRENT_TIMESTAMP + INTERVAL '7 days',$5)`,
        [`invite_${randomUUID()}`, id, adminEmail, hashSessionToken(inviteToken), actor.userId]);
    }
    await recordPlatformAuditTx(client, audit(actor, { action: 'owner.organization_created', targetType: 'organization', targetId: id, organizationId: id, result: 'success', details: { name, adminInvited: Boolean(adminEmail) } }));
    return { id, slug };
  });
  if (adminEmail && inviteToken) {
    try {
      await sendSecurityEmail({ to: adminEmail, subject: `You have been invited to ${name} on Vortex One`, text: `Accept your invitation within 7 days: ${appUrl()}/?invite=${encodeURIComponent(inviteToken)}` });
    } catch (error) { logError('organization invite email', error); }
  }
  return getOrganization(created.id);
}

export async function setOrganizationStatus(actor: Actor, id: string, status: OrganizationStatus, opts: { reason?: unknown; confirmName?: unknown } = {}) {
  assertId(id, 'organization id');
  if (!ORGANIZATION_STATUSES.includes(status)) throw new OwnerError(400, 'INVALID_STATUS', 'Invalid status');
  const reason = typeof opts.reason === 'string' ? opts.reason.trim().slice(0, 500) : '';
  if (status !== 'active' && reason.length < 3) throw new OwnerError(400, 'REASON_REQUIRED', 'A reason is required');
  await withTx(async (client) => {
    const org = await client.query('SELECT id, name, status FROM organizations WHERE id = $1 FOR UPDATE', [id]);
    if (!org.rowCount) throw new OwnerError(404, 'NOT_FOUND', 'Organization not found');
    if (status !== 'active' && id === actor.organizationId) throw new OwnerError(409, 'PROTECTED', "The platform owner's own organization cannot be suspended or deactivated");
    if (status === 'deactivated' && opts.confirmName !== org.rows[0].name) throw new OwnerError(400, 'CONFIRMATION_REQUIRED', 'Type the organization name exactly to confirm deactivation');
    if (org.rows[0].status === status) return;
    await client.query(
      `UPDATE organizations SET status = $2, status_reason = $3, status_changed_at = CURRENT_TIMESTAMP, status_changed_by = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id, status, status === 'active' ? null : reason, actor.userId]);
    if (status === 'deactivated') {
      await client.query('UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL AND user_id IN (SELECT id FROM users WHERE organization_id = $1)', [id]);
    }
    const action = status === 'active' ? 'owner.organization_activated' : status === 'suspended' ? 'owner.organization_suspended' : 'owner.organization_deactivated';
    await recordPlatformAuditTx(client, audit(actor, { action, targetType: 'organization', targetId: id, organizationId: id, result: 'success', details: { from: org.rows[0].status, to: status, reason: reason || undefined } }));
  });
  return getOrganization(id);
}

export async function listOrganizationUsers(orgId: string) {
  await getOrganization(orgId);
  const r = await db().query(
    `SELECT id, name, email, role, disabled_at, last_login_at, mfa_enabled, email_verified_at, created_at
       FROM users WHERE organization_id = $1 ORDER BY created_at ASC LIMIT 500`, [orgId]);
  return { users: r.rows.map(mapUser) };
}

export async function getOrganizationUsage(orgId: string) {
  const org = await getOrganization(orgId);
  const pool = db();
  const counts = await pool.query(
    `SELECT (SELECT COUNT(*)::int FROM users WHERE organization_id = $1) AS users,
            (SELECT COUNT(*)::int FROM contacts WHERE organization_id = $1) AS contacts,
            (SELECT COUNT(*)::int FROM leads WHERE organization_id = $1) AS leads,
            (SELECT COUNT(*)::int FROM properties WHERE organization_id = $1) AS properties,
            (SELECT COUNT(*)::int FROM property_owners WHERE organization_id = $1) AS property_owners,
            (SELECT COUNT(*)::int FROM campaign WHERE organization_id = $1) AS campaigns,
            (SELECT COUNT(*)::int FROM call WHERE organization_id = $1) AS calls,
            (SELECT COUNT(*)::int FROM call WHERE organization_id = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') AS calls_30d`, [orgId]);
  const metrics = await pool.query(
    `SELECT metric, used::bigint AS used FROM organization_usage WHERE organization_id = $1 AND period_start = date_trunc('month', CURRENT_DATE)::date ORDER BY metric`, [orgId]);
  return { organizationId: org.id, plan: org.plan, counts: counts.rows[0], metrics: metrics.rows.map((m) => ({ metric: m.metric, used: Number(m.used) })) };
}

export async function getOrganizationActivity(orgId: string) {
  await getOrganization(orgId);
  const pool = db();
  const customer = await pool.query(
    `SELECT id, agent, action, status, created_at FROM audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50`, [orgId]);
  const owner = await pool.query(
    `SELECT id, actor_role, action, target_type, target_id, result, created_at FROM platform_audit_logs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 50`, [orgId]);
  return { customerActivity: customer.rows, ownerActions: owner.rows };
}

// ---------------------------------------------------------------- users

function mapUser(row: any) {
  return {
    id: row.id, name: row.name, email: row.email, role: row.role, organizationId: row.organization_id, organizationName: row.organization_name,
    organizationStatus: row.organization_status, active: row.disabled_at == null, disabledAt: row.disabled_at ?? null,
    lastLoginAt: row.last_login_at ?? null, mfaEnabled: Boolean(row.mfa_enabled), emailVerified: row.email_verified_at != null,
    createdAt: row.created_at, isPlatformOwner: Boolean(row.is_platform_owner),
  };
}
const USER_COLUMNS = `u.id, u.name, u.email, u.role, u.organization_id, o.name AS organization_name, o.status AS organization_status,
  u.disabled_at, u.last_login_at, u.mfa_enabled, u.email_verified_at, u.created_at,
  EXISTS (SELECT 1 FROM platform_owners po WHERE po.user_id = u.id) AS is_platform_owner`;

export async function listUsers(q: { search?: string; organizationId?: string; active?: string; limit?: unknown; offset?: unknown }) {
  const { limit, offset } = page(q.limit, q.offset);
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.organizationId) { params.push(assertId(q.organizationId, 'organization id')); where.push(`u.organization_id = $${params.length}`); }
  if (q.active === 'true') where.push('u.disabled_at IS NULL');
  if (q.active === 'false') where.push('u.disabled_at IS NOT NULL');
  if (q.search?.trim()) {
    params.push(`%${escapeLike(q.search.trim().slice(0, 100))}%`);
    where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.id ILIKE $${params.length})`);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await db().query(`SELECT COUNT(*)::int AS n FROM users u ${clause}`, params);
  params.push(limit, offset);
  const rows = await db().query(
    `SELECT ${USER_COLUMNS} FROM users u JOIN organizations o ON o.id = u.organization_id ${clause}
      ORDER BY u.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return { total: total.rows[0].n, limit, offset, users: rows.rows.map(mapUser) };
}

export async function getUser(id: string) {
  assertId(id, 'user id');
  const r = await db().query(`SELECT ${USER_COLUMNS} FROM users u JOIN organizations o ON o.id = u.organization_id WHERE u.id = $1`, [id]);
  if (!r.rowCount) throw new OwnerError(404, 'NOT_FOUND', 'User not found');
  return mapUser(r.rows[0]);
}

async function lockTargetUser(client: PoolClient, actor: Actor, id: string) {
  assertId(id, 'user id');
  const r = await client.query('SELECT id, organization_id, role, disabled_at, email FROM users WHERE id = $1 FOR UPDATE', [id]);
  if (!r.rowCount) throw new OwnerError(404, 'NOT_FOUND', 'User not found');
  if (id === actor.userId) throw new OwnerError(409, 'PROTECTED', 'The platform owner account cannot be modified from the portal');
  const owner = await client.query('SELECT 1 FROM platform_owners WHERE user_id = $1', [id]);
  if (owner.rowCount) throw new OwnerError(409, 'PROTECTED', 'The platform owner account is protected');
  return r.rows[0];
}

async function revokeSessions(client: PoolClient, userId: string) {
  await client.query('UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL', [userId]);
}

export async function setUserActive(actor: Actor, id: string, active: boolean) {
  await withTx(async (client) => {
    const user = await lockTargetUser(client, actor, id);
    if (!active && user.role === 'admin' && user.disabled_at == null) {
      const others = await client.query("SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1 AND role = 'admin' AND disabled_at IS NULL AND id <> $2", [user.organization_id, id]);
      if (others.rows[0].n === 0) throw new OwnerError(409, 'LAST_ADMIN', 'Cannot deactivate the last active administrator of an organization');
    }
    await client.query('UPDATE users SET disabled_at = CASE WHEN $2 THEN NULL ELSE COALESCE(disabled_at, CURRENT_TIMESTAMP) END WHERE id = $1', [id, active]);
    if (!active) await revokeSessions(client, id);
    await recordPlatformAuditTx(client, audit(actor, { action: active ? 'owner.user_activated' : 'owner.user_deactivated', targetType: 'user', targetId: id, organizationId: user.organization_id, result: 'success' }));
  });
  return getUser(id);
}

export async function setUserRole(actor: Actor, id: string, role: unknown) {
  if (typeof role !== 'string' || !(SUPPORTED_ROLES as readonly string[]).includes(role)) throw new OwnerError(400, 'INVALID_ROLE', `Role must be one of: ${SUPPORTED_ROLES.join(', ')}`);
  await withTx(async (client) => {
    const user = await lockTargetUser(client, actor, id);
    if (user.role === role) return;
    if (user.role === 'admin' && user.disabled_at == null) {
      const others = await client.query("SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1 AND role = 'admin' AND disabled_at IS NULL AND id <> $2", [user.organization_id, id]);
      if (others.rows[0].n === 0) throw new OwnerError(409, 'LAST_ADMIN', 'Cannot demote the last active administrator of an organization');
    }
    await client.query('UPDATE users SET role = $2 WHERE id = $1', [id, role]);
    // A role change takes effect on the next request (roles are read from the database each time); sessions stay valid.
    await recordPlatformAuditTx(client, audit(actor, { action: 'owner.user_role_changed', targetType: 'user', targetId: id, organizationId: user.organization_id, result: 'success', details: { from: user.role, to: role } }));
  });
  return getUser(id);
}

/**
 * Vortex One users belong to exactly one organization (users.organization_id is NOT NULL), so "removing a membership"
 * means deactivating the user and revoking every session. The row is kept for referential integrity and audit.
 */
export async function removeUserMembership(actor: Actor, id: string) {
  await withTx(async (client) => {
    const user = await lockTargetUser(client, actor, id);
    if (user.role === 'admin' && user.disabled_at == null) {
      const others = await client.query("SELECT COUNT(*)::int AS n FROM users WHERE organization_id = $1 AND role = 'admin' AND disabled_at IS NULL AND id <> $2", [user.organization_id, id]);
      if (others.rows[0].n === 0) throw new OwnerError(409, 'LAST_ADMIN', 'Cannot remove the last active administrator of an organization');
    }
    await client.query('UPDATE users SET disabled_at = COALESCE(disabled_at, CURRENT_TIMESTAMP) WHERE id = $1', [id]);
    await revokeSessions(client, id);
    await recordPlatformAuditTx(client, audit(actor, { action: 'owner.user_membership_removed', targetType: 'user', targetId: id, organizationId: user.organization_id, result: 'success' }));
  });
  return getUser(id);
}

// ---------------------------------------------------------------- audit log

export async function listPlatformAuditLogs(q: { action?: string; organizationId?: string; result?: string; before?: string; limit?: unknown }) {
  const { limit } = page(q.limit, 0);
  const where: string[] = [];
  const params: unknown[] = [];
  if (q.action) { params.push(`${escapeLike(q.action.slice(0, 100))}%`); where.push(`action LIKE $${params.length}`); }
  if (q.organizationId) { params.push(assertId(q.organizationId, 'organization id')); where.push(`organization_id = $${params.length}`); }
  if (q.result) {
    if (!['success', 'denied', 'failure'].includes(q.result)) throw new OwnerError(400, 'INVALID_RESULT', 'Invalid result filter');
    params.push(q.result); where.push(`result = $${params.length}`);
  }
  if (q.before) {
    const d = new Date(q.before);
    if (Number.isNaN(d.getTime())) throw new OwnerError(400, 'INVALID_DATE', 'Invalid before timestamp');
    params.push(d.toISOString()); where.push(`created_at < $${params.length}`);
  }
  params.push(limit);
  const rows = await db().query(
    `SELECT id, actor_user_id, actor_role, action, target_type, target_id, organization_id, result, ip_address, user_agent, details, created_at
       FROM platform_audit_logs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT $${params.length}`, params);
  return { entries: rows.rows };
}

// ---------------------------------------------------------------- system / backups / settings

export async function getSystemHealth() {
  const pool = db();
  const started = Date.now();
  let database: Record<string, unknown>;
  try {
    const r = await pool.query(`SELECT version() AS version, pg_database_size(current_database())::bigint AS size_bytes`);
    const migrations = await pool.query('SELECT COUNT(*)::int AS n, MAX(applied_at) AS last_applied FROM schema_migrations').catch(() => null);
    database = {
      status: 'ok', latencyMs: Date.now() - started, version: String(r.rows[0].version).split(' ').slice(0, 2).join(' '),
      sizeBytes: Number(r.rows[0].size_bytes), migrationsApplied: migrations?.rows[0]?.n ?? null, lastMigrationAt: migrations?.rows[0]?.last_applied ?? null,
    };
  } catch (error) {
    database = { status: 'error', error: 'Database check failed' };
    logError('owner system health', error);
  }
  const jobs = await pool.query(`SELECT status, COUNT(*)::int AS n FROM jobs GROUP BY status`).catch(() => ({ rows: [] as any[] }));
  const lastJob = await pool.query(`SELECT MAX(completed_at) AS last_completed FROM jobs`).catch(() => ({ rows: [{ last_completed: null }] }));
  const jobCounts: Record<string, number> = {};
  for (const row of jobs.rows) jobCounts[row.status] = row.n;
  const mem = process.memoryUsage();
  return {
    status: database.status === 'ok' ? 'ok' : 'degraded',
    checkedAt: new Date().toISOString(),
    database,
    connectionPool: { total: (pool as any).totalCount ?? null, idle: (pool as any).idleCount ?? null, waiting: (pool as any).waitingCount ?? null },
    jobs: { counts: jobCounts, lastCompletedAt: lastJob.rows[0]?.last_completed ?? null },
    process: { uptimeSeconds: Math.round(process.uptime()), node: process.version, rssBytes: mem.rss, heapUsedBytes: mem.heapUsed, environment: process.env.NODE_ENV || 'development' },
    applicationDatabaseStatus: { connected: getDatabaseStatus().connected, type: getDatabaseStatus().type },
  };
}

const BACKUP_TARGETS = [
  { target: 'postgresql', label: 'PostgreSQL (primary source of truth)' },
  { target: 'google_sheets', label: 'Google Sheets (backup/export destination)' },
  { target: 'google_drive', label: 'Google Drive (backup/archive destination)' },
] as const;

/**
 * Reports ONLY what backup jobs recorded in platform_backup_runs. A target with no recorded run is "not_configured":
 * the portal never infers success. Jobs write rows via scripts/record-backup-run.mjs (see docs/owner-portal.md).
 */
export async function getBackupStatus() {
  const pool = db();
  const out = [];
  for (const { target, label } of BACKUP_TARGETS) {
    const last = await pool.query(`SELECT id, status, started_at, finished_at, error, details FROM platform_backup_runs WHERE target = $1 ORDER BY started_at DESC LIMIT 1`, [target]);
    const lastSuccess = await pool.query(`SELECT finished_at FROM platform_backup_runs WHERE target = $1 AND status = 'success' ORDER BY finished_at DESC NULLS LAST LIMIT 1`, [target]);
    const lastFailure = await pool.query(`SELECT finished_at, error FROM platform_backup_runs WHERE target = $1 AND status = 'failure' ORDER BY started_at DESC LIMIT 1`, [target]);
    const run = last.rows[0];
    out.push({
      target, label,
      status: run ? run.status : 'not_configured',
      message: run ? null : 'Not configured: no backup run has ever been recorded for this target.',
      lastRun: run ? { startedAt: run.started_at, finishedAt: run.finished_at, status: run.status } : null,
      lastSuccessfulBackupAt: lastSuccess.rows[0]?.finished_at ?? null,
      lastFailure: lastFailure.rows[0] ? { at: lastFailure.rows[0].finished_at, error: String(lastFailure.rows[0].error || '').slice(0, 500) } : null,
    });
  }
  let liveDatabase: Record<string, unknown> = { reachable: false };
  try {
    const r = await pool.query('SELECT 1');
    liveDatabase = { reachable: r.rowCount === 1 };
  } catch { /* reported as unreachable */ }
  return { targets: out, liveDatabase, note: 'Status reflects backup runs recorded by backup jobs. Google Sheets/Drive are backup destinations only, never authentication or primary storage.' };
}

type SettingStatus = 'implemented' | 'unavailable' | 'planned';
export function getPlatformSettings() {
  const env = process.env;
  const setting = (key: string, label: string, value: unknown, status: SettingStatus, description: string) => ({ key, label, value, status, editable: false, description });
  return {
    note: 'Settings are controlled by the deployment configuration. Secret values are never shown; configured/not-configured is shown for credentials.',
    settings: [
      setting('sessionIdleHours', 'Session idle timeout (hours)', sessionIdleHours(), 'implemented', 'Customer sessions unused for this long are rejected.'),
      setting('sessionAbsoluteDays', 'Session absolute lifetime (days)', sessionAbsoluteDays(), 'implemented', 'Customer sessions never live longer than this.'),
      setting('signupEnabled', 'Self-service organization sign-up', env.SIGNUP_ENABLED !== 'false', 'implemented', 'SIGNUP_ENABLED=false closes public organization creation.'),
      setting('signupAllowedDomains', 'Sign-up allowed domains', (env.SIGNUP_ALLOWED_DOMAINS || '').split(',').map((d) => d.trim()).filter(Boolean), 'implemented', 'Empty means any domain.'),
      setting('ownerMfaRequired', 'Owner portal requires MFA', ownerMfaRequired(), 'implemented', 'Always on in production.'),
      setting('demoMode', 'Demo data mode', isDemoModeEnabled(), 'implemented', 'Never enabled in production.'),
      setting('rateLimitMultiplier', 'Rate-limit multiplier', Number(env.RATE_LIMIT_MULTIPLIER) > 0 ? Number(env.RATE_LIMIT_MULTIPLIER) : 1, 'implemented', 'Scales every limiter.'),
      setting('trustProxy', 'Reverse proxy configured', Boolean(env.TRUST_PROXY), 'implemented', 'Needed so rate limits see real client IPs.'),
      setting('smtpConfigured', 'SMTP configured', Boolean(env.SMTP_HOST && env.SMTP_FROM), 'implemented', 'Required for verification and invitation emails.'),
      setting('stripeConfigured', 'Stripe configured', Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET), 'implemented', 'Billing and webhook verification.'),
      setting('schedulerSecretConfigured', 'Scheduler trigger secret configured', Boolean(env.SCHEDULER_TRIGGER_SECRET), 'implemented', 'Optional HTTP scheduler trigger.'),
      setting('editSettingsFromPortal', 'Edit platform settings in the portal', null, 'unavailable', 'Settings are changed in deployment configuration, not at runtime.'),
      setting('ownerIpAllowList', 'Owner IP allow-list', null, 'planned', 'Restrict owner portal access to approved networks.'),
      setting('dataExport', 'Tenant data export', null, 'planned', 'Audited export of an organization’s data.'),
    ],
  };
}

// ---------------------------------------------------------------- support access

export async function getActiveSupportSession(ownerUserId: string) {
  const pool = db();
  // Close sessions whose window elapsed (audited once).
  const expired = await pool.query(
    `UPDATE platform_support_sessions SET ended_at = expires_at, ended_reason = 'expired'
      WHERE owner_user_id = $1 AND ended_at IS NULL AND expires_at <= CURRENT_TIMESTAMP RETURNING id, organization_id`, [ownerUserId]);
  for (const row of expired.rows) {
    await recordPlatformAudit({ actorUserId: ownerUserId, actorRole: 'platform_owner', action: 'owner.support_session_expired', targetType: 'organization', targetId: row.organization_id, organizationId: row.organization_id, result: 'success', details: { sessionId: row.id } });
  }
  const r = await pool.query(
    `SELECT s.id, s.organization_id, o.name AS organization_name, s.reason, s.started_at, s.expires_at
       FROM platform_support_sessions s JOIN organizations o ON o.id = s.organization_id
      WHERE s.owner_user_id = $1 AND s.ended_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP ORDER BY s.started_at DESC LIMIT 1`, [ownerUserId]);
  return r.rows[0] ?? null;
}

export async function startSupportSession(actor: Actor, input: { orgId?: unknown; reason?: unknown; minutes?: unknown }) {
  const orgId = assertId(input.orgId, 'organization id');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length < 10 || reason.length > 500) throw new OwnerError(400, 'REASON_REQUIRED', 'A support reason of 10-500 characters is required');
  const minutes = Math.min(SUPPORT_MAX_MINUTES, Math.max(5, Math.floor(Number(input.minutes) || SUPPORT_DEFAULT_MINUTES)));
  if (await getActiveSupportSession(actor.userId)) throw new OwnerError(409, 'SUPPORT_SESSION_ACTIVE', 'End the current support session before starting another');
  await getOrganization(orgId);
  const id = `supp_${randomUUID()}`;
  await withTx(async (client) => {
    await client.query(
      `INSERT INTO platform_support_sessions (id, owner_user_id, organization_id, reason, expires_at) VALUES ($1,$2,$3,$4,CURRENT_TIMESTAMP + ($5 * INTERVAL '1 minute'))`,
      [id, actor.userId, orgId, reason, minutes]);
    await recordPlatformAuditTx(client, audit(actor, { action: 'owner.support_session_started', targetType: 'organization', targetId: orgId, organizationId: orgId, result: 'success', details: { sessionId: id, reason, minutes } }));
  });
  return getActiveSupportSession(actor.userId);
}

export async function endSupportSession(actor: Actor) {
  const active = await getActiveSupportSession(actor.userId);
  if (!active) throw new OwnerError(404, 'NO_SUPPORT_SESSION', 'No active support session');
  await withTx(async (client) => {
    await client.query(`UPDATE platform_support_sessions SET ended_at = CURRENT_TIMESTAMP, ended_reason = 'owner' WHERE id = $1 AND ended_at IS NULL`, [active.id]);
    await recordPlatformAuditTx(client, audit(actor, { action: 'owner.support_session_ended', targetType: 'organization', targetId: active.organization_id, organizationId: active.organization_id, result: 'success', details: { sessionId: active.id } }));
  });
  return { ended: true };
}

/** Customer data summary: only available inside an active, audited support window for THAT organization. */
export async function getSupportSummary(actor: Actor, orgId: string) {
  assertId(orgId, 'organization id');
  const active = await getActiveSupportSession(actor.userId);
  if (!active || active.organization_id !== orgId) {
    await recordPlatformAudit(audit(actor, { action: 'owner.support_data_denied', targetType: 'organization', targetId: orgId, organizationId: orgId, result: 'denied', details: { reason: 'no_active_support_session' } }));
    throw new OwnerError(403, 'SUPPORT_SESSION_REQUIRED', 'Start a support session for this organization first');
  }
  const [usage, activity, users] = await Promise.all([getOrganizationUsage(orgId), getOrganizationActivity(orgId), listOrganizationUsers(orgId)]);
  await recordPlatformAudit(audit(actor, { action: 'owner.support_data_viewed', targetType: 'organization', targetId: orgId, organizationId: orgId, result: 'success', details: { sessionId: active.id } }));
  return { supportSession: active, usage, activity, users: users.users };
}

export async function recordOwnerLogin(actor: Actor) {
  await recordPlatformAudit(audit(actor, { action: 'owner.login', targetType: 'user', targetId: actor.userId, result: 'success' }));
}
