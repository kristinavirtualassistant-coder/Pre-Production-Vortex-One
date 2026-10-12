/**
 * Which application this process serves. One codebase, deployed as separate services on separate hostnames:
 *   - `platform`: the customer platform (app.<domain>). The Owner Portal does not exist here: /owner and /api/owner 404.
 *   - `owner`:    the Owner Portal (owner.<domain>). Only the portal shell, sign-in/MFA/logout and /api/owner exist;
 *                 there is no sign-up, password reset, customer API, webhook or background job.
 *   - `combined`: both (local development, tests, and deployments that have not set APP_SURFACE yet).
 * Separate hostnames also give each surface its own host-only session cookie.
 */
import type { NextFunction, Request, Response } from 'express';

export type AppSurface = 'combined' | 'platform' | 'owner';

export function resolveAppSurface(env: NodeJS.ProcessEnv = process.env): AppSurface {
  const value = (env.APP_SURFACE || '').trim().toLowerCase();
  if (!value) return 'combined';
  if (value === 'combined' || value === 'platform' || value === 'owner') return value;
  throw new Error(`APP_SURFACE must be "platform", "owner" or "combined" (got "${env.APP_SURFACE}").`);
}

const isOwnerPage = (path: string) => path === '/owner' || path.startsWith('/owner/');
const isOwnerApi = (path: string) => path === '/api/owner' || path.startsWith('/api/owner/');

/** Exact API endpoints the Owner Portal needs besides /api/owner/*. Anything else under /api is absent on that surface. */
const OWNER_SURFACE_API: ReadonlyArray<readonly [method: string, path: string]> = [
  ['GET', '/api/health'],
  ['GET', '/api/ready'],
  ['POST', '/api/auth/login'],
  ['POST', '/api/auth/mfa/verify'],
  ['POST', '/api/auth/logout'],
];

/** Static build output the portal shell loads. Everything else that is not an owner page redirects to the portal. */
const isStaticAsset = (path: string) => path.startsWith('/assets/') || /^\/[^/]+\.(ico|png|svg|webmanifest|txt)$/.test(path);

function notFound(res: Response) {
  res.status(404).json({ error: 'Not found' });
}

export function appSurfaceGate(surface: AppSurface) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    if (surface === 'combined') return next();

    if (surface === 'platform') {
      if (isOwnerPage(path) || isOwnerApi(path)) return notFound(res);
      return next();
    }

    // owner surface
    if (path === '/api' || path.startsWith('/api/')) {
      if (isOwnerApi(path)) return next();
      const method = req.method === 'HEAD' ? 'GET' : req.method;
      if (OWNER_SURFACE_API.some(([m, p]) => m === method && p === path)) return next();
      return notFound(res);
    }
    if (isOwnerPage(path) || isStaticAsset(path)) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return notFound(res);
    return res.redirect(302, '/owner');
  };
}
