import type { Pool, PoolClient } from 'pg';
import type { ApprovalRequest, Task, Workflow } from '../../src/types';

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

export function mapTask(row: any): Task {
  const input = parseJson<Record<string, any>>(row.input, {});
  return {
    task_id: row.id,
    parent_task_id: row.parent_task_id ?? null,
    assigned_agent: row.assigned_agent,
    objective: row.objective,
    input,
    dependencies: parseJson<string[]>(row.dependencies, []),
    priority: row.priority,
    status: row.status,
    result: row.result ? parseJson(row.result, {}) : undefined,
    confidence: Number(row.confidence ?? 0),
    created_at: new Date(row.created_at).toISOString(),
    due_date: input.due_date,
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
    error: row.error ?? undefined,
    provenance: parseJson(row.provenance, []),
    warnings: parseJson(row.warnings, []),
    executionTimeMs: row.execution_time_ms ?? undefined,
    organization_id: row.organization_id,
  } as any;
}

export function mapWorkflow(row: any): Workflow {
  return {
    workflow_id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    steps: parseJson(row.steps, []),
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
    organization_id: row.organization_id,
  } as any;
}

export function mapApproval(row: any): ApprovalRequest {
  return {
    approval_id: row.id,
    task_id: row.task_id ?? undefined,
    workflow_run_id: row.workflow_run_id ?? undefined,
    action_type: row.action_type,
    description: row.description,
    reason: row.reason,
    risk_level: row.risk_level,
    requires_human_approval: row.requires_human_approval,
    proposed_by: row.proposed_by,
    payload: parseJson(row.payload, {}),
    status: row.status,
    issues: parseJson(row.issues, []),
    created_at: new Date(row.created_at).toISOString(),
    decided_at: row.decided_at ? new Date(row.decided_at).toISOString() : undefined,
    decided_by: row.decided_by ?? undefined,
    modifications: row.modifications ? parseJson(row.modifications, {}) : undefined,
    organization_id: row.organization_id,
  } as any;
}

async function audit(client: PoolClient, organizationId: string, action: string, input: Record<string, any>) {
  await client.query(
    `INSERT INTO audit_logs (id, organization_id, agent, action, input, status, latency_ms, created_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, 'success', 0, CURRENT_TIMESTAMP)`,
    [`audit_${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, organizationId, 'agent_1', action, JSON.stringify(input)],
  );
}

export async function listTasks(pool: Pool, organizationId: string): Promise<Task[]> {
  const { rows } = await pool.query(
    `SELECT * FROM tasks WHERE organization_id = $1 ORDER BY created_at DESC`, [organizationId],
  );
  return rows.map(mapTask);
}

export async function createTask(pool: Pool, organizationId: string, input: {
  objective: string; priority: string; due_date?: string; assigned_agent?: string; parent_task_id?: string | null;
  task_id?: string; taskInput?: Record<string, any>; dependencies?: string[];
}): Promise<Task> {
  const client = await pool.connect();
  const id = input.task_id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const taskInput = { ...(input.taskInput || {}) };
  if (input.due_date) taskInput.due_date = input.due_date;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO tasks (id, organization_id, parent_task_id, assigned_agent, objective, input, dependencies, priority, status, confidence)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, 'queued', 1.0)
       RETURNING *`,
      [id, organizationId, input.parent_task_id || null, input.assigned_agent || 'agent_1', input.objective,
        JSON.stringify(taskInput), JSON.stringify(input.dependencies || []), input.priority],
    );
    await audit(client, organizationId, 'create_task', { taskId: id, objective: input.objective, priority: input.priority });
    await client.query('COMMIT');
    return mapTask(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally { client.release(); }
}

export async function listWorkflows(pool: Pool, organizationId: string): Promise<Workflow[]> {
  const { rows } = await pool.query(`SELECT * FROM workflows WHERE organization_id = $1 ORDER BY created_at DESC`, [organizationId]);
  return rows.map(mapWorkflow);
}

export async function getWorkflow(pool: Pool, organizationId: string, id: string): Promise<Workflow | null> {
  const { rows } = await pool.query(`SELECT * FROM workflows WHERE id = $1 AND organization_id = $2`, [id, organizationId]);
  return rows.length ? mapWorkflow(rows[0]) : null;
}

export async function upsertWorkflow(pool: Pool, organizationId: string, input: any): Promise<{ workflow: Workflow; created: boolean }> {
  const client = await pool.connect();
  const id = input.workflow_id || `wf_custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const steps = Array.isArray(input.steps) ? input.steps.map((s: any, idx: number) => ({
    step_id: s.step_id || `step_${idx + 1}_${Date.now()}`,
    name: s.name || `Step ${idx + 1}`,
    type: s.type || 'SEQUENTIAL',
    assigned_agent: s.assigned_agent || 'sub_agent_1',
    objective: s.objective || 'Execute sub-agent operation',
    dependencies: Array.isArray(s.dependencies) ? s.dependencies : [],
    requiresApproval: Boolean(s.requiresApproval),
    condition: s.condition || undefined,
    retryCount: s.retryCount || 0,
  })) : [];
  try {
    await client.query('BEGIN');
    const existing = await client.query(`SELECT * FROM workflows WHERE id = $1 AND organization_id = $2 FOR UPDATE`, [id, organizationId]);
    const result = await client.query(
      `INSERT INTO workflows (id, organization_id, name, description, category, steps)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description,
         category = EXCLUDED.category, steps = EXCLUDED.steps, updated_at = CURRENT_TIMESTAMP
       WHERE workflows.organization_id = $2
       RETURNING *`,
      [id, organizationId, input.name, input.description || 'Custom defined sub-agent operation chain.', input.category || 'custom', JSON.stringify(steps)],
    );
    if (!result.rows.length) throw new Error('Workflow belongs to another organization');
    await audit(client, organizationId, existing.rows.length ? 'update_workflow' : 'create_workflow', { workflow_id: id, stepCount: steps.length });
    await client.query('COMMIT');
    return { workflow: mapWorkflow(result.rows[0]), created: existing.rows.length === 0 };
  } catch (err) {
    await client.query('ROLLBACK'); throw err;
  } finally { client.release(); }
}

export async function updateWorkflow(pool: Pool, organizationId: string, id: string, input: any): Promise<Workflow | null> {
  const existing = await getWorkflow(pool, organizationId, id);
  if (!existing) return null;
  const result = await upsertWorkflow(pool, organizationId, { ...existing, ...input, workflow_id: id });
  return result.workflow;
}

export async function deleteWorkflow(pool: Pool, organizationId: string, id: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`DELETE FROM workflows WHERE id = $1 AND organization_id = $2 RETURNING id`, [id, organizationId]);
    if (!result.rows.length) { await client.query('ROLLBACK'); return false; }
    await audit(client, organizationId, 'delete_workflow', { workflow_id: id });
    await client.query('COMMIT'); return true;
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

export async function updateTaskResult(pool: Pool, organizationId: string, task: any): Promise<Task | null> {
  const { rows } = await pool.query(
    `UPDATE tasks SET status = $1, result = $2::jsonb, confidence = $3, error = $4, execution_time_ms = $5, completed_at = $6
     WHERE id = $7 AND organization_id = $8 RETURNING *`,
    [task.status, JSON.stringify(task.result || null), Number(task.confidence || 0), task.error || null, task.executionTimeMs || null, task.completed_at || null, task.task_id, organizationId],
  );
  return rows.length ? mapTask(rows[0]) : null;
}

export async function createApproval(pool: Pool, organizationId: string, approval: any): Promise<ApprovalRequest> {
  const { rows } = await pool.query(
    `INSERT INTO approvals (id, organization_id, task_id, workflow_run_id, action_type, description, reason, risk_level, requires_human_approval, proposed_by, payload, status, issues)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13::jsonb) RETURNING *`,
    [approval.approval_id, organizationId, approval.task_id || null, approval.workflow_run_id || null, approval.action_type, approval.description, approval.reason, approval.risk_level, approval.requires_human_approval, approval.proposed_by, JSON.stringify(approval.payload || {}), approval.status, JSON.stringify(approval.issues || [])],
  );
  return mapApproval(rows[0]);
}

export async function listApprovals(pool: Pool, organizationId: string): Promise<ApprovalRequest[]> {
  const { rows } = await pool.query(`SELECT * FROM approvals WHERE organization_id = $1 ORDER BY created_at DESC`, [organizationId]);
  return rows.map(mapApproval);
}

export async function decideApproval(pool: Pool, organizationId: string, id: string, decision: string, decidedBy?: string, modifications?: Record<string, any>): Promise<ApprovalRequest | null> {
  const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : decision === 'modify' ? 'modified' : null;
  if (!status) throw new Error('Invalid approval decision');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE approvals SET status = $1, decided_at = CURRENT_TIMESTAMP, decided_by = $2, modifications = $3::jsonb
       WHERE id = $4 AND organization_id = $5 RETURNING *`,
      [status, decidedBy || 'Operations Lead', modifications ? JSON.stringify(modifications) : null, id, organizationId],
    );
    if (!result.rows.length) { await client.query('ROLLBACK'); return null; }
    await audit(client, organizationId, `human_approval_${status}`, { approval_id: id, decision });
    await client.query('COMMIT'); return mapApproval(result.rows[0]);
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}
