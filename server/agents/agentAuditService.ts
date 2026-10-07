export async function auditAgentAction(pool: any, input: {
  organizationId: string; agentId: string; runId: string; toolName: string;
  action: 'requested' | 'completed' | 'failed' | 'approved' | 'rejected' | 'cancelled';
  input?: any; output?: any; error?: string; latencyMs?: number; source?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs
      (id, organization_id, agent, task_id, action, input, output, status, latency_ms, error, source)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11)`,
    [
      `audit_agent_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      input.organizationId, input.agentId, input.runId,
      `agent_tool:${input.toolName}:${input.action}`,
      JSON.stringify(input.input || {}), JSON.stringify(input.output || {}),
      input.action, input.latencyMs || 0, input.error || null,
      input.source || 'agent_runtime',
    ],
  );
}

export async function auditAgentLifecycle(pool: any, input: {
  organizationId: string; agentId: string; runId: string;
  action: 'run_started' | 'run_completed' | 'run_failed' | 'run_cancelled' | 'approval_decided' | 'memory_written';
  input?: any; output?: any; error?: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO audit_logs
      (id, organization_id, agent, task_id, action, input, output, status, error, source)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)`,
    [
      `audit_agent_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      input.organizationId, input.agentId, input.runId,
      `agent:${input.action}`, JSON.stringify(input.input || {}),
      JSON.stringify(input.output || {}), input.action, input.error || null, 'agent_runtime',
    ],
  );
}
