import { Request, Response, NextFunction } from 'express';
import { adminAuth } from './firebase-admin';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getPgPool } from '../db/db';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  dbUser?: {
    id: string;
    organization_id: string;
    email: string;
    name: string;
    role: string;
    uid?: string;
  };
}

export class AuthorizationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) { super(message); this.name = 'AuthorizationError'; this.statusCode = statusCode; }
}

export function shouldBypassApiAuth(path: string): boolean {
  return path === '/health' || path === '/ready' || path.startsWith('/telephony/webhook/');
}

export function isLocalDevelopmentAuthEnabled(): boolean {
  return process.env.VORTEX_LOCAL_DEV_AUTH === 'true';
}

export function resolveAuthenticatedOrganizationId(dbUser: AuthRequest['dbUser'], requestedOrganizationId?: string): string {
  if (!dbUser?.organization_id) throw new AuthorizationError('Forbidden: No organization is associated with the authenticated user');
  if (requestedOrganizationId && requestedOrganizationId !== dbUser.organization_id) {
    throw new AuthorizationError('Forbidden: Organization does not match authenticated user');
  }
  return dbUser.organization_id;
}

/** Make the authenticated organization the only tenant context available downstream. */
export function canonicalizeOrganizationContext(req: AuthRequest): string {
  const organizationId = resolveAuthenticatedOrganizationId(req.dbUser);
  const queryOrganizationId = req.query.organizationId;
  const body = req.body && typeof req.body === 'object' ? req.body : undefined;
  const bodyOrganizationId = body?.organizationId;
  const bodyOrganization_id = body?.organization_id;
  const headerOrganizationId = req.headers['x-organization-id'];
  const requestedValues = [queryOrganizationId, bodyOrganizationId, bodyOrganization_id, headerOrganizationId]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (requestedValues.some((value) => value !== organizationId)) {
    throw new AuthorizationError('Forbidden: Organization does not match authenticated user');
  }
  req.headers['x-organization-id'] = organizationId;
  req.query.organizationId = organizationId;
  if (body) { body.organizationId = organizationId; body.organization_id = organizationId; }
  return organizationId;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  if (isLocalDevelopmentAuthEnabled()) {
    const organizationId = (req.headers['x-organization-id'] as string | undefined) || 'org_cmc_realty';
    const email = (req.headers['x-user-email'] as string | undefined) || 'local@cmcrealty.com';
    const name = (req.headers['x-user-name'] as string | undefined) || 'Local Development User';
    const role = (req.headers['x-user-role'] as string | undefined) || 'executive';
    const userId = (req.headers['x-user-id'] as string | undefined) || 'local_dev_user';
    req.user = { uid: userId, email, name, role, aud: 'vortex-one-local', auth_time: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+86400, iat: Math.floor(Date.now()/1000), iss: 'local-development', sub: userId } as unknown as DecodedIdToken;
    req.dbUser = { id: userId, organization_id: organizationId, email, name, role, uid: userId };
    canonicalizeOrganizationContext(req);
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized: Missing token' });
  const token = authHeader.slice('Bearer '.length);

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const pool = getPgPool();
    if (!pool) return res.status(503).json({ error: 'Database unavailable' });

    const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
    if (!requestedOrgId) return res.status(400).json({ error: 'Missing organization context' });

    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT id, organization_id, email, name, role, uid
         FROM users
         WHERE organization_id = $1
           AND (uid = $2 OR (uid IS NULL AND email = $3))
         LIMIT 1`,
        [requestedOrgId, decodedToken.uid, decodedToken.email || ''],
      );
      if (rows.length === 0) return res.status(403).json({ error: 'Forbidden: User is not a member of this organization' });

      req.dbUser = rows[0];
      if (!rows[0].uid) {
        await client.query('UPDATE users SET uid = $1 WHERE id = $2 AND uid IS NULL', [decodedToken.uid, rows[0].id]);
        req.dbUser.uid = decodedToken.uid;
      }
      canonicalizeOrganizationContext(req);
    } finally {
      client.release();
    }
    next();
  } catch (error: any) {
    if (error instanceof AuthorizationError) return res.status(error.statusCode).json({ error: error.message });
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized: User not found in DB' });
    if (!roles.includes(req.dbUser.role)) return res.status(403).json({ error: `Forbidden: Requires one of roles: ${roles.join(', ')}` });
    next();
  };
};
