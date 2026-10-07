import { Router } from 'express';
import type { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { requireOrganizationId } from '../services/organizationContext';
import { getPgPool } from '../db/db';
import {
  PLAN_CATALOG,
  getOrganizationBilling,
  getUsageSummary,
  createCheckoutSession,
  createPortalSession,
  cancelSubscription,
} from '../services/billingService';

const router = Router();

function organizationId(req: AuthRequest): string {
  return requireOrganizationId(req.dbUser?.organization_id);
}

function poolOr503(res: any) {
  const pool = getPgPool();
  if (!pool) {
    res.status(503).json({ error: 'PostgreSQL is required for billing' });
    return null;
  }
  return pool;
}

router.get('/plans', (_req, res) => {
  res.json(PLAN_CATALOG);
});

router.get('/', async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    const orgId = organizationId(req as AuthRequest);
    const billing = await getOrganizationBilling(pool, orgId);
    if (!billing) return res.status(404).json({ error: 'Billing account not found' });
    res.json({ ...billing, plans: PLAN_CATALOG });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load billing' });
  }
});

router.get('/usage', async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    res.json(await getUsageSummary(pool, organizationId(req as AuthRequest)));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load billing usage' });
  }
});

router.post('/checkout', requireRole(['admin', 'executive']), async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  const plan = String(req.body?.plan || '').toLowerCase();
  if (!['starter', 'professional', 'enterprise'].includes(plan)) {
    return res.status(400).json({ error: 'A paid plan is required' });
  }
  try {
    const result = await createCheckoutSession(
      pool,
      organizationId(req as AuthRequest),
      plan as 'starter' | 'professional' | 'enterprise',
      req.body?.email,
    );
    res.status(201).json(result);
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Unable to create checkout session' });
  }
});

router.post('/portal', requireRole(['admin', 'executive']), async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    res.json(await createPortalSession(pool, organizationId(req as AuthRequest)));
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Unable to create billing portal session' });
  }
});

router.post('/cancel', requireRole(['admin', 'executive']), async (req, res) => {
  const pool = poolOr503(res);
  if (!pool) return;
  try {
    res.json(await cancelSubscription(pool, organizationId(req as AuthRequest)));
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ error: error.message || 'Unable to cancel subscription' });
  }
});

export default router;
