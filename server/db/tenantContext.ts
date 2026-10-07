import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient } from 'pg';

export interface TenantDbContext {
  organizationId: string;
  client: PoolClient;
  rollbackOnly: boolean;
}

const storage = new AsyncLocalStorage<TenantDbContext>();

export function runTenantContext<T>(context: TenantDbContext, callback: () => T): T {
  return storage.run(context, callback);
}

export function getTenantContext(): TenantDbContext | undefined {
  return storage.getStore();
}

export function enterTenantContext(context: TenantDbContext): void {
  storage.enterWith(context);
}

export async function beginTenantContext(client: PoolClient, organizationId: string): Promise<TenantDbContext> {
  await client.query('BEGIN');
  await client.query('SELECT set_config($1, $2, true)', ['vortex.organization_id', organizationId]);
  return { organizationId, client, rollbackOnly: false };
}

export async function finishTenantContext(context: TenantDbContext, commit: boolean): Promise<void> {
  try {
    if (context.rollbackOnly || !commit) await context.client.query('ROLLBACK');
    else await context.client.query('COMMIT');
  } finally {
    context.client.release();
  }
}
