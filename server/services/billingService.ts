import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';

type PlanName = 'free' | 'starter' | 'professional' | 'enterprise';

const PLAN_PRICES: Record<Exclude<PlanName, 'free'>, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

const PLAN_LIMITS: Record<PlanName, Record<string, number>> = {
  free: { users: 5, calls_month: 250, emails_month: 500, sms_month: 100, ai_actions_month: 250, enrichment_credits_month: 25, property_searches_month: 100, storage_mb: 500 },
  starter: { users: 10, calls_month: 2000, emails_month: 5000, sms_month: 1000, ai_actions_month: 2500, enrichment_credits_month: 500, property_searches_month: 2000, storage_mb: 5000 },
  professional: { users: 50, calls_month: 10000, emails_month: 25000, sms_month: 5000, ai_actions_month: 10000, enrichment_credits_month: 5000, property_searches_month: 10000, storage_mb: 50000 },
  enterprise: { users: 1000000, calls_month: 1000000, emails_month: 1000000, sms_month: 1000000, ai_actions_month: 1000000, enrichment_credits_month: 1000000, property_searches_month: 1000000, storage_mb: 1000000 },
};

function stripeSecret(): string {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  if (!value) throw new Error('STRIPE_SECRET_KEY is not configured');
  return value;
}

function appUrl(): string {
  return (process.env.APP_URL || process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
}

async function stripeRequest(path: string, method: string, params: Record<string, string> = {}) {
  const body = new URLSearchParams(params);
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${stripeSecret()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body.toString(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Stripe request failed (${response.status})`);
  return data;
}

export const PLAN_CATALOG = Object.freeze({
  free: { name: 'Free', priceCents: 0, trialDays: 0, limits: PLAN_LIMITS.free },
  starter: { name: 'Starter', priceCents: 4900, trialDays: 14, limits: PLAN_LIMITS.starter },
  professional: { name: 'Professional', priceCents: 14900, trialDays: 14, limits: PLAN_LIMITS.professional },
  enterprise: { name: 'Enterprise', priceCents: 49900, trialDays: 14, limits: PLAN_LIMITS.enterprise },
});

export function planLimits(plan: string): Record<string, number> {
  return PLAN_LIMITS[(plan as PlanName)] || PLAN_LIMITS.free;
}

export async function getOrganizationBilling(pool: Pool, organizationId: string) {
  const result = await pool.query(
    `SELECT organization_id,plan,subscription_status,billing_customer_id,billing_subscription_id,
      trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,limits
     FROM organization_billing WHERE organization_id=$1`,
    [organizationId],
  );
  return result.rows[0] || null;
}

export async function createCheckoutSession(pool: Pool, organizationId: string, plan: Exclude<PlanName, 'free'>, email?: string) {
  const price = PLAN_PRICES[plan];
  if (!price) throw new Error(`STRIPE_PRICE_${plan.toUpperCase()} is not configured`);
  const billing = await getOrganizationBilling(pool, organizationId);
  let customerId = billing?.billing_customer_id;
  if (!customerId) {
    const customer = await stripeRequest('customers', 'POST', {
      email: email || '',
      'metadata[organization_id]': organizationId,
    });
    customerId = customer.id;
    await pool.query('UPDATE organization_billing SET billing_customer_id=$1,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$2',[customerId,organizationId]);
  }
  const base = appUrl();
  if (!base) throw new Error('APP_URL is not configured');
  const session = await stripeRequest('checkout/sessions', 'POST', {
    mode: 'subscription',
    customer: customerId,
    'line_items[0][price]': price,
    'line_items[0][quantity]': '1',
    success_url: `${base}/settings?billing=success`,
    cancel_url: `${base}/settings?billing=cancelled`,
    'subscription_data[metadata][organization_id]': organizationId,
    'subscription_data[metadata][plan]': plan,
    'subscription_data[trial_period_days]': String(PLAN_CATALOG[plan].trialDays),
    'metadata[organization_id]': organizationId,
    'metadata[plan]': plan,
  });
  return { id: session.id, url: session.url };
}

export async function createPortalSession(pool: Pool, organizationId: string) {
  const billing = await getOrganizationBilling(pool, organizationId);
  if (!billing?.billing_customer_id) throw new Error('No Stripe customer exists for this organization');
  const base = appUrl();
  if (!base) throw new Error('APP_URL is not configured');
  const session = await stripeRequest('billing_portal/sessions', 'POST', {
    customer: billing.billing_customer_id,
    return_url: `${base}/settings`,
  });
  return { url: session.url };
}

function parseStripeSignature(header: string): { timestamp: number; signatures: string[] } {
  const parts = header.split(',').map(v => v.trim());
  const timestamp = Number(parts.find(v => v.startsWith('t='))?.slice(2));
  const signatures = parts.filter(v => v.startsWith('v1=')).map(v => v.slice(3));
  if (!Number.isFinite(timestamp) || !signatures.length) throw new Error('Invalid Stripe signature');
  return { timestamp, signatures };
}

export function verifyStripeWebhook(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  const parsed = parseStripeSignature(signatureHeader);
  if (Math.abs(Date.now() / 1000 - parsed.timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${parsed.timestamp}.${rawBody.toString('utf8')}`).digest('hex');
  return parsed.signatures.some(signature => {
    try { return timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
  });
}

export async function listBillingInvoices(pool: Pool, organizationId: string, limit = 50) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 50, 1), 100);
  const result = await pool.query(
    `SELECT id,stripe_invoice_id,status,currency,amount_due,amount_paid,amount_remaining,
            hosted_invoice_url,invoice_pdf,period_start,period_end,due_date,paid_at,created_at
       FROM billing_invoices WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [organizationId, safeLimit],
  );
  return result.rows;
}

async function upsertBillingInvoice(pool: Pool, organizationId: string, invoice: any) {
  const periodStart = invoice.period_start ? new Date(Number(invoice.period_start) * 1000).toISOString() : null;
  const periodEnd = invoice.period_end ? new Date(Number(invoice.period_end) * 1000).toISOString() : null;
  const dueDate = invoice.due_date ? new Date(Number(invoice.due_date) * 1000).toISOString() : null;
  const paidAt = invoice.status_transitions?.paid_at ? new Date(Number(invoice.status_transitions.paid_at) * 1000).toISOString() : null;
  await pool.query(
    `INSERT INTO billing_invoices(id,organization_id,stripe_invoice_id,stripe_customer_id,stripe_subscription_id,status,collection_method,currency,amount_due,amount_paid,amount_remaining,hosted_invoice_url,invoice_pdf,period_start,period_end,due_date,paid_at,metadata)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb)
     ON CONFLICT(stripe_invoice_id) DO UPDATE SET status=EXCLUDED.status,collection_method=EXCLUDED.collection_method,currency=EXCLUDED.currency,amount_due=EXCLUDED.amount_due,amount_paid=EXCLUDED.amount_paid,amount_remaining=EXCLUDED.amount_remaining,hosted_invoice_url=EXCLUDED.hosted_invoice_url,invoice_pdf=EXCLUDED.invoice_pdf,period_start=EXCLUDED.period_start,period_end=EXCLUDED.period_end,due_date=EXCLUDED.due_date,paid_at=EXCLUDED.paid_at,metadata=EXCLUDED.metadata,updated_at=CURRENT_TIMESTAMP`,
    ['inv_' + invoice.id, organizationId, invoice.id, invoice.customer || null, invoice.subscription || null, invoice.status || null, invoice.collection_method || null, invoice.currency || null,
     Number.isFinite(Number(invoice.amount_due)) ? Number(invoice.amount_due) : null, Number.isFinite(Number(invoice.amount_paid)) ? Number(invoice.amount_paid) : null, Number.isFinite(Number(invoice.amount_remaining)) ? Number(invoice.amount_remaining) : null,
     invoice.hosted_invoice_url || null, invoice.invoice_pdf || null, periodStart, periodEnd, dueDate, paidAt, JSON.stringify(invoice.metadata || {})],
  );
}
export async function handleStripeEvent(pool: Pool, event: any) {
  const object = event?.data?.object || {};
  const metadata = object.metadata || {};
  const organizationId = metadata.organization_id || metadata.organizationId;

  const subscription = event.type.startsWith('customer.subscription.') ? object : null;

  if (event.type.startsWith('invoice.')) {
    let orgId = organizationId;
    if (!orgId && object.customer) {
      const customerResult = await pool.query('SELECT organization_id FROM organization_billing WHERE billing_customer_id=$1 LIMIT 1', [object.customer]);
      orgId = customerResult.rows[0]?.organization_id;
    }
    if (orgId && object.id) {
      await upsertBillingInvoice(pool, orgId, object);
      return { updated: true, organizationId: orgId, invoiceId: object.id };
    }
    return { ignored: true, reason: 'invoice missing organization mapping' };
  }

  if (!organizationId) return { ignored: true, reason: 'missing organization metadata' };

  if (subscription) {
    const plan = metadata.plan || subscription.items?.data?.[0]?.price?.metadata?.plan || 'free';
    const status = subscription.status || 'active';
    await pool.query(
      `UPDATE organization_billing
       SET plan=$1,subscription_status=$2,billing_customer_id=$3,billing_subscription_id=$4,
           trial_ends_at=CASE WHEN $5 > 0 THEN to_timestamp($5) ELSE NULL END,current_period_start=to_timestamp($6),current_period_end=to_timestamp($7),
           cancel_at_period_end=$8,limits=$9::jsonb,updated_at=CURRENT_TIMESTAMP
       WHERE organization_id=$10`,
      [plan,status,subscription.customer || null,subscription.id || null,
       Number(subscription.trial_end || 0),Number(subscription.current_period_start || 0),Number(subscription.current_period_end || 0),
       Boolean(subscription.cancel_at_period_end),JSON.stringify(planLimits(plan)),organizationId],
    );
    return { updated: true, organizationId, plan, status };
  }

  if (event.type === 'checkout.session.completed') {
    const customerId = object.customer;
    const subscriptionId = object.subscription;
    const plan = metadata.plan || 'free';
    await pool.query(
      `UPDATE organization_billing SET plan=$1,subscription_status='active',billing_customer_id=$2,billing_subscription_id=$3,limits=$4::jsonb,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$5`,
      [plan,customerId,subscriptionId,JSON.stringify(planLimits(plan)),organizationId],
    );
    return { updated: true, organizationId, plan };
  }

  return { ignored: true, reason: event.type };
}

export async function recordUsage(pool: Pool, organizationId: string, metric: string, increment = 1) {
  return enforceUsageLimit(pool, organizationId, metric, increment);
}

export async function enforceUsageLimit(pool: Pool, organizationId: string, metric: string, increment = 1) {
  const billing = await getOrganizationBilling(pool, organizationId);
  const plan = (billing?.plan || 'free') as PlanName;
  const status = String(billing?.subscription_status || 'active');
  const paidPlan = plan !== 'free';
  if (paidPlan && !['active', 'trialing'].includes(status)) {
    const error: any = new Error('Subscription is not active');
    error.statusCode = 402;
    error.code = 'SUBSCRIPTION_INACTIVE';
    error.subscriptionStatus = status;
    throw error;
  }
  const limits = billing?.limits || planLimits(plan);
  const limit = Number(limits[metric] ?? Number.MAX_SAFE_INTEGER);
  if (!Number.isFinite(increment) || increment <= 0) throw new Error('Usage increment must be positive');
  const period = new Date();
  period.setUTCDate(1);
  const periodStart = period.toISOString().slice(0,10);
  const result = await pool.query(
    `INSERT INTO organization_usage(organization_id,period_start,metric,used)
     VALUES($1,$2,$3,$4)
     ON CONFLICT(organization_id,period_start,metric)
     DO UPDATE SET used=organization_usage.used+$4,updated_at=CURRENT_TIMESTAMP
     RETURNING used`,
    [organizationId,periodStart,metric,increment],
  );
  const used = Number(result.rows[0].used);
  if (used > limit) {
    await pool.query('UPDATE organization_usage SET used=GREATEST(0,used-$4),updated_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND period_start=$2 AND metric=$3',[organizationId,periodStart,metric,increment]);
    const error: any = new Error(`Usage limit reached for ${metric}`);
    error.statusCode = 402;
    error.code = 'USAGE_LIMIT_REACHED';
    error.metric = metric;
    error.limit = limit;
    error.used = used - increment;
    throw error;
  }
  return { used, limit };
}

export async function getUsageSummary(pool: Pool, organizationId: string) {
  const billing = await getOrganizationBilling(pool, organizationId);
  const period = new Date(); period.setUTCDate(1);
  const periodStart = period.toISOString().slice(0, 10);
  const result = await pool.query('SELECT metric, used FROM organization_usage WHERE organization_id=$1 AND period_start=$2 ORDER BY metric',[organizationId,periodStart]);
  const limits = billing?.limits || planLimits(billing?.plan || 'free');
  const usage: Record<string, {used:number;limit:number;remaining:number}> = {};
  for (const [metric, value] of Object.entries(limits)) { const used=Number(result.rows.find((row:any)=>row.metric===metric)?.used||0); const limit=Number(value); usage[metric]={used,limit,remaining:Math.max(0,limit-used)}; }
  return {period_start:periodStart,plan:billing?.plan||'free',subscription_status:billing?.subscription_status||'active',usage};
}

export async function cancelSubscription(pool: Pool, organizationId: string) {
  const billing=await getOrganizationBilling(pool,organizationId);
  if (!billing?.billing_subscription_id) throw new Error('No active Stripe subscription exists for this organization');
  const subscription=await stripeRequest(`subscriptions/${encodeURIComponent(billing.billing_subscription_id)}`,'POST',{cancel_at_period_end:'true'});
  await pool.query('UPDATE organization_billing SET cancel_at_period_end=true,updated_at=CURRENT_TIMESTAMP WHERE organization_id=$1',[organizationId]);
  return {cancel_at_period_end:true,current_period_end:subscription.current_period_end?new Date(subscription.current_period_end*1000).toISOString():billing.current_period_end};
}
