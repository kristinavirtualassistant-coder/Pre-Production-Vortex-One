import { Router } from 'express';
import { getPgPool } from '../db/db';
import { requireOrganizationId } from '../services/organizationContext';
import { getAnalytics } from '../services/analyticsService';
import type { AuthRequest } from '../middleware/auth';

export const analyticsRouter = Router();

analyticsRouter.get('/', async (req, res) => {
  try {
    const orgId = requireOrganizationId((req as AuthRequest).dbUser?.organization_id);
    const pool = getPgPool();
    if (!pool) return res.status(503).json({ error: 'Reporting analytics require PostgreSQL' });

    const result = await getAnalytics(pool, {
      organizationId: orgId,
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      campaignId: typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined,
      userId: typeof req.query.userId === 'string' ? req.query.userId : undefined,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Analytics query error:', error);
    res.status(400).json({ error: error?.message || 'Analytics query failed' });
  }
});
