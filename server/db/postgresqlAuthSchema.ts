import type { Pool } from 'pg';
import { POSTGRESQL_AUTH_MIGRATION } from './postgresqlAuthMigration';

let schemaReady: Promise<void> | null = null;

/**
 * Idempotent PostgreSQL authentication/schema bootstrap.
 * The SQL is shared with the versioned migration-12 artifact so auth and
 * webhook persistence cannot silently diverge between bootstrap and migration.
 */
export function ensurePostgreSQLAuthSchema(pool: Pool): Promise<void> {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    await pool.query(POSTGRESQL_AUTH_MIGRATION.sql);
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}
