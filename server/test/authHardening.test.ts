import assert from 'node:assert/strict';
import { sameOriginGuard } from '../middleware/requestHardening';
import { burnPasswordVerification, hashPassword, verifyPassword } from '../services/postgresqlAuth';
import { cookieSecure } from '../services/accountSecurity';

function run(method: string, headers: Record<string, string>) {
  let status = 200; let nexted = false;
  const res: any = { status(c: number) { status = c; return res; }, json() { return res; } };
  sameOriginGuard({ method, headers } as any, res, () => { nexted = true; });
  return { status, nexted };
}
const cookie = 'vortex_session=abc';
process.env.APP_URL = 'https://app.example.com';
assert.equal(run('POST', { cookie, origin: 'https://evil.example', host: 'app.example.com' }).status, 403);
assert.equal(run('POST', { cookie, origin: 'null', host: 'app.example.com' }).status, 403);
assert.equal(run('POST', { cookie, 'sec-fetch-site': 'cross-site', host: 'app.example.com' }).status, 403);
assert.equal(run('POST', { cookie, origin: 'https://app.example.com', host: 'app.example.com' }).nexted, true);
assert.equal(run('GET', { cookie, origin: 'https://evil.example' }).nexted, true);
assert.equal(run('POST', { origin: 'https://evil.example', host: 'app.example.com' }).nexted, true, 'no session cookie: webhooks unaffected');
assert.equal(run('POST', { cookie }).nexted, true, 'non-browser caller without Origin');
assert.equal(cookieSecure(), true);

const hash = await hashPassword('correct horse battery');
assert.equal(await verifyPassword('correct horse battery', hash), true);
await burnPasswordVerification('anything');
console.log('  ✓ PASS: auth hardening (same-origin guard, secure cookie, dummy verify)');
