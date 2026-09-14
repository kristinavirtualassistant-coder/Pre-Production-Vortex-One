import assert from 'node:assert/strict';
import { ensurePostgreSQLAuthSchema } from '../db/postgresqlAuthSchema';

const queries: string[] = [];
const pool = {
  query: async (sql: string) => {
    queries.push(sql);
    return { rows: [] };
  },
} as any;

await ensurePostgreSQLAuthSchema(pool);

assert.equal(queries.length, 2, 'auth bootstrap must apply migration 12 and record it');
assert.match(queries[0], /CREATE TABLE IF NOT EXISTS auth_sessions/i);
assert.match(queries[0], /CREATE TABLE IF NOT EXISTS webhook_endpoints/i);
assert.match(queries[0], /CREATE TABLE IF NOT EXISTS webhook_deliveries/i);
assert.match(queries[1], /INSERT INTO schema_migrations/i);
assert.match(queries[1], /012_create_postgresql_auth_schema/i);

console.log('PostgreSQL auth schema bootstrap tracking checks passed');
