import { Router } from 'express';
import { getPgPool } from '../db/db';
import type { AuthRequest } from '../middleware/auth';
import { requirePermission } from '../security/permissions';
import { safeErrorMessage } from '../security/logger';
import { externalWebhookService } from '../services/externalWebhookService';

/** External HTTP/HTTPS webhook endpoint management. Mounted at /api/webhooks behind requireAuth. */
export const webhookEndpointsRouter = Router();
const router = webhookEndpointsRouter;

router.get('/', requirePermission('webhooks:read'), async (req, res) => {
  try {
    const organizationId = (req as AuthRequest).dbUser!.organization_id;
    res.json(await externalWebhookService.listEndpoints(organizationId));
  } catch (err: any) {
    res.status(500).json({ error: safeErrorMessage(err, 'Failed to list webhook endpoints') });
  }
});

router.post('/', requirePermission('webhooks:manage'), async (req, res) => {
  try {
    const organizationId = (req as AuthRequest).dbUser!.organization_id;
    const endpoint = await externalWebhookService.createEndpoint({ ...req.body, organizationId });
    res.status(201).json(endpoint);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create webhook endpoint' });
  }
});

router.put('/:id', requirePermission('webhooks:manage'), async (req, res) => {
  try {
    const organizationId = (req as AuthRequest).dbUser!.organization_id;
    const updated = await externalWebhookService.updateEndpoint(organizationId, req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Webhook endpoint not found' });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update webhook endpoint' });
  }
});

router.delete('/:id', requirePermission('webhooks:manage'), async (req, res) => {
  try {
    const organizationId = (req as AuthRequest).dbUser!.organization_id;
    const deleted = await externalWebhookService.deleteEndpoint(organizationId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Webhook endpoint not found' });
    res.json({ success: true, deletedId: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: safeErrorMessage(err, 'Failed to delete webhook endpoint') });
  }
});

router.post('/:id/test', requirePermission('webhooks:test'), async (req, res) => {
  try {
    const organizationId = (req as AuthRequest).dbUser!.organization_id;
    const delivery = await externalWebhookService.testEndpointById(organizationId, req.params.id);
    if (!delivery) return res.status(404).json({ error: 'Webhook endpoint not found' });
    res.json(delivery);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Webhook test failed' });
  }
});

router.get('/:id/deliveries', requirePermission('webhooks:read'), async (req, res) => {
  try {
    const organizationId = (req as AuthRequest).dbUser!.organization_id;
    const limit = Math.max(1, Number(req.query.limit) || 50);
    const ownedEndpoint = await getPgPool()?.query('SELECT 1 FROM webhook_endpoints WHERE organization_id = $1 AND id = $2', [organizationId, req.params.id]);
    if (!ownedEndpoint?.rowCount) return res.status(404).json({ error: 'Webhook endpoint not found' });
    res.json(await externalWebhookService.listDeliveries(organizationId, req.params.id, limit));
  } catch (err: any) {
    res.status(500).json({ error: safeErrorMessage(err, 'Failed to list webhook deliveries') });
  }
});
