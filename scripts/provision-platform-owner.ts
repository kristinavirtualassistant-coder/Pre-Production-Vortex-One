/**
 * Provisions THE platform-owner identity. This is the only way a platform owner comes to exist:
 *   - there is no HTTP endpoint, UI, invitation or role value that can do it;
 *   - it needs direct administrative database access (PLATFORM_PROVISIONING_DATABASE_URL), which the runtime role lacks;
 *   - the database allows exactly one platform owner and rejects writes without the provisioning session flag.
 *
 * The user must already exist (normal sign-up), have a verified email, and (in production) MFA enabled.
 *
 *   PLATFORM_PROVISIONING_DATABASE_URL=postgresql://admin:...@host/db \
 *     npx tsx scripts/provision-platform-owner.ts --user-id user_xxx [--replace]
 */
import pg from 'pg';
import { randomUUID } from 'node:crypto';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(`--${name}`);

const url = process.env.PLATFORM_PROVISIONING_DATABASE_URL;
const userId = arg('user-id');
if (!url) { console.error('PLATFORM_PROVISIONING_DATABASE_URL (an administrative connection) is required.'); process.exit(2); }
if (!userId) { console.error('Usage: provision-platform-owner.ts --user-id <existing user id> [--replace]'); process.exit(2); }

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query('BEGIN');
  await client.query("SELECT set_config('vortex_one.platform_provisioning', 'on', true)");
  const user = await client.query('SELECT id, email, disabled_at, email_verified_at, mfa_enabled, organization_id FROM users WHERE id = $1 FOR UPDATE', [userId]);
  if (!user.rowCount) throw new Error('No such user. Create the account through the normal sign-up first.');
  const u = user.rows[0];
  if (u.disabled_at) throw new Error('The user is disabled.');
  if (!u.email_verified_at) throw new Error('The user has not verified their email address.');
  if (!u.mfa_enabled && process.env.NODE_ENV === 'production') throw new Error('Enable MFA on this account before provisioning it as platform owner.');
  const existing = await client.query('SELECT user_id FROM platform_owners');
  if (existing.rowCount) {
    if (existing.rows[0].user_id === userId) { console.log('This user is already the platform owner. No change.'); await client.query('ROLLBACK'); process.exit(0); }
    if (!flag('replace')) throw new Error('A platform owner already exists. Re-run with --replace to transfer ownership deliberately.');
    await client.query('DELETE FROM platform_owners');
  }
  await client.query("INSERT INTO platform_owners (user_id, provisioned_by) VALUES ($1, 'provisioning-script')", [userId]);
  await client.query(
    `INSERT INTO platform_audit_logs (id, actor_user_id, actor_role, action, target_type, target_id, organization_id, result, details)
     VALUES ($1, NULL, 'operator', 'owner.provisioned', 'user', $2, $3, 'success', $4::jsonb)`,
    [`paudit_${randomUUID()}`, userId, u.organization_id, JSON.stringify({ replaced: existing.rowCount ? existing.rows[0].user_id : null })],
  );
  await client.query('COMMIT');
  console.log(`Platform owner set to user ${userId}.`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Provisioning failed:', (error as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
