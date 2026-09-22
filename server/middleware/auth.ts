import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { getPgPool } from '../db/db';
import { ensurePostgreSQLAuthSchema } from '../db/postgresqlAuthSchema';
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from '../services/postgresqlAuth';

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
  return path === '/health' || path === '/ready' || path.startsWith('/telephony/webhook/') || path.startsWith('/integrations/oauth/callback/');
}

export function isLocalDevelopmentAuthEnabled(): boolean {
  return false;
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
  const requestedValues = [
    queryOrganizationId,
    body?.organizationId,
    body?.organization_id,
    req.headers['x-organization-id'],
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

async function handleLogin(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const result = await pool.query(
    `SELECT u.id, u.organization_id, u.email, u.name, u.role, u.password_hash, u.disabled_at,
            o.name AS organization_name, o.slug AS organization_slug, o.settings AS organization_settings
     FROM users u
     JOIN organizations o ON o.id = u.organization_id
     WHERE lower(u.email) = $1
     LIMIT 1`,
    [email],
  );
  const user = result.rows[0];
  if (!user || user.disabled_at || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = createSessionToken();
  await pool.query(
    `INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '7 days')`,
    [`sess_${randomUUID()}`, user.id, hashSessionToken(token)],
  );
  await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

  return res.json({
    token,
    user: {
      id: user.id,
      organization_id: user.organization_id,
      organization_name: user.organization_name,
      organization_slug: user.organization_slug,
      organization_settings: user.organization_settings,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}

async function handleSignup(req: AuthRequest, res: Response, pool: NonNullable<ReturnType<typeof getPgPool>>) {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const organizationName = typeof req.body?.organizationName === 'string' ? req.body.organizationName.trim() : '';

  if (!email || !password || !name || !organizationName) {
    return res.status(400).json({ error: 'Email, password, name, and organizationName are required' });
  }
  if (password.length < 12) return res.status(400).json({ error: 'Password must be at least 12 characters' });
  if (organizationName.length < 2 || organizationName.length > 255) {
    return res.status(400).json({ error: 'Organization name must be between 2 and 255 characters' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingOrganization = await client.query(
      'SELECT id FROM organizations WHERE lower(name) = lower($1) LIMIT 1',
      [organizationName],
    );
    if (existingOrganization.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An organization with this name already exists' });
    }

    const organizationId = `org_${randomUUID()}`;
    const slugBase = organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'organization';
    let slug = slugBase;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = attempt === 0 ? '' : `-${attempt + 1}`;
      const candidate = `${slugBase.slice(0, 100 - suffix.length)}${suffix}`;
      const slugCheck = await client.query('SELECT 1 FROM organizations WHERE slug = $1 LIMIT 1', [candidate]);
      if (!slugCheck.rowCount) {
        slug = candidate;
        break;
      }
      if (attempt === 4) {
        throw Object.assign(new Error('Organization slug could not be allocated'), { code: 'ORG_SLUG_CONFLICT' });
      }
    }

    await client.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, $2, $3)`,
      [organizationId, organizationName, slug],
    );

    const passwordHash = await hashPassword(password);
    const result = await client.query(
      `INSERT INTO users (id, organization_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, $4, 'admin', $5)
       RETURNING id, organization_id, email, name, role`,
      [`user_${randomUUID()}`, organizationId, email, name, passwordHash],
    );

    await client.query('COMMIT');
    return res.status(201).json({ user: result.rows[0] });
  } catch (error: any) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original failure */ }
    if (error?.code === '23505') return res.status(409).json({ error: 'An account or organization with these details already exists' });
    console.error('PostgreSQL signup error:', error);
    return res.status(500).json({ error: 'Account creation failed' });
  } finally {
    client.release();
  }
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const pool = getPgPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    await ensurePostgreSQLAuthSchema(pool);

    if (req.path === '/auth/login' && req.method === 'POST') return handleLogin(req, res, pool);
    if (req.path === '/auth/signup' && req.method === 'POST') return handleSignup(req, res, pool);
    if (req.path === '/auth/logout' && req.method === 'POST') {
      const authorization = req.headers.authorization;
      if (authorization?.startsWith('Bearer ')) {
        await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashSessionToken(authorization.slice(7))]);
      }
      return res.status(204).send();
    }

    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing token' });
    }

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
    if (!dbUser) return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });

    req.dbUser = dbUser;
    req.user = { uid: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role };
    await pool.query('UPDATE auth_sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE token_hash = $1', [tokenHash]);
    canonicalizeOrganizationContext(req);
    return next();
  } catch (error: any) {
    if (error instanceof AuthorizationError) return res.status(error.statusCode).json({ error: error.message });
    console.error('PostgreSQL authentication error:', error);
    return res.status(500).json({ error: 'Authentication service unavailable' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) return res.status(401).json({ error: 'Unauthorized: User not found in DB' });
    if (!roles.includes(req.dbUser.role)) return res.status(403).json({ error: `Forbidden: Requires one of roles: ${roles.join(', ')}` });
    next();
  };
};
