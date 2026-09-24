import type { Pool } from 'pg';
import type { WorkflowRun } from '../../src/types';
import { requireOrganizationId } from './organizationContext';

function mapRun(row: any): WorkflowRun {
  return {
    run_id: row.id,
    workflow_id: row.workflow_id,
    name: row.name,
    status: row.status,
    current_step_id: row.current_step_id ?? undefined,
    current_step_name: row.current_step_name ?? undefined,
    current_agent_id: row.current_agent_id ?? undefined,
    total_steps: row.total_steps ?? 0,
    completed_steps: row.completed_steps ?? 0,
    tasks: Array.isArray(row.tasks) ? row.tasks : [],
    initiated_by: row.initiated_by,
    created_at: new Date(row.created_at).toISOString(),
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    execution_time_ms: row.execution_time_ms ?? undefined,
    final_summary: row.final_summary ?? undefined,
    node_states: row.node_states || {},
    step_outputs: row.step_outputs || {},
    qa_verification: row.qa_verification || undefined,
  };
}

export async function createWorkflowRun(pool: Pool, organizationId: string, run: WorkflowRun): Promise<WorkflowRun> {
  const orgId = requireOrganizationId(organizationId);
  const { rows } = await pool.query(
    `INSERT INTO workflow_runs
      (id, organization_id, workflow_id, name, status, current_step_id, current_step_name, current_agent_id,
       total_steps, completed_steps, initiated_by, tasks, node_states, step_outputs, qa_verification,
       final_summary, execution_time_ms, created_at, completed_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16,$17,$18,$19,CURRENT_TIMESTAMP)
     RETURNING *`,
    [
      run.run_id, orgId, run.workflow_id, run.name, run.status, run.current_step_id || null,
      run.current_step_name || null, run.current_agent_id || null, run.total_steps || 0,
      run.completed_steps || 0, run.initiated_by, JSON.stringify(run.tasks || []),
      JSON.stringify(run.node_states || {}), JSON.stringify(run.step_outputs || {}),
      JSON.stringify(run.qa_verification || null), run.final_summary || null,
      run.execution_time_ms || null, run.created_at, run.completed_at || null,
    ],
  );
  return mapRun(rows[0]);
}

export async function updateWorkflowRun(pool: Pool, organizationId: string, run: WorkflowRun): Promise<WorkflowRun | null> {
  const orgId = requireOrganizationId(organizationId);
  const { rows } = await pool.query(
    `UPDATE workflow_runs SET
      status=$1, current_step_id=$2, current_step_name=$3, current_agent_id=$4,
      total_steps=$5, completed_steps=$6, tasks=$7::jsonb, node_states=$8::jsonb,
      step_outputs=$9::jsonb, qa_verification=$10::jsonb, final_summary=$11,
      execution_time_ms=$12, completed_at=$13, updated_at=CURRENT_TIMESTAMP
     WHERE id=$14 AND organization_id=$15
     RETURNING *`,
    [
      run.status, run.current_step_id || null, run.current_step_name || null, run.current_agent_id || null,
      run.total_steps || 0, run.completed_steps || 0, JSON.stringify(run.tasks || []),
      JSON.stringify(run.node_states || {}), JSON.stringify(run.step_outputs || {}),
      JSON.stringify(run.qa_verification || null), run.final_summary || null,
      run.execution_time_ms || null, run.completed_at || null, run.run_id, orgId,
    ],
  );
  return rows[0] ? mapRun(rows[0]) : null;
}

export async function getWorkflowRun(pool: Pool, organizationId: string, runId: string): Promise<WorkflowRun | null> {
  const orgId = requireOrganizationId(organizationId);
  const { rows } = await pool.query(
    'SELECT * FROM workflow_runs WHERE id=$1 AND organization_id=$2',
    [runId, orgId],
  );
  return rows[0] ? mapRun(rows[0]) : null;
}

export async function listWorkflowRuns(
  pool: Pool,
  organizationId: string,
  options: { workflowId?: string; status?: string; limit?: number } = {},
): Promise<WorkflowRun[]> {
  const orgId = requireOrganizationId(organizationId);
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
  const values: unknown[] = [orgId];
  const filters = ['organization_id=$1'];
  if (options.workflowId) {
    values.push(options.workflowId);
    filters.push(`workflow_id=$${values.length}`);
  }
  if (options.status) {
    values.push(options.status);
    filters.push(`status=$${values.length}`);
  }
  values.push(limit);
  const { rows } = await pool.query(
    `SELECT * FROM workflow_runs WHERE ${filters.join(' AND ')}
     ORDER BY created_at DESC LIMIT $${values.length}`,
    values,
  );
  return rows.map(mapRun);
}

export async function abortWorkflowRun(pool: Pool, organizationId: string, runId: string): Promise<WorkflowRun | null> {
  const orgId = requireOrganizationId(organizationId);
  const { rows } = await pool.query(
    `UPDATE workflow_runs
     SET status='failed', final_summary=COALESCE(final_summary,'Workflow run aborted by user'),
         completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
     WHERE id=$1 AND organization_id=$2 AND status IN ('queued','running','paused_approval')
     RETURNING *`,
    [runId, orgId],
  );
  return rows[0] ? mapRun(rows[0]) : null;
}
