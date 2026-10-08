/**
 * Machine-authenticated endpoints: they have no user session and no role. Each is authenticated ONLY by its own
 * mechanism (Stripe signature over the raw body, shared scheduler secret, telephony provider token) and must never sit
 * behind requireAuth/requireRole. Extracted from server.ts; registration order is preserved by the caller.
 */
import express from 'express';
import { getPgPool } from '../db/db';
import { verifyStripeWebhook, processStripeWebhookEvent } from '../services/billingService';
import { requireSchedulerSecret } from '../middleware/schedulerAuth';
import { runWorkflowSchedulerOnce as runWorkflowScheduler } from '../workers/workflowWorker';
import { safeErrorMessage } from '../security/logger';
import * as limits from '../middleware/limits';
import { WebhookHandler, verifyRingCentralWebhook, handleRingCentralValidation } from '../dialer/webhookHandler';
import { requireOrganizationId } from '../services/organizationContext';

/** Stripe: registered BEFORE the JSON body parser so the raw bytes used for the signature are intact. */
export function registerStripeWebhook(app: express.Express): void {
  // Stripe webhook: authenticated ONLY by the Stripe signature over the exact raw request bytes. It has no
  // user session and no role, so it must never sit behind requireAuth/requireRole. Registered before the
  // JSON body parser so the raw bytes are intact.
  app.post('/api/billing/webhook', limits.webhookIngressLimiter(), express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!secret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured; rejecting Stripe webhook');
      return res.status(503).json({ error: 'Stripe webhook is not configured' });
    }
    const signature = req.header('stripe-signature') || '';
    if (!signature || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'Missing Stripe signature or raw body' });
    }
    let signatureValid = false;
    try {
      signatureValid = verifyStripeWebhook(req.body, signature, secret);
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) {
      return res.status(400).json({ error: 'Invalid Stripe webhook signature' });
    }
    try {
      const event = JSON.parse(req.body.toString('utf8'));
      if (!event?.id || typeof event.id !== 'string' || typeof event.type !== 'string') {
        return res.status(400).json({ error: 'Invalid Stripe event' });
      }
      const pool = getPgPool();
      if (!pool) return res.status(503).json({ error: 'Database unavailable' });
      const outcome = await processStripeWebhookEvent(pool, event);
      return res.json({ received: true, processed: outcome.processed });
    } catch (error: any) {
      console.error('Stripe webhook processing failed:', error);
      return res.status(500).json({ error: 'Stripe webhook processing failed' });
    }
  });
}

/** Scheduler trigger (alternative to the worker process). */
export function registerSchedulerTrigger(app: express.Express): void {
  // Scheduler trigger: machine-to-machine, authenticated ONLY by SCHEDULER_TRIGGER_SECRET (no session/role).
  app.post('/internal/scheduler/workflows', requireSchedulerSecret, async (req, res) => {
    try {
      res.json(await runWorkflowScheduler());
    } catch (err: any) {
      console.error('Workflow scheduler failed:', err);
      res.status(500).json({ error: safeErrorMessage(err, 'Workflow scheduler failed') });
    }
  });
}

/** Telephony provider webhooks (RingCentral). */
export function registerTelephonyWebhook(app: express.Express): void {
  // Telephony Webhook Ingestion & Idempotency API (RingCentral)
  // Authenticated ONLY by the provider's validation token / signature below (no session or role).
  app.post('/api/telephony/webhook/:provider', async (req, res) => {
    if (req.params.provider !== 'ringcentral') return res.status(404).json({ error: 'Unsupported telephony provider' });

    // RingCentral sends a validation request when a subscription is created. It has no
    // organization/event payload, so handle it before tenant extraction.
    const validationToken = String(req.headers['validation-token'] || '').trim();
    if (validationToken) {
      const validation = handleRingCentralValidation(req.headers);
      if (!validation) return res.status(401).json({ error: 'Invalid RingCentral validation token' });
      res.status(validation.statusCode);
      Object.entries(validation.headers).forEach(([key, value]) => res.setHeader(key, value));
      return res.end(validation.body);
    }

    if (!verifyRingCentralWebhook(req.headers)) {
      return res.status(401).json({ error: 'Invalid RingCentral webhook authentication' });
    }

    try {
      const pool = getPgPool();
      if (!pool) return res.status(503).json({ error: 'PostgreSQL is required for webhook tenant resolution' });

      const body = req.body?.body || req.body;
      const telephonyCallId = String(
        body?.telephonyCallId || body?.callId || body?.sessionId ||
        req.body?.telephonyCallId || req.body?.callId || req.body?.sessionId || ''
      ).trim();
      if (!telephonyCallId) return res.status(400).json({ error: 'Provider call identity is required' });

      const tenantLookup = await pool.query(
        "SELECT DISTINCT organization_id FROM call WHERE telephony_session_id = $1 OR telephony_call_id = $1 LIMIT 2",
        [telephonyCallId],
      );
      if (!tenantLookup.rowCount) return res.status(404).json({ error: 'Call identity is not registered' });
      if (tenantLookup.rowCount > 1) return res.status(409).json({ error: 'Provider call identity is ambiguous across organizations' });

      const orgId = requireOrganizationId(tenantLookup.rows[0].organization_id);
      const result = await WebhookHandler.processWebhook('ringcentral', orgId, req.body, req.headers);
      if (result.status === 'error') return res.status(400).json(result);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error('Telephony Webhook error:', err);
      return res.status(400).json({ error: err.message });
    }
  });
}
