/**
 * Real-browser checks of the built Owner Portal against the production-mode server:
 * unauthenticated redirect, customer denial (no owner UI), owner sign-in with MFA, refresh persistence, no browser
 * storage of credentials, organization creation through the UI, expired-session handling, and no sign-up affordance.
 * Requires `npm run build` (dist/) and a Chromium binary.
 */
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import puppeteer from 'puppeteer';
import { createPlatformOwner, createTestTenant, freshTotp, pass, removeOwnerAsAdmin, cleanupTestTenants } from './httpHarness';
import { hashSessionToken } from '../../services/postgresqlAuth';
import { getRawPgPool } from '../../db/db';

function chromePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const root = '/opt/pw-browsers';
  if (existsSync(root)) {
    for (const dir of readdirSync(root).filter((d) => d.startsWith('chromium-'))) {
      const candidate = `${root}/${dir}/chrome-linux/chrome`;
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}
if (!existsSync('dist/index.html')) throw new Error('dist/ is missing: run `npm run build` before the browser security tests');

const { createApp } = await import('../../../server');
const expressApp = await createApp({ serveFrontend: true, backgroundTimers: false });
const server = http.createServer(expressApp);
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
const app = { baseUrl: base, close: async () => { server.closeAllConnections?.(); await new Promise<void>((r) => server.close(() => r())); } };

// The raw pool: this test shares a process with the server, so it must not inherit a request-scoped tenant transaction.
const pool = getRawPgPool()!;
const owner = await createPlatformOwner(app, 'uiowner');
const customer = await createTestTenant(app, 'uicustomer', 'admin');
const orgName = `UI Created Org ${Date.now()}`;

const browser = await puppeteer.launch({ headless: true, executablePath: chromePath(), args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const text = (page: any) => page.evaluate(() => document.body.innerText);
const hasOwnerNav = (page: any) => page.evaluate(() => Boolean(document.querySelector('aside[aria-label="Owner navigation"]')));
const settle = async (page: any, predicate: () => boolean, label: string, timeout = 15000) => {
  try { await page.waitForFunction(predicate, { timeout }); } catch { throw new Error(`Timed out waiting for: ${label}. URL=${page.url()} body=${(await text(page)).slice(0, 200)}`); }
};

try {
  console.log('\n--- Owner portal: browser ---');

  // 1. unauthenticated visitor -> /owner/login, no owner UI, no sign-up
  {
    const page = await browser.newPage();
    await page.goto(`${base}/owner/organizations`, { waitUntil: 'networkidle0' });
    await settle(page, () => location.pathname === '/owner/login', 'redirect to /owner/login');
    assert.equal(await hasOwnerNav(page), false);
    const body = (await text(page)).toLowerCase();
    assert.ok(!body.includes('session expired'), 'a first visit is not reported as an expired session');
    for (const forbidden of ['sign up', 'register', 'create account', 'create owner', 'forgot password', 'reset password', 'invite']) assert.ok(!body.includes(forbidden), `login page must not offer "${forbidden}"`);
    assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll('a')).length), 0, 'login page has no links');
    const headers = (await page.goto(`${base}/owner/login`))?.headers() ?? {};
    assert.equal(headers['cache-control'], 'no-store');
    assert.equal(headers['x-frame-options'], 'DENY');
    await page.close();
    pass('unauthenticated /owner/* is redirected to /owner/login, which has no sign-up, register, invite or reset affordance');
  }

  // 2. a customer typing valid customer credentials into the owner login is refused and their new session is ended
  {
    const page = await browser.newPage();
    await page.goto(`${base}/owner/login`, { waitUntil: 'networkidle0' });
    await page.type('input[type=email]', customer.email);
    await page.type('input[type=password]', 'Correct-Horse-Battery-9');
    await page.click('button[type=submit]');
    await settle(page, () => document.body.innerText.includes('not authorized'), 'customer refusal message');
    assert.equal(await hasOwnerNav(page), false);
    assert.equal(new URL(page.url()).pathname, '/owner/login');
    const me = await page.evaluate(async () => (await fetch('/api/auth/me', { credentials: 'include' })).status);
    assert.equal(me, 401, 'the session created by the refused sign-in was revoked');
    await page.close();
    pass('a customer signing in on /owner/login is refused with no owner UI and no lingering session');
  }

  // 3. a signed-in customer navigating to /owner sees only a refusal
  {
    const page = await browser.newPage();
    await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
    const logged = await page.evaluate(async (email: string) => {
      const r = await fetch('/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Correct-Horse-Battery-9' }) });
      return r.status;
    }, customer.email);
    assert.equal(logged, 200);
    await page.goto(`${base}/owner`, { waitUntil: 'networkidle0' });
    await settle(page, () => document.body.innerText.includes('Access denied'), 'access denied page');
    assert.equal(await hasOwnerNav(page), false);
    const body = await text(page);
    assert.ok(!/Platform overview|Organizations|Audit logs|Backups/.test(body), 'no owner dashboard content is rendered for a customer');
    await page.goto(`${base}/owner/organizations`, { waitUntil: 'networkidle0' });
    await settle(page, () => document.body.innerText.includes('Access denied'), 'access denied on a deep link');
    await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
    assert.ok(!(await text(page)).includes('Owner Portal'), 'the customer application never shows owner navigation');
    await page.close();
    pass('a signed-in customer who navigates to /owner or a deep link gets "Access denied" and no owner UI');
  }

  // 4. owner sign-in with MFA through the UI, refresh, storage
  const ownerPage = await browser.newPage();
  await ownerPage.goto(`${base}/owner/login`, { waitUntil: 'networkidle0' });
  await ownerPage.type('input[type=email]', owner.email);
  await ownerPage.type('input[type=password]', 'Correct-Horse-Battery-9');
  await ownerPage.click('button[type=submit]');
  await settle(ownerPage, () => document.body.innerText.includes('Authenticator code'), 'MFA prompt');
  await ownerPage.type('input[autocomplete=one-time-code]', await freshTotp(owner.mfaSecret));
  await ownerPage.click('button[type=submit]');
  await settle(ownerPage, () => location.pathname === '/owner' && document.body.innerText.includes('Platform overview'), 'owner dashboard');
  assert.equal(await hasOwnerNav(ownerPage), true);
  const dash = await text(ownerPage);
  for (const label of ['Organizations', 'Users', 'Usage', 'Audit logs', 'System', 'Backups', 'Settings']) assert.ok(dash.includes(label), `${label} navigation present`);
  assert.ok(/Platform owner/.test(dash));
  await ownerPage.reload({ waitUntil: 'networkidle0' });
  await settle(ownerPage, () => document.body.innerText.includes('Platform overview'), 'dashboard after refresh');
  await ownerPage.goto(`${base}/owner/audit-logs`, { waitUntil: 'networkidle0' });
  await settle(ownerPage, () => document.body.innerText.includes('Audit logs') && document.body.innerText.includes('owner.login'), 'audit page after a full reload');
  const storage = await ownerPage.evaluate(() => ({ local: Object.keys(localStorage), session: Object.keys(sessionStorage), cookieVisible: document.cookie }));
  assert.deepEqual(storage.local.filter((k: string) => /token|session|auth|owner/i.test(k)), []);
  assert.deepEqual(storage.session.filter((k: string) => /token|session|auth|owner/i.test(k)), []);
  assert.ok(!/vortex_session/.test(storage.cookieVisible), 'the session cookie is HttpOnly (invisible to scripts)');
  pass('owner signs in with MFA, survives refresh and deep-link reloads, and no credential is stored in browser storage');

  // 5. organization creation through the UI
  await ownerPage.goto(`${base}/owner/organizations`, { waitUntil: 'networkidle0' });
  await settle(ownerPage, () => document.body.innerText.includes('New organization'), 'organizations page');
  const buttons = await ownerPage.$$('button');
  for (const b of buttons) { if ((await b.evaluate((e: any) => e.textContent)).includes('New organization')) { await b.click(); break; } }
  await ownerPage.waitForSelector('[role=dialog] input');
  await ownerPage.type('[role=dialog] input', orgName);
  await ownerPage.click('[role=dialog] button[form=create-org]');
  await settle(ownerPage, () => location.pathname.startsWith('/owner/organizations/') && document.body.innerText.includes('Start support session'), 'organization detail');
  assert.ok((await text(ownerPage)).includes(orgName));
  assert.equal((await pool.query('SELECT status FROM organizations WHERE name = $1', [orgName])).rows[0].status, 'active');
  assert.equal((await pool.query("SELECT 1 FROM platform_audit_logs WHERE action = 'owner.organization_created' AND details->>'name' = $1", [orgName])).rowCount, 1);
  pass('the owner creates an organization through the UI and it is audited');

  // 6. deactivation needs the typed confirmation
  for (const b of await ownerPage.$$('button')) { if ((await b.evaluate((e: any) => e.textContent)).startsWith('Deactivate')) { await b.click(); break; } }
  await ownerPage.waitForSelector('[role=dialog]');
  const confirmDisabled = await ownerPage.evaluate(() => (Array.from(document.querySelectorAll('[role=dialog] button')) as HTMLButtonElement[]).find((b) => b.textContent === 'Deactivate organization')!.disabled);
  assert.equal(confirmDisabled, true, 'the dangerous action stays disabled until the name is typed');
  await ownerPage.keyboard.press('Escape');
  await ownerPage.waitForFunction(() => !document.querySelector('[role=dialog]'));
  pass('destructive actions sit behind a confirmation dialog (Escape closes it)');

  // 7. expired session -> back to login with a message
  const cookies = await ownerPage.cookies();
  const sessionCookie = cookies.find((c) => /vortex_session/.test(c.name))!;
  await pool.query("UPDATE auth_sessions SET expires_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE token_hash = $1", [hashSessionToken(decodeURIComponent(sessionCookie.value))]);
  for (const a of await ownerPage.$$('nav a[href="/owner/users"]')) { if (await a.isIntersectingViewport()) { await a.click(); break; } }
  await settle(ownerPage, () => location.pathname === '/owner/login', 'redirect after expiry');
  await settle(ownerPage, () => document.body.innerText.includes('session expired'), 'expiry message');
  assert.equal(await hasOwnerNav(ownerPage), false);
  pass('an expired session sends the owner back to /owner/login with a clear message and no owner UI');
  await ownerPage.close();

  console.log('Owner portal browser tests passed.');
} finally {
  await browser.close().catch(() => {});
  await removeOwnerAsAdmin().catch(() => {});
  await pool.query('DELETE FROM organizations WHERE name = $1', [orgName]).catch(() => {});
  await cleanupTestTenants(customer, owner);
  await app.close();
  await pool.end().catch(() => {});
}
