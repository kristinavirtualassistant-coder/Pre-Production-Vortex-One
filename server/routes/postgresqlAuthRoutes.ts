import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { getPgPool } from '../db/db';
import { ensurePostgreSQLAuthSchema } from '../db/postgresqlAuthSchema';
import { hashPassword, verifyPassword, createSessionToken, hashSessionToken } from '../services/postgresqlAuth';

export const postgresqlAuthRouter = Router();

postgresqlAuthRouter.post('/login', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const pool = getPgPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  try {
    await ensurePostgreSQLAuthSchema(pool);
    const result = await pool.query(
      `SELECT id, organization_id, email, name, role, password_hash, disabled_at
       FROM users WHERE lower(email) = $1 LIMIT 1`,
      [email],
    );
    const user = result.rows[0];
    if (!user || user.disabled_at || !user.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    await pool.query(
      `INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '7 days')`,
      [`sess_${randomUUID()}`, user.id, tokenHash],
    );
    await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    return res.json({
      token,
      user: { id: user.id, organization_id: user.organization_id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('PostgreSQL login error:', error);
    return res.status(500).json({ error: 'Authentication service unavailable' });
  }
});

postgresqlAuthRouter.post('/signup', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const organizationName = typeof req.body?.organizationName === 'string' ? req.body.organizationName.trim() : '';
  if (!email || !password || !name || !organizationName) {
    return res.status(400).json({ error: 'Email, password, name, and organizationName are required' });
  }
  if (organizationName.length < 2 || organizationName.length > 255) {
    return res.status(400).json({ error: 'Organization name must be between 2 and 255 characters' });
  }

  const pool = getPgPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

  const client = await pool.connect();
  try {
    await ensurePostgreSQLAuthSchema(pool);
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
      if (attempt === 4) throw Object.assign(new Error('Organization slug could not be allocated'), { code: 'ORG_SLUG_CONFLICT' });
    }

    await client.query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, $2, $3)`,
      [organizationId, organizationName, slug],
    );

    const passwordHash = await hashPassword(password);
    const userId = `user_${randomUUID()}`;
    const result = await client.query(
      `INSERT INTO users (id, organization_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, $4, 'admin', $5)
       RETURNING id, organization_id, email, name, role`,
      [userId, organizationId, email, name, passwordHash],
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
});

postgresqlAuthRouter.post('/logout', async (req: Request, res: Response) => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    const pool = getPgPool();
    if (pool) {
      await ensurePostgreSQLAuthSchema(pool);
      await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashSessionToken(authorization.slice(7))]);
    }
  }
  return res.status(204).send();
});
