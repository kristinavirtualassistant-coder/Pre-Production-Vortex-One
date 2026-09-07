import assert from 'node:assert/strict';
import { createTask, listTasks, listWorkflows, getWorkflow, upsertWorkflow, deleteWorkflow, listApprovals, decideApproval } from '../services/agentOperationsService';

function makeMockPool(opts: any = {}) {
  const queries: Array<{ sql: string; values?: any[] }> = [];
  const state = {
    task: opts.task || { id: 'task_1', organization_id: 'org_a', assigned_agent: 'agent_1', objective: 'Test', input: {}, dependencies: [], priority: 'high', status: 'queued', confidence: '1', created_at: '2026-09-07T00:00:00Z', provenance: [], warnings: [] },
    workflow: opts.workflow || { id: 'wf_a', organization_id: 'org_a', name: 'WF', description: 'D', category: 'custom', steps: [], created_at: '2026-09-07T00:00:00Z', updated_at: '2026-09-07T00:00:00Z' },
    approval: opts.approval || { id: 'appr_a', organization_id: 'org_a', action_type: 'test', description: 'D', reason: 'R', risk_level: 'medium', requires_human_approval: true, proposed_by: 'agent_1', payload: {}, status: 'pending', issues: [], created_at: '2026-09-07T00:00:00Z' },
  };
  const client = {
    query: async (sql: string, values?: any[]) => {
      queries.push({ sql, values });
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (sql.includes('INSERT INTO audit_logs')) return { rows: [], rowCount: 1 };
      if (sql.includes('INSERT INTO tasks')) return { rows: [state.task], rowCount: 1 };
      if (sql.includes('SELECT * FROM workflows') && sql.includes('FOR UPDATE')) return { rows: opts.existingWorkflow === false ? [] : (opts.existingWorkflow ? [state.workflow] : []), rowCount: opts.existingWorkflow ? 1 : 0 };
      if (sql.includes('INSERT INTO workflows')) return { rows: [state.workflow], rowCount: 1 };
      if (sql.includes('DELETE FROM workflows')) return { rows: opts.deleteWorkflow === false ? [] : [{ id: state.workflow.id }], rowCount: opts.deleteWorkflow === false ? 0 : 1 };
      if (sql.includes('UPDATE approvals')) return { rows: opts.approvalMissing ? [] : [state.approval], rowCount: opts.approvalMissing ? 0 : 1 };
      return { rows: [], rowCount: 0 };
    },
    release: () => {},
  } as any;
  const pool = {
    connect: async () => client,
    query: async (sql: string, values?: any[]) => {
      queries.push({ sql, values });
      if (sql.includes('FROM tasks')) return { rows: opts.tasks || [state.task], rowCount: (opts.tasks || [state.task]).length };
      if (sql.includes('FROM workflows')) return { rows: opts.workflows || [state.workflow], rowCount: (opts.workflows || [state.workflow]).length };
      if (sql.includes('FROM approvals')) return { rows: opts.approvals || [state.approval], rowCount: (opts.approvals || [state.approval]).length };
      return { rows: [], rowCount: 0 };
    },
  } as any;
  return { pool, queries };
}

{
  const { pool, queries } = makeMockPool();
  const task = await createTask(pool, 'org_a', { objective: 'Call owner', priority: 'high', due_date: '2026-09-08T10:00:00Z' });
  assert.equal(task.task_id, 'task_1');
  const taskInsert = queries.find((q) => q.sql.includes('INSERT INTO tasks'));
  assert.match(String(taskInsert?.values?.[5]), /2026-09-08T10:00:00Z/);
  assert.equal(queries[0].sql, 'BEGIN');
  assert.equal(queries.at(-1)?.sql, 'COMMIT');
}

{
  const { pool, queries } = makeMockPool({ tasks: [{ id: 'a', organization_id: 'org_a', assigned_agent: 'agent_1', objective: 'A', input: {}, dependencies: [], priority: 'medium', status: 'queued', confidence: '1', created_at: '2026-09-07T00:00:00Z', provenance: [], warnings: [] }] });
  const tasks = await listTasks(pool, 'org_a');
  assert.equal(tasks.length, 1);
  assert.equal(queries[0].values?.[0], 'org_a');
  assert.match(queries[0].sql, /organization_id = \$1/);
}

{
  const { pool } = makeMockPool({ workflows: [] });
  assert.deepEqual(await listWorkflows(pool, 'org_a'), []);
}

{
  const { pool } = makeMockPool({ existingWorkflow: false });
  const result = await upsertWorkflow(pool, 'org_a', { workflow_id: 'wf_new', name: 'New', steps: [] });
  assert.equal(result.created, true);
}

{
  const { pool } = makeMockPool({ existingWorkflow: false });
  const workflow = await getWorkflow(pool, 'org_b', 'wf_a');
  assert.equal(workflow?.organization_id, 'org_a');
}

{
  const { pool } = makeMockPool({ deleteWorkflow: false });
  assert.equal(await deleteWorkflow(pool, 'org_b', 'wf_a'), false);
}

{
  const { pool } = makeMockPool({ approvals: [] });
  assert.deepEqual(await listApprovals(pool, 'org_a'), []);
}

{
  const { pool } = makeMockPool();
  const approval = await decideApproval(pool, 'org_a', 'appr_a', 'approve', 'user_1');
  assert.equal(approval?.approval_id, 'appr_a');
}

{
  const { pool } = makeMockPool({ approvalMissing: true });
  assert.equal(await decideApproval(pool, 'org_b', 'appr_a', 'approve', 'user_1'), null);
}

await assert.rejects(() => decideApproval(makeMockPool().pool, 'org_a', 'appr_a', 'bad'), /Invalid approval decision/);
