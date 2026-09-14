/**
 * Vortex One - Production-Grade PostgreSQL Schema Migration System
 * Handles automated version tracking, transactional migrations, and table bootstrap
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  // Existing migrations 1-11 remain unchanged.
  // Migration 12 establishes the PostgreSQL-only authentication fields and sessions.
  { version: 12, name: '012_create_postgresql_auth_schema', sql: `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP WITH TIME ZONE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL UNIQUE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);
  `, },
];