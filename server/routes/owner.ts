/**
 * Platform Owner control-plane API (/api/owner/*).
 *
 * Security properties:
 *  - mounted behind the shared requireAuth (session cookie) AND requirePlatformOwner on every route;
 *  - no endpoint creates, invites, promotes or lists platform owners: the owner is provisioned out-of-band;
 *  - state-changing requests need the X-Vortex-Owner header (cross-site forms cannot set it) and a same-origin Origin;
 *  - responses are never cacheable; errors never include internals.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';
import { createRateLimiter } from '../middleware/rateLimit';
import { requirePlatformOwner, type PlatformOwnerRequest } from '../security/platformAuthorization';
import { auditContextFromRequest } from '../services/platformAuditService';
import { safeErrorMessage } from '../security/logger';
import * as owner from '../services/platformOwnerService';

export const ownerRouter = Router();

const noStore = (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
};

/** CSRF defence in depth on top of SameSite=Lax cookies. */
function csrfGuard(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.header('x-vortex-owner') !== '1') return res.status(403).json({ error: 'Forbidden' });
  const origin = req.header('origin');
  if (origin) {
    try {
      const host = new URL(origin).host;
      const allowed = new Set([req.header('host') || '']);
      if (process.env.APP_URL) allowed.add(new URL(process.env.APP_URL).host);
      if (!allowed.has(host)) return res.status(403).json({ error: 'Forbidden' });
    } catch { return res.status(403).json({ error: 'Forbidden' }); }
  }
  return next();
}

// Order matters: authorization runs before anything can respond with platform data.
ownerRouter.use(noStore, requirePlatformOwner, csrfGuard, createRateLimiter({ keyPrefix: 'owner-api', windowMs: 60_000, max: 300 }));

const actorOf = (req: Request): owner.Actor => {
  const o = (req as PlatformOwnerRequest).platformOwner!;
  const ctx = auditContextFromRequest(req);
  return { userId: o.userId, organizationId: o.organizationId, ip: ctx.ipAddress, userAgent: ctx.userAgent };
};

type Handler = (req: Request, res: Response) => Promise<unknown>;
const route = (fn: Handler) => async (req: Request, res: Response) => {
  try {
    res.json(await fn(req, res));
  } catch (error) {
    if (error instanceof owner.OwnerError) return res.status(error.status).json({ error: error.message, code: error.code });
    return res.status(500).json({ error: safeErrorMessage(error, 'Owner request failed') });
  }
};
const q = (req: Request, key: string) => (typeof req.query[key] === 'string' ? (req.query[key] as string) : undefined);

// ---- session
ownerRouter.get('/session', route(async (req) => {
  const o = (req as PlatformOwnerRequest).platformOwner!;
  const support = await owner.getActiveSupportSession(o.userId);
  return { owner: { userId: o.userId, email: o.email, role: 'platform_owner', mfaEnabled: o.mfaEnabled, mfaVerified: o.mfaVerifiedSession }, supportSession: support };
}));
ownerRouter.post('/session/start', route(async (req) => { await owner.recordOwnerLogin(actorOf(req)); return { ok: true }; }));

// ---- dashboard / usage / system / backups / settings
ownerRouter.get('/overview', route(() => owner.getOverview()));
ownerRouter.get('/usage', route(() => owner.getPlatformUsage()));
ownerRouter.get('/system', route(() => owner.getSystemHealth()));
ownerRouter.get('/backups', route(() => owner.getBackupStatus()));
ownerRouter.get('/settings', route(async () => owner.getPlatformSettings()));
ownerRouter.get('/audit-logs', route((req) => owner.listPlatformAuditLogs({
  action: q(req, 'action'), organizationId: q(req, 'orgId'), result: q(req, 'result'), before: q(req, 'before'), limit: q(req, 'limit'),
})));

// ---- organizations
ownerRouter.get('/organizations', route((req) => owner.listOrganizations({ search: q(req, 'search'), status: q(req, 'status'), limit: q(req, 'limit'), offset: q(req, 'offset') })));
ownerRouter.post('/organizations', route(async (req, res) => { const org = await owner.createOrganization(actorOf(req), req.body ?? {}); res.status(201); return org; }));
ownerRouter.get('/organizations/:id', route((req) => owner.getOrganization(req.params.id)));
ownerRouter.get('/organizations/:id/users', route((req) => owner.listOrganizationUsers(req.params.id)));
ownerRouter.get('/organizations/:id/usage', route((req) => owner.getOrganizationUsage(req.params.id)));
ownerRouter.get('/organizations/:id/activity', route((req) => owner.getOrganizationActivity(req.params.id)));
ownerRouter.post('/organizations/:id/suspend', route((req) => owner.setOrganizationStatus(actorOf(req), req.params.id, 'suspended', { reason: req.body?.reason })));
ownerRouter.post('/organizations/:id/activate', route((req) => owner.setOrganizationStatus(actorOf(req), req.params.id, 'active')));
ownerRouter.post('/organizations/:id/deactivate', route((req) => owner.setOrganizationStatus(actorOf(req), req.params.id, 'deactivated', { reason: req.body?.reason, confirmName: req.body?.confirmName })));

// ---- users (credentials are never selected or returned)
ownerRouter.get('/users', route((req) => owner.listUsers({ search: q(req, 'search'), organizationId: q(req, 'orgId'), active: q(req, 'active'), limit: q(req, 'limit'), offset: q(req, 'offset') })));
ownerRouter.get('/users/:id', route((req) => owner.getUser(req.params.id)));
ownerRouter.post('/users/:id/activate', route((req) => owner.setUserActive(actorOf(req), req.params.id, true)));
ownerRouter.post('/users/:id/deactivate', route((req) => owner.setUserActive(actorOf(req), req.params.id, false)));
ownerRouter.put('/users/:id/role', route((req) => owner.setUserRole(actorOf(req), req.params.id, req.body?.role)));
ownerRouter.post('/users/:id/remove-membership', route((req) => owner.removeUserMembership(actorOf(req), req.params.id)));

// ---- support access (explicit, time-boxed, audited; never silent impersonation)
ownerRouter.post('/support/start', route(async (req, res) => { const s = await owner.startSupportSession(actorOf(req), req.body ?? {}); res.status(201); return s; }));
ownerRouter.post('/support/end', route((req) => owner.endSupportSession(actorOf(req))));
ownerRouter.get('/support/:organizationId/summary', route((req) => owner.getSupportSummary(actorOf(req), req.params.organizationId)));

// Unknown owner routes: 404 only after authorization succeeded.
ownerRouter.use((_req, res) => res.status(404).json({ error: 'Not found' }));
