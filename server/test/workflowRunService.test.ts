import assert from 'node:assert/strict';
import { createWorkflowRun, getWorkflowRun, updateWorkflowRun } from '../services/workflowRunService';

function makePool() {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const row = {
    id: 'run_test_1',
    organization_id: 'org_test',
    workflow_id: 'wf_test',
    name: 'Test Workflow',
    status: 'running',
    current_step_id: 'step_1',
    current_step_name: 'First',
    current_agent_id: 'sub_agent_1',
    total_steps: 2,
    completed_steps: 1,
    initiated_by: 'test',
    tasks: [],
    node_states: { step_1: { status: 'completed' } },
    step_outputs: { step_1: { ok: true } },
    qa_verification: null,
    final_summary: null,
    execution_time_ms: null,
    created_at: '2026-09-24T00:00:00Z',
    completed_at: null,
  };
  return {
    queries,
    async query(sql: string, values: unknown[]) {
      queries.push({ sql, values });
      return { rows: [row], rowCount: 1 };
    },
  } as any;
}

const pool = makePool();
const run = await createWorkflowRun(pool, 'org_test', {
  run_id: 'run_test_1',
  workflow_id: 'wf_test',
  name: 'Test Workflow',
  status: 'running',
  initiated_by: 'test',
  total_steps: 2,
  completed_steps: 0,
  tasks: [],
  node_states: {},
  step_outputs: {},
  created_at: '2026-09-24T00:00:00Z',
});
assert.equal(run.run_id, 'run_test_1');
assert.match(pool.queries[0].sql, /INSERT INTO workflow_runs/);

const updated = await updateWorkflowRun(pool, 'org_test', { ...run, completed_steps: 1 });
assert.equal(updated?.completed_steps, 1);
assert.match(pool.queries[1].sql, /UPDATE workflow_runs/);

const fetched = await getWorkflowRun(pool, 'org_test', 'run_test_1');
assert.equal(fetched?.workflow_id, 'wf_test');
assert.match(pool.queries[2].sql, /SELECT \* FROM workflow_runs/);
