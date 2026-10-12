/**
 * Platform-owner provisioning. Used only by trusted operator paths (never by an HTTP route):
 *   - scripts/provision-platform-owner.ts (administrative database URL), and
 *   - the one-time boot bootstrap below (PLATFORM_OWNER_BOOTSTRAP_EMAIL, set by whoever controls the server config).
 * The database itself still enforces a single owner and rejects writes without the provisioning session flag.
 */
import { randomUUID } from 'node:crypto';

export interface ProvisioningClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

export type ProvisionResult =
  | { status: 'provisioned'; userId: string; replaced: string | null }
  | { status: 'unchanged'; userId: string };

export interface ProvisionOptions {
  /** Transfer ownership when a different owner already exists. The boot bootstrap never sets this. */
  replace?: boolean;
  provisionedBy: string;
  requireMfa: boolean;
  auditDetails?: Record<string, unknown>;
}

/** Runs in its own transaction on the given client. Throws (after rolling back) when the user is not eligible. */
export async function provisionPlatformOwner(
  client: ProvisioningClient,
  lookup: { userId: string } | { email: string },
  opts: ProvisionOptions,
): Promise<ProvisionResult> {
  await client.query('BEGIN');
  try {
    await client.query("SELECT set_config('vortex_one.platform_provisioning', 'on', true)");
    const user = 'userId' in lookup
      ? await client.query('SELECT id, disabled_at, email_verified_at, mfa_enabled, organization_id FROM users WHERE id = $1 FOR UPDATE', [lookup.userId])
      : await client.query('SELECT id, disabled_at, email_verified_at, mfa_enabled, organization_id FROM users WHERE lower(email) = lower($1) FOR UPDATE', [lookup.email.trim()]);
    if (!user.rowCount) throw new Error('No such user. Create the account through the normal sign-up first.');
    if (user.rowCount > 1) throw new Error('More than one account matches; provision by user id instead.');
    const u = user.rows[0];
    if (u.disabled_at) throw new Error('The user is disabled.');
    if (!u.email_verified_at) throw new Error('The user has not verified their email address.');
    if (opts.requireMfa && !u.mfa_enabled) throw new Error('Enable MFA on this account before provisioning it as platform owner.');

    const existing = await client.query('SELECT user_id FROM platform_owners');
    const current: string | null = existing.rowCount ? existing.rows[0].user_id : null;
    if (current === u.id) {
      await client.query('ROLLBACK');
      return { status: 'unchanged', userId: u.id };
    }
    if (current) {
      if (!opts.replace) throw new Error('A platform owner already exists. Ownership is only transferred deliberately (provisioning script with --replace).');
      await client.query('DELETE FROM platform_owners');
    }
    await client.query('INSERT INTO platform_owners (user_id, provisioned_by) VALUES ($1, $2)', [u.id, opts.provisionedBy]);
    await client.query(
      `INSERT INTO platform_audit_logs (id, actor_user_id, actor_role, action, target_type, target_id, organization_id, result, details)
       VALUES ($1, NULL, 'operator', 'owner.provisioned', 'user', $2, $3, 'success', $4::jsonb)`,
      [`paudit_${randomUUID()}`, u.id, u.organization_id, JSON.stringify({ via: opts.provisionedBy, replaced: current, ...opts.auditDetails })],
    );
    await client.query('COMMIT');
    return { status: 'provisioned', userId: u.id, replaced: current };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

export type BootstrapOutcome =
  | { status: 'not_configured' }
  | { status: 'provisioned' | 'unchanged'; userId: string }
  | { status: 'skipped_owner_exists' }
  | { status: 'failed'; reason: string };

/**
 * One-time owner bootstrap from server configuration. Only acts while NO owner exists, so it can never take over
 * or replace an existing owner; it always requires a verified, MFA-enabled, active account. Never throws: a
 * failure is logged and the server keeps starting. Remove the variable once the owner exists.
 */
export async function bootstrapPlatformOwnerFromEnv(
  client: ProvisioningClient,
  env: NodeJS.ProcessEnv = process.env,
  log: Pick<Console, 'log' | 'warn'> = console,
): Promise<BootstrapOutcome> {
  const email = env.PLATFORM_OWNER_BOOTSTRAP_EMAIL?.trim();
  if (!email) return { status: 'not_configured' };
  try {
    const existing = await client.query('SELECT user_id FROM platform_owners');
    if (existing.rowCount) {
      const same = await client.query('SELECT 1 FROM users WHERE id = $1 AND lower(email) = lower($2)', [existing.rows[0].user_id, email]);
      if (same.rowCount) {
        log.log('Platform owner bootstrap: this account is already the platform owner. Remove PLATFORM_OWNER_BOOTSTRAP_EMAIL.');
        return { status: 'unchanged', userId: existing.rows[0].user_id };
      }
      log.warn('Platform owner bootstrap ignored: a platform owner already exists. Remove PLATFORM_OWNER_BOOTSTRAP_EMAIL.');
      return { status: 'skipped_owner_exists' };
    }
    const result = await provisionPlatformOwner(client, { email }, {
      provisionedBy: 'env-bootstrap', requireMfa: true, auditDetails: { source: 'PLATFORM_OWNER_BOOTSTRAP_EMAIL' },
    });
    log.log(`Platform owner bootstrap: user ${result.userId} is now the platform owner. Remove PLATFORM_OWNER_BOOTSTRAP_EMAIL.`);
    return { status: result.status, userId: result.userId };
  } catch (error) {
    const reason = (error as Error).message;
    log.warn(`Platform owner bootstrap failed: ${reason}`);
    return { status: 'failed', reason };
  }
}
