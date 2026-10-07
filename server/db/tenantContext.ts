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
