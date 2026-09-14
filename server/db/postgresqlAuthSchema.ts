import type { Pool } from 'pg';

let schemaReady: Promise<void> | null = null;

/**
 * Temporary idempotent bootstrap for PostgreSQL authentication tables.
 * This keeps auth usable while the versioned migration is being introduced.
 */
export function ensurePostgreSQLAuthSchema(pool: Pool): Promise<void> {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    await pool.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_hash TEXT,
        ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user
      ON auth_sessions(user_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry
      ON auth_sessions(expires_at)
    `);
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}
