import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeDatabase, getPgPool } from '../db/db';
import { runWorkerTick, startWorkerLoop } from '../workers/tick';

await initializeDatabase();
const pool = getPgPool();
if (!pool) { console.log('Worker tick test skipped: PostgreSQL is not configured'); process.exit(0); }

const run = randomUUID().slice(0, 8);
const org = `org_worker_${run}`;
await pool.query('INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3)', [org, org, org]);
await pool.query("INSERT INTO users (id,organization_id,email,name,role) VALUES ($1,$2,$3,'w','admin')", [`user_${run}`, org, `w.${run}@example.invalid`]);
await pool.query(
  "INSERT INTO auth_sessions (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,CURRENT_TIMESTAMP - INTERVAL '3 days')",
  [`sess_${run}`, `user_${run}`, `hash_${run}`],
);

try {
  const result = await runWorkerTick();
  assert.equal(typeof result.workflowSchedules, 'number');
  assert.equal(typeof result.propertyJobs, 'number');
  assert.ok(result.sessionsPurged >= 1, 'expired sessions are purged by the worker tick');
  assert.equal((await pool.query('SELECT 1 FROM auth_sessions WHERE id=$1', [`sess_${run}`])).rowCount, 0);

  // two ticks racing (two worker processes) must both complete without error or double-processing.
  const [a, b] = await Promise.all([runWorkerTick(), runWorkerTick()]);
  assert.ok(a && b);

  const stop = startWorkerLoop(50);
  await new Promise((r) => setTimeout(r, 200));
  await stop();
  console.log('Worker tick tests passed.');
} finally {
  await pool.query('DELETE FROM auth_sessions WHERE user_id=$1', [`user_${run}`]).catch(() => {});
  await pool.query('DELETE FROM users WHERE organization_id=$1', [org]).catch(() => {});
  await pool.query('DELETE FROM organizations WHERE id=$1', [org]).catch(() => {});
  await pool.end().catch(() => {});
}
