/**
 * Abuse protection over real HTTP: per-account and per-IP auth limits (429 + Retry-After), expensive-route limits,
 * pre-auth body-size limits, malformed JSON, prototype-pollution keys.
 */
process.env.RATE_LIMIT_MULTIPLIER = '1';
process.env.TRUST_PROXY = '1'; // lets each scenario use its own X-Forwarded-For bucket
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { api, cleanupTestTenants, createTestTenant, pass, requirePool, startTestApp } from './httpHarness';

const app = await startTestApp();
const pool = requirePool();
const tenant = await createTestTenant(app, 'rate', 'admin');
const run = randomUUID().slice(0, 8);
const ip = (n: string) => ({ 'x-forwarded-for': `203.0.113.${(parseInt(n, 36) % 200) + 1}`, 'x-test-run': run });
let seq = 0;
const uniqueIp = () => ({ 'x-forwarded-for': `198.51.100.${(seq++ % 250) + 1}` });

try {
  console.log('\n--- Security: rate limiting & request hardening ---');

  // Per-account login limit holds even when the attacker rotates source IPs.
  const victim = `victim.${run}@security-test.invalid`;
  let last: any;
  for (let i = 1; i <= 11; i++) {
    last = await api(app, 'POST', '/api/auth/login', null, { email: victim, password: 'wrong-password' }, { 'x-forwarded-for': `192.0.2.${i}` });
    if (i <= 10) assert.ok([400, 401].includes(last.status), `attempt ${i} is a normal failure (got ${last.status})`);
  }
  assert.equal(last.status, 429, 'the 11th attempt against one account is rate limited even from a new IP');
  pass('per-account login limit enforced across rotating IPs (429)');

  const retry = await fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.250' }, body: JSON.stringify({ email: victim, password: 'x' }) });
  assert.equal(retry.status, 429);
  assert.ok(Number(retry.headers.get('retry-after')) >= 1, 'Retry-After header present');
  pass('429 responses carry Retry-After');

  // Per-IP login limit across many accounts.
  const ipHdr = { 'x-forwarded-for': `192.0.2.${100 + (seq++ % 100)}` };
  let statuses: number[] = [];
  for (let i = 0; i < 21; i++) statuses.push((await api(app, 'POST', '/api/auth/login', null, { email: `u${i}.${run}@security-test.invalid`, password: 'bad' }, ipHdr)).status);
  assert.equal(statuses[20], 429, `21st login from one IP is limited (${statuses.join(',')})`);
  assert.ok(statuses.slice(0, 20).every((s) => s !== 429));
  pass('per-IP login limit enforced');

  // Signup per-IP limit.
  const signupHdr = uniqueIp();
  statuses = [];
  for (let i = 0; i < 6; i++) statuses.push((await api(app, 'POST', '/api/auth/signup', null, { name: 'x' }, signupHdr)).status);
  assert.equal(statuses[5], 429, `6th signup from one IP is limited (${statuses.join(',')})`);
  pass('signup per-IP limit enforced');

  // MFA verification limit.
  const mfaHdr = uniqueIp();
  statuses = [];
  for (let i = 0; i < 11; i++) statuses.push((await api(app, 'POST', '/api/auth/mfa/verify', null, { code: '000000' }, mfaHdr)).status);
  assert.equal(statuses[10], 429, `11th MFA verification from one IP is limited (${statuses.join(',')})`);
  pass('MFA verify limit enforced');

  // Expensive authenticated route.
  statuses = [];
  for (let i = 0; i < 11; i++) statuses.push((await api(app, 'POST', '/api/dial-batch', tenant, {}, { 'x-forwarded-for': '198.51.100.251' })).status);
  assert.equal(statuses[10], 429, `11th bulk-dial request is limited (${statuses.join(',')})`);
  pass('expensive authenticated routes are limited per tenant');

  // Body hardening.
  const big = JSON.stringify({ email: 'a@b.invalid', password: 'x'.repeat(300 * 1024) });
  let res = await api(app, 'POST', '/api/auth/signup', null, JSON.parse(big), uniqueIp());
  assert.equal(res.status, 413);
  assert.equal(res.json?.error, 'Request body too large');
  pass('oversized pre-auth JSON body -> 413 JSON');

  const raw = await fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', ...uniqueIp() }, body: '{"email": ' });
  const rawText = await raw.text();
  assert.equal(raw.status, 400);
  assert.deepEqual(JSON.parse(rawText), { error: 'Malformed request body' });
  assert.ok(!/at .*\.(ts|js)/.test(rawText));
  pass('malformed JSON -> 400 JSON without stack trace');

  const polluted = await fetch(`${app.baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', ...uniqueIp() }, body: '{"email":"a@b.invalid","password":"x","__proto__":{"polluted":true}}' });
  assert.equal(polluted.status, 400);
  assert.equal(({} as any).polluted, undefined);
  pass('prototype-pollution keys are rejected');

  res = await api(app, 'POST', '/api/campaigns', tenant, { name: 'x'.repeat(300 * 1024) }, uniqueIp());
  assert.equal(res.status, 413);
  pass('oversized authenticated body on a normal route -> 413');

  const bulk = await fetch(`${app.baseUrl}/api/import-data`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ rows: 'x'.repeat(2 * 1024 * 1024) }) });
  assert.equal(bulk.status, 401);
  pass('large-body import route is not buffered for unauthenticated callers (401)');
  void ip;
} finally {
  await pool.query("DELETE FROM rate_limit_buckets WHERE bucket_key LIKE '%security-test.invalid%'").catch(() => {});
  await cleanupTestTenants(tenant);
  await app.close();
  await pool.end().catch(() => {});
}
