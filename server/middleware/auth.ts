import { Request, Response, NextFunction } from 'express';
import { getPgPool } from '../db/db';
import { ensurePostgreSQLAuthSchema } from '../db/postgresqlAuthSchema';
import { hashSessionToken } from '../services/postgresqlAuth';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    name: string;
    role: string;
  };
  dbUser?: {
    id: string;
    organization_id: string;
    email: string;
    name: string;
    role: string;
  };
}

export class AuthorizationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

export function shouldBypassApiAuth(path: string): boolean {
  return path === '/health' || path === '/ready' || path.startsWith('/telephony/webhook/');
}

export function isLocalDevelopmentAuthEnabled(): boolean {
  return process.env.VORTEX_LOCAL_DEV_AUTH === 'true' && process.env.NODE_ENV !== 'production';
}

export function resolveAuthenticatedOrganizationId(
  dbUser: AuthRequest['dbUser'],
  requestedOrganizationId?: string,
): string {
  if (!dbUser?.organization_id) {
    throw new AuthorizationError('Forbidden: No organization is associated with the authenticated user');
  }

  if (requestedOrganizationId && requestedOrganizationId !== dbUser.organization_id) {
    throw new AuthorizationError('Forbidden: Organization does not match authenticated user');
  }

  return dbUser.organization_id;
}

export function canonicalizeOrganizationContext(req: AuthRequest): string {
  const organizationId = resolveAuthenticatedOrganizationId(req.dbUser);

  const queryOrganizationId = req.query.organizationId;
  const body = req.body && typeof req.body === 'object' ? req.body : undefined;
  const bodyOrganizationId = body?.organizationId;
  const bodyOrganization_id = body?.organization_id;
  const headerOrganizationId = req.headers['x-organization-id'];

  const requestedValues = [
    queryOrganizationId,
    bodyOrganizationId,
    bodyOrganization_id,
    headerOrganizationId,
  ].flatMap((value) => Array.isArray(value) ? value : [value]).filter(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );

  if (requestedValues.some((value) => value !== organizationId)) {
    throw new AuthorizationError('Forbidden: Organization does not match authenticated user');
  }

  req.headers['x-organization-id'] = organizationId;
  if (body) {
    body.organizationId = organizationId;
    body.organization_id = organizationId;
  }

  return organizationId;
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const pool = getPgPool();
  if (!pool) {
    return res.status(503).json({ error: 'Database unavailable' });
  }

  try {
    await ensurePostgreSQLAuthSchema(pool);
    const tokenHash = hashSessionToken(authorization.slice('Bearer '.length));
    const { rows } = await pool.query(
      `SELECT u.id, u.organization_id, u.email, u.name, u.role
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > CURRENT_TIMESTAMP
         AND u.disabled_at IS NULL
       LIMIT 1`,
      [tokenHash],
    );

    const dbUser = rows[0];
    if (!dbUser) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    req.dbUser = dbUser;
    req.user = {
      uid: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    };

    await pool.query(
      'UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = $1',
      [tokenHash],
    );

    canonicalizeOrganizationContext(req);
    return next();
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('PostgreSQL authentication error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Unauthorized: User not found in DB' });
    }
    if (!roles.includes(req.dbUser.role)) {
      return res.status(403).json({ error: `Forbidden: Requires one of roles: ${roles.join(', ')}` });
    }
    next();
  };
};
