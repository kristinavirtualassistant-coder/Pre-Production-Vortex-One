import { getPgPool } from '../db/db';
import { executeTool, TOOLS } from '../tools';
import { createApproval } from '../services/agentOperationsService';
import { AgentDefinition } from '../../src/types';
import { generateWithAgentProvider, inferAgentProvider, AgentMessage } from './providers';
import { getAgent } from './registry';

export interface AgentRunRequest {
  organizationId: string;
  userId?: string;
  agentId: string;
  objective: string;
  context?: Record<string, any>;
  maxAttempts?: number;
}

export interface AgentRunResult {
  runId: string;
  status: 'completed' | 'awaiting_approval' | 'failed';
  finalText?: string;
  pendingApprovalId?: string;
  error?: string;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}

const DANGEROUS_TOOLS = new Set([
  'make_call',
  'create_crm_task',
  'create_lead',
  'reconcile_crm_import',
  'sync_google_drive_document',
]);

const COST_ENV: Record<string, [string, string]> = {
  openai: ['AI_AGENT_OPENAI_INPUT_USD_PER_1M', 'AI_AGENT_OPENAI_OUTPUT_USD_PER_1M'],
  anthropic: ['AI_AGENT_ANTHROPIC_INPUT_USD_PER_1M', 'AI_AGENT_ANTHROPIC_OUTPUT_USD_PER_1M'],
  gemini: ['AI_AGENT_GEMINI_INPUT_USD_PER_1M', 'AI_AGENT_GEMINI_OUTPUT_USD_PER_1M'],
};

function estimateCost(provider: string, inputTokens?: number, outputTokens?: number): number {
  const keys = COST_ENV[provider];
  if (!keys) return 0;
  const inputRate = Number(process.env[keys[0]] || 0);
  const outputRate = Number(process.env[keys[1]] || 0);
  return ((inputTokens || 0) / 1_000_000) * inputRate + ((outputTokens || 0) / 1_000_000) * outputRate;
}

function parseEnvelope(text: string): { final?: string; tool_calls?: Array<{ name: string; args?: Record<string, any> }> } {
  const cleaned = text.trim().replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\s*\`\`\`$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}
  return { final: text };
}

async function getAgentConfig(pool: any, organizationId: string, agentId: string): Promise<AgentDefinition> {
  const result = await pool.query('SELECT * FROM agent_configs WHERE id = $1 AND organization_id = $2 AND enabled = TRUE LIMIT 1', [agentId, organizationId]);
  if (result.rows.length) {
    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      description: row.description,
      primaryResponsibility: row.primary_responsibility,
      systemInstructions: row.system_instructions,
      allowedTools: row.allowed_tools || [],
      allowedData: row.allowed_data || [],
      model: row.model,
      provider: row.provider || undefined,
      temperature: Number(row.temperature ?? 0.2),
      maxTokens: row.max_tokens || 4096,
      maxRetries: row.max_retries ?? 3,
      memoryEnabled: row.memory_enabled !== false,
      permissions: row.permissions || [],
      parentAgentId: row.parent_agent_id || null,
      enabled: row.enabled,
      capabilities: row.capabilities || [],
    } as AgentDefinition;
  }
  const fallback = getAgent(agentId);
  if (!fallback) throw new Error(`Agent ${agentId} is not configured`);
  return fallback;
}

async function loadMemory(pool: any, organizationId: string, agentId: string, limit = 20): Promise<string> {
  const result = await pool.query(
    `SELECT memory_key, content FROM agent_memories
     WHERE organization_id = $1 AND agent_id = $2
     ORDER BY importance DESC, updated_at DESC LIMIT $3`,
    [organizationId, agentId, limit],
  );
  return result.rows.map((r: any) => `[${r.memory_key}] ${r.content}`).join('\n');
}

function assertToolAllowed(agent: AgentDefinition, toolName: string) {
  if (!TOOLS[toolName]) throw new Error(`Unknown agent tool: ${toolName}`);
  if (!agent.allowedTools.includes(toolName) && !agent.permissions.includes('all_tools')) {
    throw new Error(`Agent ${agent.id} is not permitted to use ${toolName}`);
  }
  const requiredPermission: Record<string, string> = {
    run_5_step_skip_trace: 'research_tools',
    search_property: 'read_only',
    search_owner: 'read_only',
    score_lead: 'read_only',
    create_crm_task: 'crm_read_write',
    create_lead: 'crm_read_write',
    reconcile_crm_import: 'crm_read_write',
    make_call: 'telephony_trigger',
  };
  const permission = requiredPermission[toolName];
  const hasPermission = permission === 'read_only'
    ? agent.permissions.includes('read_only') || agent.permissions.includes('crm_read_write') || agent.permissions.includes('research_tools') || agent.permissions.includes('all_tools')
    : !permission || agent.permissions.includes(permission) || agent.permissions.includes('all_tools');
  if (permission && !hasPermission) {
    throw new Error(`Agent ${agent.id} lacks required permission ${permission} for ${toolName}`);
  }
}

async function writeRunStep(pool: any, organizationId: string, runId: string, stepNo: number, status: string, input: any, output: any, error?: string, toolName?: string, latencyMs = 0) {
  await pool.query(
    `INSERT INTO agent_run_steps (id, organization_id, run_id, step_no, step_type, tool_name, status, input, output, error, latency_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)`,
    [`ars_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, organizationId, runId, stepNo, toolName ? 'tool' : 'model', toolName || null, status, JSON.stringify(input || {}), JSON.stringify(output || {}), error || null, latencyMs],
  );
}

function protocol(agent: AgentDefinition, memory: string, objective: string, context: Record<string, any>): string {
  return `You are Vortex One agent "${agent.name}" (${agent.id}). You are a real AI operator, not a rules engine.
Your job: ${agent.primaryResponsibility}
System instructions: ${agent.systemInstructions}
Available tools: ${agent.allowedTools.join(', ') || 'none'}.
Never invent database facts. Use tools for facts and cite tool results in your reasoning.
Human approval is required before any risky external action.
Return ONLY valid JSON with this schema:
{"final":"string","tool_calls":[{"name":"tool_name","args":{}}]}
Use tool_calls when a tool is needed. If no tool is needed, return an empty tool_calls array.
Memory:
${memory || '(none)'}
Objective:
${objective}
Context:
${JSON.stringify(context)}`;
}

export async function executeAgentRun(request: AgentRunRequest): Promise<AgentRunResult> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required for real AI agent execution');
  const agent = await getAgentConfig(pool, request.organizationId, request.agentId);
  const provider = agent.provider || inferAgentProvider(agent.model);
  const runId = `arun_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const maxAttempts = Math.min(5, Math.max(1, request.maxAttempts || agent.maxRetries || 3));
  const started = Date.now();
  let totalInput = 0;
  let totalOutput = 0;
  let totalCost = 0;
  const memory = agent.memoryEnabled === false ? '' : await loadMemory(pool, request.organizationId, agent.id);
  const messages: AgentMessage[] = [{ role: 'user', content: protocol(agent, memory, request.objective, request.context || {}) }];

  await pool.query(
    `INSERT INTO agent_runs (id, organization_id, agent_id, user_id, objective, provider, model, status, input_context, max_attempts, started_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'running',$8::jsonb,$9,CURRENT_TIMESTAMP)`,
    [runId, request.organizationId, agent.id, request.userId || null, request.objective, provider, agent.model, JSON.stringify(request.context || {}), maxAttempts],
  );

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await generateWithAgentProvider({
          provider, model: agent.model, systemInstruction: agent.systemInstructions,
          messages, temperature: agent.temperature, maxTokens: agent.maxTokens,
        });
        totalInput += result.inputTokens || 0;
        totalOutput += result.outputTokens || 0;
        totalCost += estimateCost(provider, result.inputTokens, result.outputTokens);
        await writeRunStep(pool, request.organizationId, runId, attempt, 'completed', { objective: request.objective }, { text: result.text, provider }, undefined, undefined, Date.now() - started);
        const envelope = parseEnvelope(result.text);
        const calls = Array.isArray(envelope.tool_calls) ? envelope.tool_calls : [];
        if (!calls.length) {
          const finalText = envelope.final || result.text;
          await pool.query(
            `UPDATE agent_runs SET status='completed', output=$2::jsonb, attempts=$3, input_tokens=$4, output_tokens=$5, estimated_cost_usd=$6, execution_time_ms=$7, completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$8`,
            [runId, JSON.stringify({ final: finalText }), attempt, totalInput, totalOutput, totalCost, Date.now() - started, request.organizationId],
          );
          return { runId, status:'completed', finalText, provider, model:agent.model, inputTokens:totalInput, outputTokens:totalOutput, estimatedCostUsd:totalCost };
        }

        for (const call of calls) {
          assertToolAllowed(agent, call.name);
          if (DANGEROUS_TOOLS.has(call.name) && !agent.permissions.includes('auto_execute_external')) {
            const approvalId = `approval_agent_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
            await createApproval(pool, request.organizationId, {
              approval_id: approvalId,
              action_type: `agent_tool:${call.name}`,
              description: `Agent ${agent.name} requested tool ${call.name}`,
              reason: 'Agent permission policy requires human approval before external or mutating action.',
              risk_level: 'high',
              requires_human_approval: true,
              proposed_by: agent.id,
              payload: { run_id: runId, agent_id: agent.id, tool_name: call.name, args: call.args || {} },
              status: 'pending',
              issues: [],
            });
            await pool.query(`UPDATE agent_runs SET status='awaiting_approval', pending_approval_id=$2, attempts=$3 WHERE id=$1 AND organization_id=$4`, [runId, approvalId, attempt, request.organizationId]);
            return { runId, status:'awaiting_approval', pendingApprovalId:approvalId, provider, model:agent.model, inputTokens:totalInput, outputTokens:totalOutput, estimatedCostUsd:totalCost };
          }

          const toolStart = Date.now();
          const output = await executeTool(call.name, call.args || {}, { organizationId: request.organizationId, agentId: agent.id });
          await writeRunStep(pool, request.organizationId, runId, attempt, 'completed', call.args || {}, output, undefined, call.name, Date.now() - toolStart);
          messages.push({ role:'assistant', content: JSON.stringify({ tool_call: call }) });
          messages.push({ role:'tool', name:call.name, content:JSON.stringify(output) });
        }
      } catch (error: any) {
        await writeRunStep(pool, request.organizationId, runId, attempt, 'failed', {}, {}, error?.message || String(error), undefined, Date.now() - started);
        if (attempt >= maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, Math.min(2000, attempt * 400)));
      }
    }
    throw new Error('Agent execution exhausted retries');
  } catch (error: any) {
    await pool.query(
      `UPDATE agent_runs SET status='failed', error=$2, attempts=GREATEST(attempts,1), input_tokens=$3, output_tokens=$4, estimated_cost_usd=$5, execution_time_ms=$6, completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$7`,
      [runId, error?.message || String(error), totalInput, totalOutput, totalCost, Date.now() - started, request.organizationId],
    );
    return { runId, status:'failed', error:error?.message || String(error), provider, model:agent.model, inputTokens:totalInput, outputTokens:totalOutput, estimatedCostUsd:totalCost };
  }
}

export async function listAgentRuns(organizationId: string, limit = 50): Promise<any[]> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required');
  const result = await pool.query(
    `SELECT id, agent_id, objective, provider, model, status, attempts, max_attempts, input_tokens, output_tokens, estimated_cost_usd, execution_time_ms, pending_approval_id, error, started_at, completed_at
     FROM agent_runs WHERE organization_id=$1 ORDER BY started_at DESC LIMIT $2`,
    [organizationId, Math.min(200, Math.max(1, limit))],
  );
  return result.rows;
}

export async function getAgentRun(organizationId: string, runId: string): Promise<any | null> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required');
  const run = await pool.query('SELECT * FROM agent_runs WHERE id=$1 AND organization_id=$2', [runId, organizationId]);
  if (!run.rows.length) return null;
  const steps = await pool.query('SELECT * FROM agent_run_steps WHERE run_id=$1 AND organization_id=$2 ORDER BY step_no ASC, created_at ASC', [runId, organizationId]);
  return { ...run.rows[0], steps: steps.rows };
}

export async function continueApprovedAgentRun(organizationId: string, runId: string, approvalId: string, decidedBy?: string): Promise<AgentRunResult> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required');
  const approval = await pool.query('SELECT * FROM approvals WHERE id=$1 AND organization_id=$2', [approvalId, organizationId]);
  if (!approval.rows.length) throw new Error('Approval not found');
  if (approval.rows[0].status !== 'approved' && approval.rows[0].status !== 'modified') throw new Error('Approval is not approved');
  const payload = approval.rows[0].payload || {};
  const output = await executeTool(payload.tool_name, payload.args || {}, { organizationId, agentId: payload.agent_id });
  await writeRunStep(pool, organizationId, runId, Date.now(), 'completed', payload.args || {}, output, undefined, payload.tool_name, 0);
  await pool.query(`UPDATE agent_runs SET status='running', pending_approval_id=NULL WHERE id=$1 AND organization_id=$2`, [runId, organizationId]);
  const agent = await getAgentConfig(pool, organizationId, payload.agent_id);
  const result = await generateWithAgentProvider({
    provider: agent.provider || inferAgentProvider(agent.model),
    model: agent.model,
    systemInstruction: agent.systemInstructions,
    messages: [{ role:'user', content: `The approved tool ${payload.tool_name} completed. Tool result:\n${JSON.stringify(output)}\nOriginal objective: ${(await getAgentRun(organizationId, runId))?.objective}. Return only JSON {"final":"...","tool_calls":[]} with the final answer.` }],
    temperature: agent.temperature,
    maxTokens: agent.maxTokens,
  });
  await pool.query(
    `UPDATE agent_runs SET status='completed', output=$2::jsonb, output_tokens=COALESCE(output_tokens,0)+$3, input_tokens=COALESCE(input_tokens,0)+$4, estimated_cost_usd=COALESCE(estimated_cost_usd,0)+$5, completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$6`,
    [runId, JSON.stringify({ final: parseEnvelope(result.text).final || result.text }), result.outputTokens || 0, result.inputTokens || 0, estimateCost(inferAgentProvider(agent.model), result.inputTokens, result.outputTokens), organizationId],
  );
  return { runId, status:'completed', finalText:parseEnvelope(result.text).final || result.text, provider:agent.provider || inferAgentProvider(agent.model), model:agent.model };
}
