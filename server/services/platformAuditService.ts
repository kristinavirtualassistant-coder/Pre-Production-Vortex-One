/**
 * Append-only platform (owner/control-plane) audit trail.
 *
 * Writes use the RAW pool, never the per-request tenant transaction: a denied (4xx) request rolls its transaction back,
 * and the audit row for that denial must survive. Transactional callers pass their own client so the audit row commits
 * or rolls back together with the change it describes.
 */
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { Request } from 'express';
import { getRawPgPool } from '../db/db';
import { logError } from '../security/logger';

export type AuditResult = 'success' | 'denied' | 'failure';

export interface PlatformAuditEntry {
  actorUserId?: string | null;
  actorRole: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  organizationId?: string | null;
  result: AuditResult;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
}

/** Request metadata that is safe to store (no headers, cookies or bodies). */
export function auditContextFromRequest(req: Request): Pick<PlatformAuditEntry, 'ipAddress' | 'userAgent'> {
  return {
    ipAddress: (req.ip || req.socket?.remoteAddress || '').slice(0, 64) || null,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 500) || null,
  };
}

const INSERT_SQL = `INSERT INTO platform_audit_logs
  (id, actor_user_id, actor_role, action, target_type, target_id, organization_id, result, ip_address, user_agent, details)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`;

function values(entry: PlatformAuditEntry) {
  return [
    `paudit_${randomUUID()}`, entry.actorUserId ?? null, entry.actorRole, entry.action, entry.targetType ?? null,
    entry.targetId ?? null, entry.organizationId ?? null, entry.result, entry.ipAddress ?? null, entry.userAgent ?? null,
    JSON.stringify(entry.details ?? {}),
  ];
}

/** Writes inside the caller's transaction (used for state changes). Throws on failure so the change rolls back. */
export async function recordPlatformAuditTx(client: PoolClient, entry: PlatformAuditEntry): Promise<void> {
  await client.query(INSERT_SQL, values(entry));
}

/** Best-effort standalone write (logins, denials, reads). Never throws into the request path. */
export async function recordPlatformAudit(entry: PlatformAuditEntry): Promise<void> {
  try {
    const pool = getRawPgPool();
    if (!pool) return;
    await pool.query(INSERT_SQL, values(entry));
  } catch (error) {
    logError('platform audit write failed', error);
  }
}

/** Records a failed sign-in attempt against the platform-owner identity (called by the shared login handler). */
export async function recordFailedOwnerLogin(email: string, req: Request, reason: string): Promise<void> {
  try {
    const pool = getRawPgPool();
    if (!pool) return;
    const owner = await pool.query(
      `SELECT u.id FROM platform_owners po JOIN users u ON u.id = po.user_id WHERE lower(u.email) = lower($1) LIMIT 1`,
      [email],
    );
    if (!owner.rowCount) return;
    await recordPlatformAudit({
      actorUserId: owner.rows[0].id, actorRole: 'platform_owner', action: 'owner.login_failed', targetType: 'user',
      targetId: owner.rows[0].id, result: 'failure', details: { reason }, ...auditContextFromRequest(req),
    });
  } catch (error) {
    logError('owner failed-login audit failed', error);
  }
}
