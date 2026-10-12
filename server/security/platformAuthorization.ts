/**
 * Authorization layers (backend-enforced; the frontend is never a security boundary):
 *
 *   platform_owner       -> the whole platform. NOT a users.role value: it is the single row in platform_owners, which
 *                           only the trusted provisioning script can write. Nothing a client sends can create or imply it.
 *   organization admin   -> only their own organization (users.role admin/executive, organization from the session).
 *   organization member  -> only their own organization, within permissions.
 *
 * These guards run AFTER requireAuth (which resolves the session -> users row -> organization). They never read an
 * organization id, role or owner flag from the request.
 */
import type { NextFunction, Request, Response } from 'express';
import { getRawPgPool } from '../db/db';
import { getSessionToken } from '../services/accountSecurity';
import { hashSessionToken } from '../services/postgresqlAuth';
import type { AuthRequest } from '../middleware/auth';
import { auditContextFromRequest, recordPlatformAudit } from '../services/platformAuditService';

export interface PlatformOwnerContext {
  userId: string;
  email: string;
  organizationId: string;
  mfaEnabled: boolean;
  mfaVerifiedSession: boolean;
}
export type PlatformOwnerRequest = AuthRequest & { platformOwner?: PlatformOwnerContext };

const ORG_ADMIN_ROLES = ['admin', 'executive'];

/** MFA is required for the owner in production unless explicitly disabled for non-production environments. */
export function ownerMfaRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.OWNER_PORTAL_REQUIRE_MFA ?? '').trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return env.NODE_ENV !== 'production';
  return env.NODE_ENV === 'production';
}

export function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction) {
  if (!(req as AuthRequest).dbUser) return res.status(401).json({ error: 'Authentication required' });
  return next();
}

const forbidden = (res: Response) => res.status(403).json({ error: 'Forbidden' });

/** Every /api/owner/* endpoint is mounted behind this. Responds with nothing sensitive before it succeeds. */
export async function requirePlatformOwner(req: Request, res: Response, next: NextFunction) {
  const r = req as PlatformOwnerRequest;
  const user = r.dbUser;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const pool = getRawPgPool();
    if (!pool) return res.status(503).json({ error: 'Service unavailable' });
    const owner = await pool.query(
      `SELECT u.id, u.email, u.organization_id, u.mfa_enabled
         FROM platform_owners po
         JOIN users u ON u.id = po.user_id
         JOIN organizations o ON o.id = u.organization_id
        WHERE po.user_id = $1 AND u.disabled_at IS NULL AND o.status = 'active'
        LIMIT 1`,
      [user.id],
    );
    if (!owner.rowCount) {
      // Not the platform owner (customer user, org admin, or anyone else). Generic 403; the attempt is audited.
      await recordPlatformAudit({
        actorUserId: user.id, actorRole: user.role, action: 'owner.access_denied', targetType: 'route',
        targetId: `${req.method} ${req.baseUrl}${req.path}`.slice(0, 128), organizationId: user.organization_id,
        result: 'denied', ...auditContextFromRequest(req),
      });
      return forbidden(res);
    }
    const row = owner.rows[0];
    let mfaVerifiedSession = false;
    const token = getSessionToken(req);
    if (token) {
      const session = await pool.query(
        'SELECT mfa_verified_at FROM auth_sessions WHERE token_hash = $1 AND revoked_at IS NULL LIMIT 1',
        [hashSessionToken(token)],
      );
      mfaVerifiedSession = Boolean(session.rows[0]?.mfa_verified_at);
    }
    if (ownerMfaRequired() && !(row.mfa_enabled && mfaVerifiedSession)) {
      await recordPlatformAudit({
        actorUserId: row.id, actorRole: 'platform_owner', action: 'owner.access_denied', targetType: 'route',
        targetId: `${req.method} ${req.baseUrl}${req.path}`.slice(0, 128), result: 'denied',
        details: { reason: row.mfa_enabled ? 'mfa_not_verified_for_session' : 'mfa_not_enabled' }, ...auditContextFromRequest(req),
      });
      return res.status(403).json({ error: 'Multi-factor authentication is required for the owner portal', code: 'MFA_REQUIRED', mfaEnabled: Boolean(row.mfa_enabled) });
    }
    r.platformOwner = { userId: row.id, email: row.email, organizationId: row.organization_id, mfaEnabled: Boolean(row.mfa_enabled), mfaVerifiedSession };
    return next();
  } catch (error) {
    console.error('[owner] authorization check failed:', (error as Error)?.message);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

/**
 * Organization administrator of the organization derived from the session. A client-supplied organization id (route
 * parameter, query or body) is only ever compared against that organization; a mismatch is rejected, never honored.
 */
export function requireOrganizationAdmin(organizationParam?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).dbUser;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    if (!ORG_ADMIN_ROLES.includes(user.role)) return forbidden(res);
    const requested = organizationParam ? (req.params[organizationParam] ?? req.query[organizationParam] ?? req.body?.[organizationParam]) : undefined;
    if (requested !== undefined && String(requested) !== user.organization_id) return forbidden(res);
    return next();
  };
}

/** Any member of the organization resolved from the session; same organization-id rule as above. */
export function requireOrganizationMember(organizationParam?: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthRequest).dbUser;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const requested = organizationParam ? (req.params[organizationParam] ?? req.query[organizationParam] ?? req.body?.[organizationParam]) : undefined;
    if (requested !== undefined && String(requested) !== user.organization_id) return forbidden(res);
    return next();
  };
}
