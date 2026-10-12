import type { Pool, PoolClient } from 'pg';
import { ResourceNotFoundError } from '../errors';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

/**
 * Tenant-owned tables that may be checked by id. The allow-list exists so a table name can never be influenced by
 * request input (it is interpolated into SQL), and each entry carries the label used in 404 messages.
 */
const OWNED_TABLES = {
  campaign: 'Campaign',
  call: 'Call',
  leads: 'Lead',
  workflows: 'Workflow',
  webhook_endpoints: 'Webhook endpoint',
  property_owners: 'Owner',
  properties: 'Property',
  dialing_session: 'Dialing session',
  file_assets: 'File',
  contacts: 'Contact',
  tasks: 'Task',
  approvals: 'Approval',
} as const;

export type OwnedTable = keyof typeof OWNED_TABLES;

/** True when `id` exists in `table` AND belongs to `organizationId`. A row owned by another tenant is "not owned". */
export async function isOwned(db: Queryable, table: OwnedTable, id: unknown, organizationId: string): Promise<boolean> {
  if (!(table in OWNED_TABLES) || typeof id !== 'string' || id.length === 0 || id.length > 255) return false;
  const result = await db.query(`SELECT 1 FROM ${table} WHERE id = $1 AND organization_id = $2 LIMIT 1`, [id, organizationId]);
  return (result.rowCount ?? 0) > 0;
}

/** Throws ResourceNotFoundError (HTTP 404) unless the row belongs to the organization. Never reveals other tenants' rows. */
export async function assertOwned(db: Queryable, table: OwnedTable, id: unknown, organizationId: string): Promise<void> {
  if (!(await isOwned(db, table, id, organizationId))) throw new ResourceNotFoundError(OWNED_TABLES[table]);
}

/**
 * Reference validation: every id a client attaches to its own record (lead, owner, property, campaign...) must be
 * owned by the same organization, otherwise a tenant could link its data to another tenant's rows.
 */
export async function assertAllOwned(db: Queryable, table: OwnedTable, ids: unknown[], organizationId: string): Promise<void> {
  const unique = [...new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (!unique.length) return;
  const result = await db.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE id = ANY($1::text[]) AND organization_id = $2`, [unique, organizationId]);
  if (Number(result.rows[0]?.n) !== unique.length) throw new ResourceNotFoundError(OWNED_TABLES[table]);
}
