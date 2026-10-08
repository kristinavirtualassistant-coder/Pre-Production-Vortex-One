import { randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { getPgPool } from '../db/db';
import { requirePermission } from '../security/permissions';
import { logError, securityEvent } from '../security/logger';
import { completeOAuthCallback, createOAuthStart, type OAuthProvider } from '../services/integrationOAuth';
import type { AuthRequest } from '../middleware/auth';

const PROVIDERS = new Set<OAuthProvider>(['google-workspace', 'microsoft-365']);
const NONCE_COOKIE = 'vortex_oauth_nonce';
const NONCE_PATH = '/api/integrations/oauth';

const isProvider = (value: string): value is OAuthProvider => PROVIDERS.has(value as OAuthProvider);

function readCookie(req: Request, name: string): string {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

function setNonceCookie(res: Response, value: string, maxAgeSeconds: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.append('Set-Cookie', `${NONCE_COOKIE}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=${NONCE_PATH}; HttpOnly; SameSite=Lax${secure}`);
}

const appRedirect = (query: string) => `${(process.env.APP_URL || '').replace(/\/$/, '')}/?${query}`;

/** Authenticated integration management: list, start OAuth, disconnect. */
export const integrationsRouter = Router();

integrationsRouter.get('/', async (req, res) => {
  const pool = getPgPool();
  const user = (req as AuthRequest).dbUser;
  if (!pool || !user) return res.status(503).json({ error: 'Database unavailable' });
  // Tokens are never returned; scoped to the caller's own connections within their organization.
  const { rows } = await pool.query(
    `SELECT provider, account_email, status, token_expires_at, updated_at
       FROM integration_connections WHERE organization_id = $1 AND user_id = $2 ORDER BY provider`,
    [user.organization_id, user.id],
  );
  return res.json({ connections: rows });
});

integrationsRouter.get('/oauth/start/:provider', requirePermission('integrations:connect'), async (req, res) => {
  const provider = req.params.provider;
  if (!isProvider(provider)) return res.status(404).json({ error: 'Unknown integration provider' });
  const pool = getPgPool();
  const user = (req as AuthRequest).dbUser;
  if (!pool || !user) return res.status(503).json({ error: 'Database unavailable' });
  try {
    const browserNonce = randomBytes(24).toString('base64url');
    const authorizationUrl = await createOAuthStart(pool, { provider, userId: user.id, organizationId: user.organization_id, browserNonce });
    setNonceCookie(res, browserNonce, 600);
    return res.json({ authorizationUrl });
  } catch (error) {
    logError('integration oauth start', error);
    return res.status(503).json({ error: 'This integration is not configured' });
  }
});

integrationsRouter.delete('/:provider', requirePermission('integrations:connect'), async (req, res) => {
  const provider = req.params.provider;
  if (!isProvider(provider)) return res.status(404).json({ error: 'Unknown integration provider' });
  const pool = getPgPool();
  const user = (req as AuthRequest).dbUser;
  if (!pool || !user) return res.status(503).json({ error: 'Database unavailable' });
  const result = await pool.query(
    `UPDATE integration_connections SET status = 'disconnected', access_token = NULL, refresh_token = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = $1 AND user_id = $2 AND provider = $3`,
    [user.organization_id, user.id, provider],
  );
  return res.json({ disconnected: (result.rowCount ?? 0) > 0 });
});

/**
 * Provider redirect target. Public by necessity (no session header on a cross-site redirect), so it is protected by:
 * a one-time unguessable state bound to the initiating user/organization, PKCE, and a browser nonce cookie that
 * must match the one set when the flow started. Errors never echo provider text.
 */
export const integrationOAuthCallbackRouter = Router();

integrationOAuthCallbackRouter.get('/callback/:provider', async (req, res) => {
  const provider = req.params.provider;
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const fail = (reason: string) => {
    setNonceCookie(res, '', 0);
    return res.redirect(302, appRedirect(`integrationError=${encodeURIComponent(reason)}`));
  };
  if (!isProvider(provider)) return res.status(404).json({ error: 'Unknown integration provider' });
  if (typeof req.query.error === 'string') return fail('The provider did not authorize the connection.');
  if (!state || !code || state.length > 200 || code.length > 4096) return fail('The connection request was invalid.');
  const pool = getPgPool();
  if (!pool) return fail('Service unavailable.');
  try {
    const result = await completeOAuthCallback(pool, provider, state, code, readCookie(req, NONCE_COOKIE));
    securityEvent('integration_connected', { provider, organizationId: result.organizationId, userId: result.userId });
    setNonceCookie(res, '', 0);
    return res.redirect(302, appRedirect(`connected=${encodeURIComponent(provider)}`));
  } catch (error) {
    logError('integration oauth callback', error);
    return fail('The connection could not be completed. Please try again.');
  }
});
