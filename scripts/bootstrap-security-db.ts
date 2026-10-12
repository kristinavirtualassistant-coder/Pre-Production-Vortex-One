import { initializeDatabase, getPgPool } from '../server/db/db';
import { ensurePostgreSQLAuthSchema } from '../server/db/postgresqlAuthSchema';

const status = await initializeDatabase();
if (!status.connected || status.type !== 'postgresql') throw new Error('Security test database bootstrap requires PostgreSQL');
const pool = getPgPool();
if (!pool) throw new Error('PostgreSQL pool unavailable');
await ensurePostgreSQLAuthSchema(pool);
console.log(`Security test database ready (${status.appliedMigrationsCount} migrations).`);
await pool.end();
process.exit(0);
