import { Router, Request, Response } from 'express';
import { getPgPool } from '../db/db';
import { hashPassword, verifyPassword, createSessionToken, hashSessionToken } from '../services/postgresqlAuth';

export const postgresqlAuthRouter = Router();

postgresqlAuthRouter.post('/login', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const pool = getPgPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });

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
    [`sess_${crypto.randomUUID()}`, user.id, tokenHash],
  );
  await pool.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

  return res.json({
    token,
    user: { id: user.id, organization_id: user.organization_id, email: user.email, name: user.name, role: user.role },
  });
});

postgresqlAuthRouter.post('/signup', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const organizationId = typeof req.body?.organizationId === 'string' ? req.body.organizationId.trim() : '';
  if (!email || !password || !name || !organizationId) return res.status(400).json({ error: 'Email, password, name, and organizationId are required' });

  const pool = getPgPool();
  if (!pool) return res.status(503).json({ error: 'Database unavailable' });
  const passwordHash = await hashPassword(password);
  const id = `user_${crypto.randomUUID()}`;
  try {
    const result = await pool.query(
      `INSERT INTO users (id, organization_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, $4, 'member', $5)
       RETURNING id, organization_id, email, name, role`,
      [id, organizationId, email, name, passwordHash],
    );
    return res.status(201).json({ user: result.rows[0] });
  } catch (error: any) {
    if (error?.code === '23505') return res.status(409).json({ error: 'An account with this email already exists in the organization' });
    throw error;
  }
});

postgresqlAuthRouter.post('/logout', async (req: Request, res: Response) => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    const pool = getPgPool();
    if (pool) await pool.query('DELETE FROM auth_sessions WHERE token_hash = $1', [hashSessionToken(authorization.slice(7))]);
  }
  return res.status(204).send();
});
