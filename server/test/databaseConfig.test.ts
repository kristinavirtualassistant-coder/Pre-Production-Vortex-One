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

assert.equal(getDatabaseConnectionConfig({}), null);

console.log('databaseConfig.test.ts: PASS');
\n\ndescribe('database migration credential separation', () => {\n  it('keeps runtime credentials independent from migration credentials', () => {\n    const env = {\n      SQL_HOST: 'db.example.test',\n      SQL_PORT: '5432',\n      SQL_USER: 'runtime_user',\n      SQL_PASSWORD: 'runtime_password',\n      SQL_ADMIN_USER: 'migration_user',\n      SQL_ADMIN_PASSWORD: 'migration_password',\n      SQL_DB_NAME: 'vortex_one',\n      SQL_SSL: 'true',\n    };\n\n    const runtime = getDatabaseConnectionConfig(env);\n    expect(runtime).toMatchObject({\n      user: 'runtime_user',\n      password: 'runtime_password',\n      database: 'vortex_one',\n      ssl: true,\n    });\n    expect(runtime?.user).not.toBe(env.SQL_ADMIN_USER);\n    expect(runtime?.password).not.toBe(env.SQL_ADMIN_PASSWORD);\n  });\n});\n