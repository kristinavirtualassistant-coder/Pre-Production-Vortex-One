import type { Pool, PoolClient, QueryConfig, QueryResult, QueryResultRow } from 'pg';

export const TENANT_GUC = 'vortex_one.organization_id';

export function requireTenantId(organizationId: string): string {
  const value = String(organizationId || '').trim();
  if (!/^org_[A-Za-z0-9_-]{1,120}$/.test(value)) {
    throw new Error('Invalid tenant organization identifier');
  }
  return value;
}

/**
 * Execute database work in a transaction with a transaction-local tenant
 * context. SET LOCAL prevents a pooled connection from retaining a tenant
 * identity for a later request.
 */
export async function withTenantTransaction<T>(
  pool: Pool,
  organizationId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const tenantId = requireTenantId(organizationId);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', [TENANT_GUC, tenantId]);
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

export async function queryAsTenant<T extends QueryResultRow = QueryResultRow>(
  pool: Pool,
  organizationId: string,
  query: string | QueryConfig<any[]>,
  values?: any[],
): Promise<QueryResult<T>> {
  return withTenantTransaction(pool, organizationId, (client) =>
    client.query<T>(query as any, values),
  );
}
