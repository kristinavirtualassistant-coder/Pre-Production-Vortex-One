/** Durable workflow engine against real PostgreSQL: restart persistence, approvals, retries, claims, leases. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { initializeDatabase, getPgPool } from '../db/db';
import { claimNextJob, heartbeatJob, recoverStaleJobs } from '../services/jobService';
import {
  WORKFLOW_JOB_TYPE, createWorkflowVersion, processWorkflowJob, reserveCommunication, retryWorkflowRun, runWorkflowScheduleNow, scheduleWorkflow,
} from '../services/workflowAutomationService';
import { decideApproval } from '../services/agentOperationsService';

await initializeDatabase();
const pool = getPgPool();
if (!pool) { console.log('Workflow durability tests skipped: PostgreSQL is not configured'); process.exit(0); }

const run = randomUUID().slice(0, 8);
const org = `org_wfd_${run}`;
const userId = `user_wfd_${run}`;
await pool.query('INSERT INTO organizations (id,name,slug) VALUES ($1,$2,$3)', [org, org, org]);
await pool.query("INSERT INTO users (id,organization_id,email,name,role) VALUES ($1,$2,$3,'w','admin')", [userId, org, `w.${run}@example.invalid`]);

async function publishedSchedule(name: string, steps: any[]) {
  const wfId = `wf_${name}_${run}`;
  await pool!.query('INSERT INTO workflows (id,organization_id,name,description,steps) VALUES ($1,$2,$3,$4,$5::jsonb)', [wfId, org, name, name, JSON.stringify(steps)]);
  await createWorkflowVersion(pool!, org, wfId, userId, true);
  const schedule = await scheduleWorkflow(pool!, org, wfId, userId, { name, schedule_type: 'interval', interval_seconds: 3600 });
  return { wfId, schedule };
}
async function drain(p: pg.Pool | typeof pool, worker = 'w-test') {
  let n = 0;
  for (;;) {
    const job = await claimNextJob(p as any, org, worker, [WORKFLOW_JOB_TYPE]);
    if (!job) return n;
    n += 1;
    try { await processWorkflowJob(p as any, job, worker); } catch { /* failure is persisted; keep draining */ }
  }
}
const runRow = async (id: string) => (await pool!.query('SELECT status, completed_steps, final_summary FROM workflow_runs WHERE id=$1', [id])).rows[0];

try {
  // 1) approval gate persists, survives a "restart" (brand-new connection pool), then resumes exactly once
  const gated = await publishedSchedule('gated', [
    { step_id: 's1', name: 'first', action_type: 'noop' },
    { step_id: 's2', name: 'gate', action_type: 'approval', input_mapping: { description: 'Approve outbound batch' } },
    { step_id: 's3', name: 'last', action_type: 'noop' },
  ]);
  const { runId } = await runWorkflowScheduleNow(pool, org, gated.schedule.id);
  await drain(pool);
  assert.equal((await runRow(runId)).status, 'paused_approval', 'run waits for approval');
  const approval = (await pool.query("SELECT id,status FROM approvals WHERE workflow_run_id=$1", [runId])).rows[0];
  assert.equal(approval.status, 'pending');
  assert.equal((await pool.query("SELECT 1 FROM jobs WHERE organization_id=$1 AND status IN ('queued','processing') AND payload->>'runId'=$2", [org, runId])).rowCount, 0, 'nothing is held in memory or in a live job while waiting');

  const restarted = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const decided = await decideApproval(restarted as any, org, approval.id, 'approve', userId);
    assert.equal(decided?.status, 'approved');
    await decideApproval(restarted as any, org, approval.id, 'approve', userId); // repeated decision
    assert.equal((await pool.query("SELECT 1 FROM jobs WHERE organization_id=$1 AND payload->>'runId'=$2 AND status='queued'", [org, runId])).rowCount, 1, 'exactly one resume job is queued');
    await drain(restarted);
  } finally { await restarted.end(); }
  const finished = await runRow(runId);
  assert.equal(finished.status, 'completed');
  assert.equal(Number(finished.completed_steps), 3);
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM workflow_execution_steps WHERE workflow_run_id=$1 AND status='completed'", [runId])).rows[0].n, 3, 'no step ran twice');
  console.log('  ✓ approval persists across restart and resumes exactly once');

  // 2) rejection fails the run
  const rejected = await publishedSchedule('rejected', [{ step_id: 'g', name: 'gate', action_type: 'approval' }, { step_id: 'n', name: 'after', action_type: 'noop' }]);
  const r2 = await runWorkflowScheduleNow(pool, org, rejected.schedule.id);
  await drain(pool);
  const appr2 = (await pool.query("SELECT id FROM approvals WHERE workflow_run_id=$1", [r2.runId])).rows[0];
  await decideApproval(pool, org, appr2.id, 'reject', userId);
  assert.equal((await runRow(r2.runId)).status, 'failed');
  assert.equal(await drain(pool), 0, 'no job is queued after a rejection');
  console.log('  ✓ rejected approval fails the run');

  // 3) wait step resumes through a delayed job
  const waiting = await publishedSchedule('waiting', [{ step_id: 'a', name: 'a', action_type: 'noop' }, { step_id: 'w', name: 'wait', action_type: 'wait', delay_seconds: 1 }, { step_id: 'b', name: 'b', action_type: 'noop' }]);
  const r3 = await runWorkflowScheduleNow(pool, org, waiting.schedule.id);
  await drain(pool);
  assert.equal((await runRow(r3.runId)).status, 'running', 'run is running while the wait step is pending');
  await pool.query("UPDATE jobs SET available_at=CURRENT_TIMESTAMP WHERE organization_id=$1 AND status='queued'", [org]);
  await drain(pool);
  assert.equal((await runRow(r3.runId)).status, 'completed');
  console.log('  ✓ wait step resumes and completes');

  // 4) failed step is persisted; the failed job can be retried
  const failing = await publishedSchedule('failing', [{ step_id: 'ok', name: 'ok', action_type: 'noop' }, { step_id: 'bad', name: 'bad', action_type: 'email', input_mapping: { to: 'not-an-email', subject: 's', body: 'b' } }]);
  const r4 = await runWorkflowScheduleNow(pool, org, failing.schedule.id);
  await pool.query("UPDATE jobs SET max_attempts=1 WHERE organization_id=$1 AND payload->>'runId'=$2", [org, r4.runId]);
  await drain(pool);
  assert.equal((await runRow(r4.runId)).status, 'failed');
  assert.equal((await pool.query("SELECT status FROM jobs WHERE organization_id=$1 AND payload->>'runId'=$2 ORDER BY created_at DESC LIMIT 1", [org, r4.runId])).rows[0].status, 'failed');
  assert.equal((await pool.query("SELECT status FROM workflow_execution_steps WHERE workflow_run_id=$1 AND workflow_step_id='bad'", [r4.runId])).rows[0].status, 'failed');
  const retry = await retryWorkflowRun(pool, org, r4.runId);
  assert.equal((await runRow(r4.runId)).status, 'running');
  assert.ok(retry.jobId);
  assert.equal((await pool.query("SELECT status FROM workflow_execution_steps WHERE workflow_run_id=$1 AND workflow_step_id='ok'", [r4.runId])).rows[0].status, 'completed', 'completed steps are kept and not re-run');
  console.log('  ✓ failure persisted, retry queued, completed steps preserved');

  // 5) concurrent claim: exactly one worker wins a job
  const solo = await publishedSchedule('solo', [{ step_id: 'x', name: 'x', action_type: 'noop' }]);
  await runWorkflowScheduleNow(pool, org, solo.schedule.id);
  await pool.query("DELETE FROM jobs WHERE organization_id=$1 AND status='queued' AND payload->>'scheduleId' <> $2", [org, solo.schedule.id]);
  const claims = await Promise.all(Array.from({ length: 8 }, (_, i) => claimNextJob(pool, org, `racer-${i}`, [WORKFLOW_JOB_TYPE])));
  assert.equal(claims.filter(Boolean).length, 1, 'only one of eight concurrent workers claims the job');
  console.log('  ✓ concurrent claim: one winner');

  // 6) stale lease recovery honours max_attempts; heartbeat keeps a live lease
  const leased = claims.find(Boolean)!;
  await pool.query("UPDATE jobs SET locked_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes', attempts=1, max_attempts=3 WHERE id=$1", [leased.id]);
  assert.equal(await recoverStaleJobs(pool, org, 300), 1);
  assert.equal((await pool.query('SELECT status FROM jobs WHERE id=$1', [leased.id])).rows[0].status, 'queued', 'abandoned job with attempts left is re-queued');
  await pool.query("UPDATE jobs SET status='processing', locked_by='dead', locked_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes', attempts=3, max_attempts=3 WHERE id=$1", [leased.id]);
  await recoverStaleJobs(pool, org, 300);
  assert.equal((await pool.query('SELECT status FROM jobs WHERE id=$1', [leased.id])).rows[0].status, 'failed', 'a job that used every attempt is failed, not re-queued forever');
  await pool.query("UPDATE jobs SET status='processing', locked_by='alive', locked_at = CURRENT_TIMESTAMP - INTERVAL '10 minutes' WHERE id=$1", [leased.id]);
  assert.equal(await heartbeatJob(pool, org, leased.id, 'alive'), true);
  assert.equal(await recoverStaleJobs(pool, org, 300), 0, 'a heartbeated lease is not recovered');
  assert.equal(await heartbeatJob(pool, org, leased.id, 'someone-else'), false, 'a worker that lost the lease cannot extend it');
  console.log('  ✓ stale lease recovery respects max_attempts; heartbeat extends the lease');

  // 7) communication reservation is atomic: of N concurrent workers only one may send
  const reservations = await Promise.all(Array.from({ length: 10 }, () => reserveCommunication(pool, org, runId, 'race', 'email', 'a@example.com', `race:${run}`, {})));
  assert.equal(reservations.filter((r) => r.state === 'send').length, 1, 'exactly one reservation proceeds to send');
  await pool.query("UPDATE workflow_communication_deliveries SET status='sent', provider_reference='p1' WHERE idempotency_key=$1", [`race:${run}`]);
  assert.equal((await reserveCommunication(pool, org, runId, 'race', 'email', 'a@example.com', `race:${run}`, {})).state, 'sent', 'a sent delivery is replayed, never re-sent');
  await pool.query("UPDATE workflow_communication_deliveries SET status='failed' WHERE idempotency_key=$1", [`race:${run}`]);
  assert.equal((await reserveCommunication(pool, org, runId, 'race', 'email', 'a@example.com', `race:${run}`, {})).state, 'send', 'only a definitively failed delivery may be re-reserved');
  console.log('  ✓ communication reservation is atomic and idempotent');

  console.log('Workflow durability tests passed.');
} finally {
  await pool.query('DELETE FROM approvals WHERE organization_id=$1', [org]).catch(() => {});
  await pool.query('DELETE FROM organizations WHERE id=$1', [org]).catch((e) => console.error('cleanup:', e.message));
  await pool.end().catch(() => {});
}
