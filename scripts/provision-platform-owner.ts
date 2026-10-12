/**
 * Provisions THE platform-owner identity. Owners only come to exist through trusted operator paths:
 *   - there is no HTTP endpoint, UI, invitation or role value that can do it;
 *   - it needs direct administrative database access (PLATFORM_PROVISIONING_DATABASE_URL), which the runtime role lacks
 *     (or, once, PLATFORM_OWNER_BOOTSTRAP_EMAIL in the server config: see server/security/platformOwnerProvisioning.ts);
 *   - the database allows exactly one platform owner and rejects writes without the provisioning session flag.
 *
 * The user must already exist (normal sign-up), have a verified email, and (in production) MFA enabled.
 *
 *   PLATFORM_PROVISIONING_DATABASE_URL=postgresql://admin:...@host/db \
 *     npx tsx scripts/provision-platform-owner.ts --user-id user_xxx [--replace]
 */
import pg from 'pg';
import { provisionPlatformOwner } from '../server/security/platformOwnerProvisioning';

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
  const result = await provisionPlatformOwner(client, { userId }, {
    replace: flag('replace'), provisionedBy: 'provisioning-script', requireMfa: process.env.NODE_ENV === 'production',
  });
  if (result.status === 'unchanged') console.log('This user is already the platform owner. No change.');
  else console.log(`Platform owner set to user ${result.userId}.`);
} catch (error) {
  console.error('Provisioning failed:', (error as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
