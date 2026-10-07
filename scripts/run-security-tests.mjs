#!/usr/bin/env node
/**
 * Runs the HTTP security suites against the REAL Express app in production mode, connected as a
 * least-privileged PostgreSQL role (not SUPERUSER, not BYPASSRLS) exactly as the production startup guard
 * requires. Many handlers take dev-only/in-memory branches when NODE_ENV !== 'production', so security tests
 * that ran under NODE_ENV=test would not exercise the code that actually ships.
 *
 * Environment (defaults match CI):
 *   SECURITY_TEST_ADMIN_URL  admin connection used for role creation, migrations and grants
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const adminUrl = process.env.SECURITY_TEST_ADMIN_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/vortex_one_test';
const appRole = 'vortex_app';
const appPassword = 'vortex_app_test_password';
const admin = new URL(adminUrl);
const appUrl = new URL(adminUrl);
appUrl.username = appRole;
appUrl.password = appPassword;

const baseEnv = {
  ...process.env,
  AUTH_SESSION_PEPPER: process.env.AUTH_SESSION_PEPPER || 'ci-only-session-pepper-32-characters-minimum',
  VORTEX_ONE_SEED_DEMO_DATA: '0',
  VORTEX_ONE_SKIP_LIVE_GIS: '1',
  SQL_SSL: 'false',
  APP_URL: 'http://localhost:4173',
  AUTH_ENCRYPTION_KEY: process.env.AUTH_ENCRYPTION_KEY || 'IgIHEDzfX63nIZ72ptfG1GXx8EAaJXWQEytbOCbJYh8=',
  INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY || 'LmUBBZ+sEseYw1OU0qDWJheOoHi+jhQ0ciXL1VF0Vp4=',
  // Suites share one client IP and sign in many times; the limiter suite resets the multiplier to 1.
  RATE_LIMIT_MULTIPLIER: process.env.RATE_LIMIT_MULTIPLIER || '1000',
};

function run(label, env, args) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', ...args], { stdio: 'inherit', env: { ...baseEnv, ...env } });
  if (result.status !== 0) {
    console.error(`\n${label} FAILED (exit ${result.status})`);
    process.exit(result.status || 1);
  }
}

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
try {
  if (process.env.SECURITY_TEST_KEEP_DB !== '1') {
    // Deterministic database: always rebuild the schema from the migration chain (set SECURITY_TEST_KEEP_DB=1 to skip).
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
  }
  const exists = await client.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [appRole]);
  if (!exists.rowCount) {
    await client.query(`CREATE ROLE ${appRole} LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
  } else {
    await client.query(`ALTER ROLE ${appRole} LOGIN PASSWORD '${appPassword}' NOSUPERUSER NOBYPASSRLS`);
  }
  await client.query(`GRANT ALL ON DATABASE ${admin.pathname.slice(1)} TO ${appRole}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${appRole}`);
} finally {
  await client.end();
}

// 1. Apply every migration and the auth schema as the admin role (the runtime role is least-privileged).
run('schema bootstrap', { NODE_ENV: 'test', DATABASE_URL: adminUrl, SQL_ADMIN_USER: '', SQL_ADMIN_PASSWORD: '' }, ['scripts/bootstrap-security-db.ts']);

const grants = new pg.Client({ connectionString: adminUrl });
await grants.connect();
try {
  await grants.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${appRole}`);
  await grants.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${appRole}`);
  await grants.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${appRole}`);
} finally {
  await grants.end();
}

// 2. Run each security suite in its own process, in production mode, as the least-privileged role.
const dir = path.join('server', 'test', 'security');
const onlyFilter = process.argv[2];
const suites = readdirSync(dir).filter((name) => name.endsWith('.test.ts') && (!onlyFilter || name.includes(onlyFilter))).sort();
if (!suites.length) throw new Error(`No security suites matched ${onlyFilter}`);
const adminUser = decodeURIComponent(admin.username);
const adminPassword = decodeURIComponent(admin.password);
for (const suite of suites) {
  console.log(`\n=== security suite: ${suite} (NODE_ENV=production, role=${appRole}) ===`);
  run(suite, {
    NODE_ENV: 'production',
    DATABASE_URL: appUrl.toString(),
    SQL_ADMIN_USER: adminUser,
    SQL_ADMIN_PASSWORD: adminPassword,
    STRIPE_WEBHOOK_SECRET: '',
    SCHEDULER_TRIGGER_SECRET: '',
  }, [path.join(dir, suite)]);
}
console.log(`\nAll ${suites.length} security suites passed.`);
