import assert from 'node:assert/strict';
import { claimDuePropertyRefreshSchedule, listDuePropertyRefreshSchedules, updateScheduleAfterRun } from '../services/propertyRefreshScheduler';

const queries: Array<{ sql: string; values: unknown[] }> = [];
const pool = {
  async query(sql: string, values: unknown[] = []) {
    queries.push({ sql, values });
    if (sql.includes('RETURNING s.*')) return { rows: [{ id: 'sched_1', organization_id: 'org_test', target_property_ids: ['prop_1'], interval_hours: '24', enrichment_options: {} }] };
    if (sql.includes('SELECT *')) return { rows: [{ id: 'sched_2', organization_id: 'org_test', target_property_ids: ['prop_2'], interval_hours: '12', enrichment_options: {} }] };
    return { rows: [], rowCount: 1 };
  },
} as any;

const due = await listDuePropertyRefreshSchedules(pool, 5);
assert.equal(due[0]?.interval_hours, 12);
const claimed = await claimDuePropertyRefreshSchedule(pool, 'worker_1');
assert.equal(claimed?.status, undefined);
await updateScheduleAfterRun(pool, 'sched_1', 'org_test', {
  status: 'active', lastRunAt: new Date(), nextRunAt: new Date(Date.now() + 86400000),
  lastRunStatus: 'success', lastRunSummary: 'ok', lastRunRefreshedCount: 1,
});
assert.match(queries[0].sql, /next_run_at <= CURRENT_TIMESTAMP/);
assert.match(queries[0].sql, /status = 'running'/);
assert.match(queries[1].sql, /FOR UPDATE SKIP LOCKED/);
assert.match(queries[1].sql, /SET status = 'running'/);
assert.match(queries[2].sql, /WHERE id = \$7 AND organization_id = \$8/);
console.log('property refresh scheduler tests passed');
