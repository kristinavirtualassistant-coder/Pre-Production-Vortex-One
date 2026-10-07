import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { getPgPool } from '../db/db';
import { requireOrganizationId } from '../services/organizationContext';
import type { AuthRequest } from '../middleware/auth';

const STATUSES = new Set(['scheduled','confirmed','completed','cancelled','no_show']);
export const appointmentsRouter = Router();

function tenant(req: AuthRequest) {
  return requireOrganizationId(req.dbUser?.organization_id);
}

appointmentsRouter.get('/', async (req, res) => {
  try {
    const organizationId = tenant(req as AuthRequest);
    const pool = getPgPool();
    if (!pool) return res.status(503).json({ error: 'Appointments require PostgreSQL' });
    const params: any[] = [organizationId];
    const where = ['organization_id=$1'];
    if (typeof req.query.leadId === 'string') { params.push(req.query.leadId); where.push('lead_id=$' + params.length); }
    if (typeof req.query.status === 'string' && STATUSES.has(req.query.status)) { params.push(req.query.status); where.push('status=$' + params.length); }
    params.push(Math.min(Math.max(Number(req.query.limit || 100), 1), 250));
    const result = await pool.query('SELECT * FROM appointments WHERE ' + where.join(' AND ') + ' ORDER BY scheduled_at ASC LIMIT $' + params.length, params);
    res.json({ appointments: result.rows });
  } catch (error: any) { res.status(400).json({ error: error?.message || 'Failed to list appointments' }); }
});

appointmentsRouter.post('/', async (req, res) => {
  try {
    const organizationId = tenant(req as AuthRequest);
    const pool = getPgPool();
    if (!pool) return res.status(503).json({ error: 'Appointments require PostgreSQL' });
    const { leadId, campaignId, assignedUserId, scheduledAt, status = 'scheduled', outcome, notes } = req.body || {};
    if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) return res.status(400).json({ error: 'scheduledAt is required and must be a valid date' });
    if (!STATUSES.has(status)) return res.status(400).json({ error: 'Invalid appointment status' });

    if (leadId) {
      const check = await pool.query('SELECT 1 FROM leads WHERE id=$1 AND organization_id=$2', [leadId, organizationId]);
      if (!check.rowCount) return res.status(400).json({ error: 'Lead does not belong to this organization' });
    }
    if (campaignId) {
      const check = await pool.query('SELECT 1 FROM campaign WHERE id=$1 AND organization_id=$2', [campaignId, organizationId]);
      if (!check.rowCount) return res.status(400).json({ error: 'Campaign does not belong to this organization' });
    }
    if (assignedUserId) {
      const check = await pool.query('SELECT 1 FROM users WHERE id=$1 AND organization_id=$2', [assignedUserId, organizationId]);
      if (!check.rowCount) return res.status(400).json({ error: 'Assigned user does not belong to this organization' });
    }

    const result = await pool.query(
      'INSERT INTO appointments (id,organization_id,lead_id,campaign_id,assigned_user_id,scheduled_at,status,outcome,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      ['appt_' + randomUUID(),organizationId,leadId || null,campaignId || null,assignedUserId || null,new Date(scheduledAt).toISOString(),status,outcome || null,notes || null],
    );
    res.status(201).json({ appointment: result.rows[0] });
  } catch (error: any) { res.status(400).json({ error: error?.message || 'Failed to create appointment' }); }
});

appointmentsRouter.patch('/:id', async (req, res) => {
  try {
    const organizationId = tenant(req as AuthRequest);
    const pool = getPgPool();
    if (!pool) return res.status(503).json({ error: 'Appointments require PostgreSQL' });
    const updates: string[] = [];
    const params: any[] = [];
    const body = req.body || {};

    if (body.scheduledAt !== undefined) {
      if (Number.isNaN(new Date(body.scheduledAt).getTime())) return res.status(400).json({ error: 'Invalid scheduledAt' });
      params.push(new Date(body.scheduledAt).toISOString()); updates.push('scheduled_at=$' + params.length);
    }
    if (body.status !== undefined) {
      if (!STATUSES.has(body.status)) return res.status(400).json({ error: 'Invalid appointment status' });
      params.push(body.status); updates.push('status=$' + params.length);
    }
    if (body.outcome !== undefined) { params.push(body.outcome || null); updates.push('outcome=$' + params.length); }
    if (body.notes !== undefined) { params.push(body.notes || null); updates.push('notes=$' + params.length); }
    if (body.assignedUserId !== undefined) {
      if (body.assignedUserId) {
        const check = await pool.query('SELECT 1 FROM users WHERE id=$1 AND organization_id=$2', [body.assignedUserId, organizationId]);
        if (!check.rowCount) return res.status(400).json({ error: 'Assigned user does not belong to this organization' });
      }
      params.push(body.assignedUserId || null); updates.push('assigned_user_id=$' + params.length);
    }
    if (!updates.length) return res.status(400).json({ error: 'No appointment fields supplied' });

    params.push(req.params.id, organizationId);
    const result = await pool.query(
      'UPDATE appointments SET ' + updates.join(',') + ',updated_at=CURRENT_TIMESTAMP WHERE id=$' + (params.length - 1) + ' AND organization_id=$' + params.length + ' RETURNING *',
      params,
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ appointment: result.rows[0] });
  } catch (error: any) { res.status(400).json({ error: error?.message || 'Failed to update appointment' }); }
});
