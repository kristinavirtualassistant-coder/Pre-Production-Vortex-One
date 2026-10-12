/**
 * One-time platform-owner bootstrap (PLATFORM_OWNER_BOOTSTRAP_EMAIL): eligibility checks, never replaces an existing
 * owner, idempotent, audited, and wired into the real boot path so the owner can then sign in to the portal.
 * Runs against the real database triggers (single owner, provisioning flag required).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { bootstrapPlatformOwnerFromEnv } from '../../security/platformOwnerProvisioning';
import { createTotpSecret, encryptMfaSecret } from '../../services/accountSecurity';
import { hashPassword } from '../../services/postgresqlAuth';
import { adminClient, loginWithMfa, ownerApi, pass, removeOwnerAsAdmin, startTestApp } from './httpHarness';

const run = randomUUID().slice(0, 8);
const PASSWORD = 'Correct-Horse-Battery-9';
const quiet = { log: () => {}, warn: () => {} };
const admin = await adminClient();
const orgId = `org_sec_boot_${run}`;

async function makeUser(label: string, opts: { verified?: boolean; mfa?: boolean; disabled?: boolean } = {}) {
  const id = `user_sec_boot_${label}_${run}`;
  const email = `Boot.${label}.${run}@security-test.invalid`;
  const secret = createTotpSecret();
  await admin.query(
    `INSERT INTO users (id, organization_id, email, name, role, password_hash, email_verified_at, mfa_enabled, mfa_secret, disabled_at)
     VALUES ($1,$2,$3,$4,'admin',$5,$6,$7,$8,$9)`,
    [id, orgId, email.toLowerCase(), `Boot ${label}`, await hashPassword(PASSWORD),
      opts.verified === false ? null : new Date(), opts.mfa !== false, opts.mfa === false ? null : encryptMfaSecret(secret),
      opts.disabled ? new Date() : null],
  );
  return { id, email, secret };
}
const owners = async () => (await admin.query('SELECT user_id, provisioned_by FROM platform_owners')).rows;
const bootAudits = async (userId: string) =>
  (await admin.query("SELECT details FROM platform_audit_logs WHERE action = 'owner.provisioned' AND target_id = $1", [userId])).rows;

try {
  await admin.query('INSERT INTO organizations (id, name, slug) VALUES ($1, $2, $3)', [orgId, `Boot ${run}`, `sec-boot-${run}`]);
  await removeOwnerAsAdmin();

  console.log('\n--- Owner bootstrap: configuration and eligibility ---');
  assert.deepEqual(await bootstrapPlatformOwnerFromEnv(admin, {}, quiet), { status: 'not_configured' });
  assert.deepEqual(await bootstrapPlatformOwnerFromEnv(admin, { PLATFORM_OWNER_BOOTSTRAP_EMAIL: '   ' }, quiet), { status: 'not_configured' });
  pass('unset or blank PLATFORM_OWNER_BOOTSTRAP_EMAIL is a no-op');

  const unverified = await makeUser('unverified', { verified: false });
  const noMfa = await makeUser('nomfa', { mfa: false });
  const disabled = await makeUser('disabled', { disabled: true });
  for (const [email, reason] of [
    [`nobody.${run}@security-test.invalid`, /No such user/],
    [unverified.email, /verified/],
    [noMfa.email, /MFA/],
    [disabled.email, /disabled/],
  ] as const) {
    const r = await bootstrapPlatformOwnerFromEnv(admin, { PLATFORM_OWNER_BOOTSTRAP_EMAIL: email }, quiet);
    assert.equal(r.status, 'failed', `${email} is refused`);
    assert.match((r as { reason: string }).reason, reason);
    assert.equal((await owners()).length, 0, 'a refused bootstrap writes nothing');
  }
  pass('unknown, unverified, MFA-less and disabled accounts are refused and nothing is written');

  console.log('\n--- Owner bootstrap: provisioning, idempotence, no takeover ---');
  const first = await makeUser('first');
  const other = await makeUser('other');
  const ok = await bootstrapPlatformOwnerFromEnv(admin, { PLATFORM_OWNER_BOOTSTRAP_EMAIL: `  ${first.email.toUpperCase()} ` }, quiet);
  assert.deepEqual(ok, { status: 'provisioned', userId: first.id });
  assert.deepEqual(await owners(), [{ user_id: first.id, provisioned_by: 'env-bootstrap' }]);
  const audits = await bootAudits(first.id);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].details.via, 'env-bootstrap');
  pass('an eligible account (email matched case-insensitively) becomes the owner, with one audit entry');

  assert.deepEqual(await bootstrapPlatformOwnerFromEnv(admin, { PLATFORM_OWNER_BOOTSTRAP_EMAIL: first.email }, quiet), { status: 'unchanged', userId: first.id });
  assert.equal((await bootAudits(first.id)).length, 1, 'a repeat boot adds no audit entry');
  pass('repeat boots with the variable still set are idempotent');

  assert.deepEqual(await bootstrapPlatformOwnerFromEnv(admin, { PLATFORM_OWNER_BOOTSTRAP_EMAIL: other.email }, quiet), { status: 'skipped_owner_exists' });
  assert.deepEqual(await owners(), [{ user_id: first.id, provisioned_by: 'env-bootstrap' }]);
  assert.equal((await bootAudits(other.id)).length, 0);
  pass('the bootstrap never replaces or adds to an existing owner');

  console.log('\n--- Owner bootstrap: real boot path ---');
  await removeOwnerAsAdmin();
  process.env.PLATFORM_OWNER_BOOTSTRAP_EMAIL = other.email;
  const app = await startTestApp();
  try {
    assert.deepEqual((await owners()).map((o) => o.user_id), [other.id], 'server start provisions the configured owner');
    const token = await loginWithMfa(app, other.email.toLowerCase(), other.secret, PASSWORD);
    const session = await ownerApi(app, 'GET', '/api/owner/session', { auth: { Authorization: `Bearer ${token}` } });
    assert.equal(session.status, 200, `the bootstrapped owner reaches the portal (got ${session.status})`);
    pass('booting with the variable set provisions the owner, who can then sign in to the Owner Portal with MFA');
  } finally {
    delete process.env.PLATFORM_OWNER_BOOTSTRAP_EMAIL;
    await app.close();
  }
} finally {
  await removeOwnerAsAdmin().catch(() => {});
  await admin.query('DELETE FROM users WHERE organization_id = $1', [orgId]).catch(() => {});
  await admin.query('DELETE FROM organizations WHERE id = $1', [orgId]).catch(() => {});
  await admin.end();
}
console.log('\nOwner bootstrap security tests passed.');
process.exit(0);
