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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(POSTGRESQL_AUTH_MIGRATION.sql);
      await client.query(
        `INSERT INTO schema_migrations (version, name)
         VALUES ($1, $2)
         ON CONFLICT (version) DO NOTHING`,
        [POSTGRESQL_AUTH_MIGRATION.version, POSTGRESQL_AUTH_MIGRATION.name],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}
