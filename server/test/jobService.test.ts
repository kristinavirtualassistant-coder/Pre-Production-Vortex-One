import assert from 'node:assert/strict';
import { enqueueJob, claimNextJob, completeJob, failJob } from '../services/jobService';
const seen: string[] = [];
const pool = { async query(sql: string, values: unknown[]) { seen.push(sql); if (sql.includes('RETURNING')) return { rows: [{ id:'job_1', organization_id:'org_test', job_type:'import', payload:{}, status:'processing', attempts:1, max_attempts:3 }] }; return { rows: [] }; } } as any;
const id = await enqueueJob(pool, 'org_test', 'import', { file: 'x' }); assert.ok(id.startsWith('job_'));
const job = await claimNextJob(pool, 'org_test', 'worker_1'); assert.equal(job?.status, 'processing');
await completeJob(pool, 'org_test', 'job_1', 'worker_1'); await failJob(pool, 'org_test', 'job_1', 'worker_1', 'temporary');
assert.ok(seen.some((q) => q.includes('FOR UPDATE SKIP LOCKED'))); assert.ok(seen.some((q) => q.includes("status='completed'"))); assert.ok(seen.some((q) => q.includes("status = CASE")));
console.log('job service tests passed');
