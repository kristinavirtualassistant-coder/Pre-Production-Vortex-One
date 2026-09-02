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
  return path === '/health' || path.startsWith('/telephony/webhook/');
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

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.slice('Bearer '.length);
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const pool = getPgPool();
    if (!pool) {
      return res.status(503).json({ error: 'Database unavailable' });
    }

    const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
    if (!requestedOrgId) {
      return res.status(400).json({ error: 'Missing organization context' });
    }

    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        'SELECT id, organization_id, email, name, role FROM users WHERE email = $1 AND organization_id = $2',
        [decodedToken.email, requestedOrgId],
      );

      if (rows.length === 0) {
        return res.status(403).json({ error: 'Forbidden: User is not a member of this organization' });
      }

      req.dbUser = rows[0];
      resolveAuthenticatedOrganizationId(req.dbUser, requestedOrgId);
    } finally {
      client.release();
    }

    next();
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
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
