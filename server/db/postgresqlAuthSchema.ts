import type { Pool } from 'pg';
import { POSTGRESQL_AUTH_MIGRATION } from './postgresqlAuthMigration';

let schemaReady: Promise<void> | null = null;

const REQUIRED_AUTH_TABLES = ['auth_sessions', 'organization_invites', 'webhook_endpoints', 'webhook_deliveries', 'voicemail_library'];

async function authSchemaPresent(pool: Pool): Promise<boolean> {
  const tables = await pool.query(
    `SELECT COUNT(*)::int AS present FROM unnest($1::text[]) AS t(name) WHERE to_regclass('public.' || t.name) IS NOT NULL`,
    [REQUIRED_AUTH_TABLES],
  );
  if (Number(tables.rows[0]?.present) !== REQUIRED_AUTH_TABLES.length) return false;
  const column = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'password_hash'`,
  );
  return column.rowCount === 1;
}

/**
 * Guarantees the authentication schema exists.
 *
 * The schema is part of the ordered migration chain (migration 012), which the admin/migration role applies at
 * startup. In production the runtime database role is deliberately least-privileged (not a superuser and not
 * BYPASSRLS, and normally not the table owner), so request-time DDL would fail with "must be owner of table".
 * Therefore production only VERIFIES the schema and fails loudly if migrations have not been applied. In
 * development and tests the SQL is still applied idempotently as a convenience.
 */
export function ensurePostgreSQLAuthSchema(pool: Pool): Promise<void> {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    if (await authSchemaPresent(pool)) return;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Authentication schema is missing. Apply database migrations (npm start applies them with SQL_ADMIN_USER at boot) before serving traffic.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(POSTGRESQL_AUTH_MIGRATION.sql);
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
