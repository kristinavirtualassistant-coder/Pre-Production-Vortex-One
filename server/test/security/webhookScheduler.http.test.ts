/**
 * Real-HTTP security tests for machine-authenticated routes: Stripe webhook, scheduler trigger and the
 * telephony provider webhook. These routes have no user session and no role; each is authenticated only by
 * its own secret/signature, and an authenticated tenant admin must NOT be able to substitute for that.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestTenant, cleanupTestTenants, requirePool, startTestApp, stripeSignature } from './httpHarness';

const WEBHOOK_SECRET = 'whsec_test_secret_for_security_suite';
const SCHEDULER_SECRET = 'scheduler-secret-for-security-suite';
process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.RINGCENTRAL_WEBHOOK_VALIDATION_TOKEN = 'rc-validation-token-for-security-suite';

const app = await startTestApp();
const pool = requirePool();
const tenantA = await createTestTenant(app, 'stripea');
const tenantB = await createTestTenant(app, 'stripeb');
const customerA = `cus_a_${randomUUID().slice(0, 8)}`;
const customerB = `cus_b_${randomUUID().slice(0, 8)}`;
const createdEvents: string[] = [];

function pass(name: string) { console.log(`  ✓ PASS: ${name}`); }

async function billing(organizationId: string) {
  return (await pool.query('SELECT plan,subscription_status,billing_customer_id FROM organization_billing WHERE organization_id=$1', [organizationId])).rows[0];
}
async function postStripe(event: unknown, options: { signature?: string | null; secret?: string; timestamp?: number } = {}) {
  const raw = JSON.stringify(event);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const signature = options.signature === undefined
    ? stripeSignature(raw, options.secret ?? WEBHOOK_SECRET, options.timestamp)
    : options.signature;
  if (signature) headers['stripe-signature'] = signature;
  return fetch(`${app.baseUrl}/api/billing/webhook`, { method: 'POST', headers, body: raw });
}
function subscriptionEvent(customer: string, overrides: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) {
  const id = `evt_${randomUUID()}`;
  createdEvents.push(id);
  return {
    id,
    type: 'customer.subscription.updated',
    data: { object: { id: `sub_${randomUUID().slice(0, 8)}`, customer, status: 'active', metadata: { plan: 'starter', ...metadata },
      current_period_start: 1_700_000_000, current_period_end: 1_702_592_000, trial_end: 0, cancel_at_period_end: false, ...overrides } },
  };
}

try {
  await pool.query(
    `INSERT INTO organization_billing (organization_id,plan,subscription_status,billing_customer_id,limits)
     VALUES ($1,'free','active',$2,'{}'::jsonb),($3,'free','active',$4,'{}'::jsonb)
     ON CONFLICT (organization_id) DO UPDATE SET billing_customer_id=EXCLUDED.billing_customer_id, plan='free'`,
    [tenantA.organizationId, customerA, tenantB.organizationId, customerB],
  );

  console.log('\n--- Security: Stripe webhook (signature-only authentication) ---');
  {
    const event = subscriptionEvent(customerA);
    let res = await postStripe(event, { signature: null });
    assert.equal(res.status, 400, 'missing Stripe-Signature must be rejected');
    pass('missing Stripe-Signature is rejected (400) before any processing');

    res = await postStripe(event, { signature: `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}` });
    assert.equal(res.status, 400);
    pass('invalid signature is rejected (400)');

    res = await postStripe(event, { secret: 'whsec_attacker_secret' });
    assert.equal(res.status, 400);
    pass('signature made with the wrong secret is rejected');

    res = await postStripe(event, { timestamp: Math.floor(Date.now() / 1000) - 3600 });
    assert.equal(res.status, 400);
    pass('replayed (stale-timestamp) signature is rejected');

    res = await fetch(`${app.baseUrl}/api/billing/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': 'garbage' }, body: '{}' });
    assert.equal(res.status, 400);
    pass('malformed Stripe-Signature header is rejected without a server error');

    assert.equal((await billing(tenantA.organizationId)).plan, 'free');
    assert.equal((await pool.query('SELECT 1 FROM stripe_webhook_events WHERE id=$1', [event.id])).rowCount, 0);
    pass('rejected requests changed no billing state and recorded no event');

    // A tenant admin session is NOT a substitute for the Stripe signature.
    res = await fetch(`${app.baseUrl}/api/billing/webhook`, { method: 'POST', headers: { 'content-type': 'application/json', ...tenantA.auth }, body: JSON.stringify(event) });
    assert.equal(res.status, 400);
    assert.equal((await billing(tenantA.organizationId)).plan, 'free');
    pass('an authenticated tenant admin cannot call the webhook without a valid signature');
  }
  {
    const event = subscriptionEvent(customerA);
    const res = await postStripe(event);
    assert.equal(res.status, 200, 'a correctly signed event is accepted (no session or role required)');
    assert.deepEqual(await res.json(), { received: true, processed: true });
    const after = await billing(tenantA.organizationId);
    assert.equal(after.plan, 'starter');
    pass('valid signature is processed without any user session/role');

    await pool.query("UPDATE organization_billing SET plan='free' WHERE organization_id=$1", [tenantA.organizationId]);
    const duplicate = await postStripe(event);
    assert.equal(duplicate.status, 200);
    assert.deepEqual(await duplicate.json(), { received: true, processed: false });
    assert.equal((await billing(tenantA.organizationId)).plan, 'free');
    pass('duplicate event id is acknowledged but NOT re-applied (idempotency)');
  }
  {
    // Organization identity comes from the Stripe customer mapping, never from webhook-supplied metadata.
    const forged = subscriptionEvent(customerA, {}, { organization_id: tenantB.organizationId, plan: 'enterprise' });
    const res = await postStripe(forged);
    assert.equal(res.status, 200);
    assert.equal((await billing(tenantB.organizationId)).plan, 'free');
    assert.equal((await billing(tenantA.organizationId)).plan, 'free');
    pass('event metadata naming another organization cannot upgrade that organization');

    const unmapped = subscriptionEvent(`cus_unknown_${randomUUID().slice(0, 8)}`, {}, { organization_id: tenantB.organizationId, plan: 'enterprise' });
    assert.equal((await postStripe(unmapped)).status, 200);
    assert.equal((await billing(tenantB.organizationId)).plan, 'free');
    pass('event for an unmapped Stripe customer is ignored even if metadata names a real organization');

    const unknownPlan = subscriptionEvent(customerA, {}, { plan: 'platinum-unlimited' });
    assert.equal((await postStripe(unknownPlan)).status, 200);
    assert.equal((await billing(tenantA.organizationId)).plan, 'free');
    pass('unknown plan names are ignored');
  }
  {
    // A processing failure must roll back the idempotency record so Stripe's retry is processed.
    const broken = subscriptionEvent(customerA, { current_period_start: 'not-a-number' });
    const res = await postStripe(broken);
    assert.equal(res.status, 500);
    assert.equal((await pool.query('SELECT 1 FROM stripe_webhook_events WHERE id=$1', [broken.id])).rowCount, 0);
    pass('processing failure returns 500 and leaves no idempotency record (retry will be processed)');
  }

  console.log('\n--- Security: scheduler trigger (secret-only authentication) ---');
  {
    delete process.env.SCHEDULER_TRIGGER_SECRET;
    let res = await fetch(`${app.baseUrl}/internal/scheduler/workflows`, { method: 'POST', headers: { 'x-vortex-scheduler-secret': SCHEDULER_SECRET } });
    assert.equal(res.status, 503, 'unconfigured scheduler secret must fail closed');
    pass('scheduler fails closed when SCHEDULER_TRIGGER_SECRET is not configured');

    process.env.SCHEDULER_TRIGGER_SECRET = SCHEDULER_SECRET;
    res = await fetch(`${app.baseUrl}/internal/scheduler/workflows`, { method: 'POST' });
    assert.equal(res.status, 401);
    pass('missing scheduler secret is rejected (401)');

    res = await fetch(`${app.baseUrl}/internal/scheduler/workflows`, { method: 'POST', headers: { 'x-vortex-scheduler-secret': 'wrong-secret' } });
    assert.equal(res.status, 401);
    pass('wrong scheduler secret is rejected (401)');

    res = await fetch(`${app.baseUrl}/internal/scheduler/workflows`, { method: 'POST', headers: { 'x-vortex-scheduler-secret': `${SCHEDULER_SECRET}x` } });
    assert.equal(res.status, 401);
    pass('near-miss scheduler secret is rejected (401)');

    res = await fetch(`${app.baseUrl}/internal/scheduler/workflows`, { method: 'POST', headers: { ...tenantA.auth } });
    assert.equal(res.status, 401);
    pass('a tenant admin session alone cannot execute scheduler jobs');

    res = await fetch(`${app.baseUrl}/internal/scheduler/workflows`, { method: 'POST', headers: { 'x-vortex-scheduler-secret': SCHEDULER_SECRET } });
    assert.equal(res.status, 200, `valid scheduler secret should run the scheduler (got ${res.status})`);
    pass('valid scheduler secret executes the scheduler without a user session');
  }

  console.log('\n--- Security: telephony webhook (provider-token-only authentication) ---');
  {
    let res = await fetch(`${app.baseUrl}/api/telephony/webhook/ringcentral`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ telephonyCallId: 'x' }) });
    assert.equal(res.status, 401);
    assert.match(String((await res.json() as any).error), /RingCentral webhook authentication/);
    pass('unauthenticated telephony webhook is rejected by provider authentication (not by a session check)');

    res = await fetch(`${app.baseUrl}/api/telephony/webhook/ringcentral`, { method: 'POST', headers: { 'validation-token': 'wrong' }, body: '{}' });
    assert.equal(res.status, 401);
    pass('wrong RingCentral validation token is rejected');

    res = await fetch(`${app.baseUrl}/api/telephony/webhook/ringcentral`, { method: 'POST', headers: { 'validation-token': process.env.RINGCENTRAL_WEBHOOK_VALIDATION_TOKEN! }, body: '{}' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('validation-token'), process.env.RINGCENTRAL_WEBHOOK_VALIDATION_TOKEN);
    pass('RingCentral subscription validation handshake works without a user session');
  }
} finally {
  for (const id of createdEvents) await pool.query('DELETE FROM stripe_webhook_events WHERE id=$1', [id]).catch(() => {});
  await pool.query('DELETE FROM organization_billing WHERE organization_id = ANY($1)', [[tenantA.organizationId, tenantB.organizationId]]).catch(() => {});
  await cleanupTestTenants(tenantA, tenantB);
  await app.close();
}
console.log('Webhook and scheduler HTTP security tests passed.');
