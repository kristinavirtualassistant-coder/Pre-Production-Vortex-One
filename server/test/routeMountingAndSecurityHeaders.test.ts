import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { analyticsRouter } from '../routes/analytics';
import { appointmentsRouter } from '../routes/appointments';
import { securityHeaders, ENFORCED_CSP } from '../middleware/securityHeaders';
import { clientErrorMessage, isConfigurationErrorMessage, isInternalError } from '../security/logger';

// 1. Source guard: a literal "\n" inside a // comment once swallowed `app.use('/api/analytics', ...)`, so the
//    analytics API was never registered. No line comment in server.ts may contain an escaped newline followed by code.
const serverSource = readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');
for (const [index, line] of serverSource.split('\n').entries()) {
  const comment = line.match(/^\s*\/\/(.*)$/)?.[1];
  if (comment) assert.ok(!/\\n.*\b(app|router)\.(use|get|post|put|patch|delete)\(/.test(comment), `server.ts:${index + 1} hides route registration inside a comment`);
}

// 2. Router stack: the analytics and appointments routers are really mounted behind requireAuth.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const { createApp } = await import('../../server');
const app = await createApp({ serveFrontend: false, backgroundTimers: false });
const stack: any[] = (app as any)._router.stack;
const mounted = (router: unknown, url: string) => stack.some((layer) => layer.handle === router && layer.regexp.test(url));
assert.ok(mounted(analyticsRouter, '/api/analytics'), 'analyticsRouter must be mounted at /api/analytics');
assert.ok(mounted(analyticsRouter, '/api/analytics/value-events'), 'analyticsRouter must serve /api/analytics/value-events');
assert.ok(mounted(appointmentsRouter, '/api/appointments'), 'appointmentsRouter must be mounted at /api/appointments');

// 3. Security headers on real HTTP responses (public health endpoint and an authenticated API path).
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
try {
  for (const url of ['/api/health', '/api/analytics']) {
    const res = await fetch(base + url);
    assert.equal(res.headers.get('content-security-policy'), ENFORCED_CSP, `${url} CSP`);
    assert.ok(res.headers.get('content-security-policy-report-only')?.includes("default-src 'self'"), `${url} report-only CSP`);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', `${url} nosniff`);
    assert.equal(res.headers.get('x-frame-options'), 'DENY', `${url} frame options`);
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', `${url} referrer policy`);
    assert.ok(res.headers.get('permissions-policy')?.includes('microphone=(self)'), `${url} keeps the dialer microphone`);
    assert.equal(res.headers.get('x-powered-by'), null, `${url} hides x-powered-by`);
    if (url === '/api/analytics') {
      // 401 with a database, 503 when auth cannot reach one; never 200 HTML from the SPA fallback.
      assert.ok([401, 503].includes(res.status), `unauthenticated analytics request rejected (got ${res.status})`);
      assert.match(res.headers.get('content-type') || '', /application\/json/);
    }
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

// HSTS only in production.
const capture = (production: boolean) => {
  const headers: Record<string, string> = {};
  securityHeaders({ production })({} as any, { setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v; } } as any, () => {});
  return headers;
};
assert.ok(capture(true)['strict-transport-security']?.startsWith('max-age=31536000'));
assert.equal(capture(false)['strict-transport-security'], undefined);

// 4. Client error messages: application validation messages stay visible, infrastructure detail never leaks.
const pgError = Object.assign(new Error('relation "leads" does not exist'), { severity: 'ERROR', routine: 'parserOpenTable', code: '42P01' });
const socketError = Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:5432'), { errno: -111, syscall: 'connect' });
const typeError = new TypeError("Cannot read properties of undefined (reading 'id')");
const leakyMessage = new Error('failed for postgresql://app:secret@db.internal:5432/vortex');
const providerError = Object.assign(new Error('Request failed'), { response: { status: 502 } });
for (const error of [pgError, socketError, typeError, leakyMessage, providerError, new Error(''), 'string', null]) {
  assert.equal(isInternalError(error), true, `internal: ${String((error as any)?.message ?? error)}`);
  assert.equal(clientErrorMessage(error, 'Failed to load leads'), 'Failed to load leads');
}
assert.equal(clientErrorMessage(new Error('Cron expressions must use five fields'), 'Failed'), 'Cron expressions must use five fields');
assert.equal(clientErrorMessage(Object.assign(new Error('Plan limit reached'), { statusCode: 402 }), 'Failed'), 'Plan limit reached');
assert.equal(clientErrorMessage(Object.assign(new Error('Upstream unavailable'), { statusCode: 503 }), 'Failed'), 'Failed');

// 5. Configuration errors (CodeRabbit review on PR #95): "X is not configured" and environment-variable names describe
//    server setup and must never reach the browser, e.g. /api/billing/checkout returning "APP_URL is not configured".
const configurationMessages = [
  'APP_URL is not configured',
  'STRIPE_PRICE_PROFESSIONAL is not configured',
  'STRIPE_SECRET_KEY is not configured',
  'TWILIO_FROM_NUMBER is not configured',
  'OPENAI_API_KEY is not configured',
  'Email provider is not configured: missing SMTP_HOST',
  'Email provider is not configured: missing smtp host',
  'RingCentral credentials not configured or SDK unavailable',
  'File storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  'INTEGRATION_ENCRYPTION_KEY is required in production',
  'RINGCENTRAL_FROM_NUMBER is required for RingOut',
  'Agent lead_scorer is not configured',
  'Webhook signing secret not set',
  'Request failed: missing credentials',
];
for (const message of configurationMessages) {
  assert.equal(isConfigurationErrorMessage(message), true, `configuration message detected: ${message}`);
  assert.equal(isInternalError(new Error(message)), true, `configuration message is internal: ${message}`);
  assert.equal(clientErrorMessage(new Error(message), 'Unable to create checkout session'), 'Unable to create checkout session', `hidden: ${message}`);
  // An explicit 4xx status must not let configuration detail through either.
  assert.equal(clientErrorMessage(Object.assign(new Error(message), { statusCode: 400 }), 'Fallback'), 'Fallback', `4xx still hidden: ${message}`);
}

// Ordinary validation messages, including snake_case field names, must stay visible (the env-var rule is case-sensitive).
for (const message of [
  'run_at is required',
  'next_run_at must be a valid date',
  'Cron expressions must use five fields',
  'limit must be a positive integer',
  'No Stripe customer exists for this organization',
  'Invalid approval decision',
  'Settings saved but campaign is not scheduled',
]) {
  assert.equal(isConfigurationErrorMessage(message), false, `not configuration: ${message}`);
  assert.equal(clientErrorMessage(new Error(message), 'Fallback'), message, `visible: ${message}`);
}

// The real billing service errors behind /api/billing/checkout and /api/billing/portal are hidden end to end.
// billingService captures the STRIPE_PRICE_* variables at module load and server.ts has already imported it above, so
// clear the billing configuration and load a fresh module instance (unique URL) that sees the unconfigured state.
const billingEnvNames = ['APP_URL', 'STRIPE_PRICE_STARTER', 'STRIPE_PRICE_PROFESSIONAL', 'STRIPE_PRICE_ENTERPRISE', 'STRIPE_SECRET_KEY'];
const savedBillingEnv = Object.fromEntries(billingEnvNames.map((name) => [name, process.env[name]]));
for (const name of billingEnvNames) delete process.env[name];
try {
  const { createCheckoutSession, createPortalSession } = await import(`../services/billingService.ts?unconfigured=${Date.now()}`);
  const fakePool = { query: async () => ({ rows: [{ organization_id: 'org_test', billing_customer_id: 'cus_test' }] }) } as any;
  const checkoutError = await createCheckoutSession(fakePool, 'org_test', 'professional').then(() => null, (error) => error);
  assert.ok(checkoutError, 'checkout must fail without STRIPE_PRICE_PROFESSIONAL');
  assert.match(checkoutError.message, /STRIPE_PRICE_PROFESSIONAL is not configured/);
  assert.equal(clientErrorMessage(checkoutError, 'Unable to create checkout session'), 'Unable to create checkout session');
  const portalError = await createPortalSession(fakePool, 'org_test').then(() => null, (error) => error);
  assert.ok(portalError, 'portal session must fail without APP_URL');
  assert.match(portalError.message, /APP_URL is not configured/);
  assert.equal(clientErrorMessage(portalError, 'Unable to create billing portal session'), 'Unable to create billing portal session');
  // A genuine business error from the same service stays visible.
  const noCustomerPool = { query: async () => ({ rows: [] }) } as any;
  const noCustomer = await createPortalSession(noCustomerPool, 'org_test').then(() => null, (error) => error);
  assert.equal(clientErrorMessage(noCustomer, 'Fallback'), 'No Stripe customer exists for this organization');
} finally {
  for (const [name, value] of Object.entries(savedBillingEnv)) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}

// The disposition handler branches on the raw service message, so echoing a value such as NO_ANSWER keeps its 400.
assert.ok(
  /const raw = typeof err\?\.message === 'string' \? err\.message : '';\s*if \(raw === 'Call not found'\)[\s\S]{0,200}raw\.startsWith\('Invalid call disposition:'\)/.test(serverSource),
  'call disposition handler must classify on the raw error message before filtering it',
);

console.log('routeMountingAndSecurityHeaders.test passed');
process.exit(0);
