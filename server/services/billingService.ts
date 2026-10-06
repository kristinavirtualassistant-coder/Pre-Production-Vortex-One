import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';

type PlanName = 'free' | 'starter' | 'professional' | 'enterprise';

const PLAN_PRICES: Record<Exclude<PlanName, 'free'>, string | undefined> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

const PLAN_LIMITS: Record<PlanName, Record<string, number>> = {
  free: { users: 5, calls_month: 250, emails_month: 500, sms_month: 100, ai_actions_month: 250, properties: 10000 },
  starter: { users: 10, calls_month: 2000, emails_month: 5000, sms_month: 1000, ai_actions_month: 2500, properties: 50000 },
  professional: { users: 50, calls_month: 10000, emails_month: 25000, sms_month: 5000, ai_actions_month: 10000, properties: 250000 },
  enterprise: { users: 1000000, calls_month: 1000000, emails_month: 1000000, sms_month: 1000000, ai_actions_month: 1000000, properties: 100000000 },
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

export async function handleStripeEvent(pool: Pool, event: any) {
  const object = event?.data?.object || {};
  const metadata = object.metadata || {};
  const organizationId = metadata.organization_id || metadata.organizationId;
  if (!organizationId) return { ignored: true, reason: 'missing organization metadata' };

  const subscription = event.type.startsWith('customer.subscription.') ? object : null;
  if (subscription) {
    const plan = metadata.plan || subscription.items?.data?.[0]?.price?.metadata?.plan || 'free';
    const status = subscription.status || 'active';
    await pool.query(
      `UPDATE organization_billing
       SET plan=$1,subscription_status=$2,billing_customer_id=$3,billing_subscription_id=$4,
           current_period_start=to_timestamp($5),current_period_end=to_timestamp($6),
           cancel_at_period_end=$7,limits=$8::jsonb,updated_at=CURRENT_TIMESTAMP
       WHERE organization_id=$9`,
      [plan,status,subscription.customer || null,subscription.id || null,
       Number(subscription.current_period_start || 0),Number(subscription.current_period_end || 0),
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
  const limits = billing?.limits || planLimits(billing?.plan || 'free');
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
