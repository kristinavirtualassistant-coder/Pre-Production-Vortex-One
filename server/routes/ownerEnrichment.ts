import { Router } from 'express';
import { type AuthRequest, requireRole } from '../middleware/auth';
import { requireOrganizationId } from '../services/organizationContext';
import { OwnerEnrichmentService } from '../services/ownerEnrichmentService';

export function createOwnerEnrichmentRouter(): Router {
  const router = Router();

  router.get('/', async (req: AuthRequest, res) => {
    try {
      const org = requireOrganizationId(req.dbUser?.organization_id);
      const pool = (await import('../db/db')).getPgPool();
      if (!pool) return res.status(503).json({ error: 'Database unavailable' });
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
      const values: unknown[] = [org];
      const where = ['o.organization_id=$1'];
      if (q) {
        values.push(`%${q}%`);
        where.push(`(o.name ILIKE $2 OR o.mailing_address ILIKE $2)`);
      }
      values.push(limit);
      const result = await pool.query(
        `SELECT o.*, COUNT(p.id)::int AS linked_property_count
           FROM property_owners o
           LEFT JOIN properties p ON p.owner_id=o.id AND p.organization_id=o.organization_id
          WHERE ${where.join(' AND ')}
          GROUP BY o.id
          ORDER BY o.updated_at DESC NULLS LAST
          LIMIT $${values.length}`,
        values,
      );
      return res.json({ owners: result.rows, count: result.rows.length });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Unable to list owners' });
    }
  });

  router.get('/providers', async (req: AuthRequest, res) => {
    try {
      const org = requireOrganizationId(req.dbUser?.organization_id);
      return res.json({ providers: await OwnerEnrichmentService.listProviders(org) });
    } catch (error: any) {
      return res.status(503).json({ error: error?.message || 'Unable to list enrichment providers' });
    }
  });

  router.get('/:id', async (req: AuthRequest, res) => {
    try {
      const org = requireOrganizationId(req.dbUser?.organization_id);
      const profile = await OwnerEnrichmentService.getOwnerProfile(org, String(req.params.id));
      return res.json(profile);
    } catch (error: any) {
      return res.status(404).json({ error: error?.message || 'Owner not found' });
    }
  });

  router.post('/:id/enrich', requireRole(['admin', 'executive', 'manager', 'agent']), async (req: AuthRequest, res) => {
    try {
      const org = requireOrganizationId(req.dbUser?.organization_id);
      const result = await OwnerEnrichmentService.enrichOwner({
        organizationId: org,
        ownerId: String(req.params.id),
        propertyId: req.body?.propertyId,
        provider: req.body?.provider || 'public_records',
        capabilities: req.body?.capabilities,
        supplied: req.body?.supplied,
      });
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Owner enrichment failed' });
    }
  });

  router.get('/:id/enrichment-jobs/:jobId', async (req: AuthRequest, res) => {
    try {
      const org = requireOrganizationId(req.dbUser?.organization_id);
      const job = await OwnerEnrichmentService.getJob(org, String(req.params.jobId));
      if (!job) return res.status(404).json({ error: 'Enrichment job not found' });
      return res.json({ job });
    } catch (error: any) {
      return res.status(400).json({ error: error?.message || 'Unable to retrieve enrichment job' });
    }
  });

  return router;
}
