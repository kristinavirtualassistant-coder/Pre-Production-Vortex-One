import { Request, Response, NextFunction } from 'express';
import { getPgPool } from '../db/db';
import { hashSessionToken } from '../services/postgresqlAuth';

export interface PostgreSQLAuthRequest extends Request {
  dbUser?: { id: string; organization_id: string; email: string; name: string; role: string };
}

export async function requirePostgreSQLAuth(req: PostgreSQLAuthRequest, res: Response, next: NextFunction) {
  const authorization = req.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized: Missing token' });
  const pool = getPgPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const tokenHash = hashSessionToken(authorization.slice(7));
    const result = await pool.query(
      `SELECT u.id, u.organization_id, u.email, u.name, u.role
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > CURRENT_TIMESTAMP
         AND u.disabled_at IS NULL
       LIMIT 1`,
      [tokenHash],
    );
    if (!result.rows[0]) return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });

    req.dbUser = result.rows[0];
    await pool.query('UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = $1', [tokenHash]);
    const organizationId = req.dbUser.organization_id;
    const requestedValues = [
      req.headers['x-organization-id'],
      req.query.organizationId,
      req.body?.organizationId,
      req.body?.organization_id,
    ].flatMap((value) => Array.isArray(value) ? value : [value]).filter((value): value is string => typeof value === 'string' && value.length > 0);
    if (requestedValues.some((value) => value !== organizationId)) return res.status(403).json({ error: 'Forbidden: Organization does not match authenticated user' });
    req.headers['x-organization-id'] = organizationId;
    if (req.body && typeof req.body === 'object') {
      req.body.organizationId = organizationId;
      req.body.organization_id = organizationId;
    }
    req.query.organizationId = organizationId;
    return next();
  } catch (error) {
    console.error('PostgreSQL authentication error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
