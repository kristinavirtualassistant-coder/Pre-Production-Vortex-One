import assert from 'node:assert/strict';
import { getDatabaseConnectionConfig } from '../db/db';

const config = getDatabaseConnectionConfig({
  DATABASE_URL: 'postgresql://dbuser:secret@localhost:5433/vortex_portable',
});

assert.deepEqual(config, {
  host: 'localhost',
  port: 5433,
  user: 'dbuser',
  password: 'secret',
  database: 'vortex_portable',
  ssl: false,
});

const sslConfig = getDatabaseConnectionConfig({
  DATABASE_URL: 'postgresql://dbuser:secret@db.example/vortex?sslmode=require',
});
assert.equal(sslConfig?.ssl, true);

const standardEnv = getDatabaseConnectionConfig({
  SQL_HOST: '127.0.0.1',
  SQL_PORT: '5432',
  SQL_USER: 'postgres',
  SQL_PASSWORD: 'local-only',
  SQL_DB_NAME: 'vortex-one-database',
  SQL_SSL: 'false',
});
assert.equal(standardEnv?.host, '127.0.0.1');
assert.equal(standardEnv?.database, 'vortex-one-database');

const separatedEnv = getDatabaseConnectionConfig({
  SQL_HOST: 'db.example.test',
  SQL_PORT: '5432',
  SQL_USER: 'runtime_user',
  SQL_PASSWORD: 'runtime_password',
  SQL_ADMIN_USER: 'migration_user',
  SQL_ADMIN_PASSWORD: 'migration_password',
  SQL_DB_NAME: 'vortex_one',
  SQL_SSL: 'true',
});
assert.equal(separatedEnv?.user, 'runtime_user');
assert.equal(separatedEnv?.password, 'runtime_password');
assert.notEqual(separatedEnv?.user, 'migration_user');
assert.notEqual(separatedEnv?.password, 'migration_password');
assert.equal(separatedEnv?.database, 'vortex_one');
assert.equal(separatedEnv?.ssl, true);

assert.equal(getDatabaseConnectionConfig({}), null);

console.log('databaseConfig.test.ts: PASS');
