import type { Migration } from './migrations';

/**
 * PostgreSQL-only authentication, webhook, and voicemail persistence migration.
 *
 * Kept as a standalone migration artifact so the recovered migration history
 * is never reconstructed or overwritten by an automated patch.
 */
export const POSTGRESQL_AUTH_MIGRATION: Migration = {
  version: 12,
  name: '012_create_postgresql_auth_schema',
  sql: `
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

    CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      url VARCHAR(2048) NOT NULL,
      events JSONB NOT NULL,
      enabled BOOLEAN DEFAULT true NOT NULL,
      description TEXT,
      secret VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(organization_id);

    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id VARCHAR(64) PRIMARY KEY,
      endpoint_id VARCHAR(64) NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      event_id VARCHAR(128) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      url VARCHAR(2048) NOT NULL,
      status VARCHAR(50) NOT NULL,
      status_code INTEGER,
      attempts INTEGER DEFAULT 0 NOT NULL,
      error TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      completed_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org
      ON webhook_deliveries(organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
      ON webhook_deliveries(endpoint_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS voicemail_library (
      id VARCHAR(64) PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      label VARCHAR(255) NOT NULL,
      url VARCHAR(2048) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_voicemail_library_org
      ON voicemail_library(organization_id, created_at DESC);
  `,
};
