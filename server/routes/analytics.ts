import { Router } from 'express';
import { getPgPool } from '../db/db';
import { requireOrganizationId } from '../services/organizationContext';
import { getAnalytics, recordValueEvent } from '../services/analyticsService';
import { requireRole } from '../middleware/auth';
import { randomUUID } from 'node:crypto';
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

analyticsRouter.post('/value-events', requireRole(['admin','executive','manager']), async (req, res) => {
  try {
    const auth = req as AuthRequest;
    const organizationId = requireOrganizationId(auth.dbUser?.organization_id);
    const pool = getPgPool();
    if (!pool) return res.status(503).json({ error: 'Reporting analytics require PostgreSQL' });
    const { eventType, amountUsd, leadId, propertyId, campaignId, metadata, occurredAt } = req.body || {};
    if (!['revenue','acquisition_value','management_value','other'].includes(eventType)) return res.status(400).json({ error: 'Invalid value event type' });
    const amount = Number(amountUsd);
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'amountUsd must be a non-negative number' });
    if (leadId) { const q = await pool.query('SELECT 1 FROM leads WHERE id=$1 AND organization_id=$2', [leadId, organizationId]); if (!q.rowCount) return res.status(400).json({ error: 'Lead does not belong to this organization' }); }
    if (propertyId) { const q = await pool.query('SELECT 1 FROM properties WHERE id=$1 AND organization_id=$2', [propertyId, organizationId]); if (!q.rowCount) return res.status(400).json({ error: 'Property does not belong to this organization' }); }
    if (campaignId) { const q = await pool.query('SELECT 1 FROM campaign WHERE id=$1 AND organization_id=$2', [campaignId, organizationId]); if (!q.rowCount) return res.status(400).json({ error: 'Campaign does not belong to this organization' }); }
    const id = 'value_' + randomUUID();
    await recordValueEvent(pool, { organizationId, id, eventType, amountUsd: amount, leadId, propertyId, campaignId, metadata: { ...(metadata || {}), recordedBy: auth.dbUser?.id || null }, occurredAt });
    res.status(201).json({ id, eventType, amountUsd: amount });
  } catch (error: any) {
    console.error('Analytics value event error:', error);
    res.status(400).json({ error: error?.message || 'Failed to record analytics value event' });
  }
});
