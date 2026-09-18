import assert from 'node:assert/strict';
import { POSTGRESQL_AUTH_MIGRATION } from '../db/postgresqlAuthMigration';

const migration12 = POSTGRESQL_AUTH_MIGRATION;

assert.equal(migration12.version, 12);
assert.equal(migration12.name, '012_create_postgresql_auth_schema');

const sql = migration12.sql;
assert.match(sql, /ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash/i);
assert.match(sql, /ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at/i);
assert.match(sql, /ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at/i);
assert.match(sql, /CREATE TABLE IF NOT EXISTS auth_sessions/i);
assert.match(sql, /REFERENCES users\(id\) ON DELETE CASCADE/i);
assert.match(sql, /token_hash VARCHAR\(64\) NOT NULL UNIQUE/i);
assert.match(sql, /expires_at TIMESTAMP WITH TIME ZONE NOT NULL/i);
assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_auth_sessions_user/i);
assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry/i);
assert.match(sql, /CREATE TABLE IF NOT EXISTS webhook_endpoints/i);
assert.match(sql, /CREATE TABLE IF NOT EXISTS webhook_deliveries/i);
assert.match(sql, /REFERENCES webhook_endpoints\(id\) ON DELETE CASCADE/i);
assert.match(sql, /CREATE TABLE IF NOT EXISTS voicemail_library/i);
assert.match(sql, /REFERENCES organizations\(id\) ON DELETE CASCADE/i);
assert.match(sql, /CREATE INDEX IF NOT EXISTS idx_voicemail_library_org/i);

console.log('PostgreSQL authentication migration 12 checks passed');
