import { getPgPool } from '../db/db';
import { executeTool, TOOLS } from '../tools';
import { createApproval } from '../services/agentOperationsService';
import { AgentDefinition } from '../../src/types';
import { generateWithAgentProvider, inferAgentProvider, AgentMessage, AgentToolDefinition } from './providers';
import { getAgent } from './registry';
import { auditAgentAction, auditAgentLifecycle } from './agentAuditService';

export interface AgentRunRequest {
  organizationId: string;
  userId?: string;
  agentId: string;
  objective: string;
  context?: Record<string, any>;
  maxAttempts?: number;
  timeoutMs?: number;
  maxCostUsd?: number;
  idempotencyKey?: string;
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
  attempts?: number;
}

const DANGEROUS_TOOLS = new Set([
  'make_call',
  'create_crm_task',
  'create_lead',
  'enqueue_workflow',
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
  return ((inputTokens || 0) / 1_000_000) * Number(process.env[keys[0]] || 0)
    + ((outputTokens || 0) / 1_000_000) * Number(process.env[keys[1]] || 0);
}

function parseEnvelope(text: string): { final?: string; tool_calls?: Array<{ name: string; args?: Record<string, any> }>; memory_writes?: Array<{ memoryKey: string; content: string; importance?: number; sourceTool: string }> } {
  const cleaned = text.trim().replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\s*\`\`\`$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}
  return { final: text };
}

async function isRunCancelled(pool: any, organizationId: string, runId: string): Promise<boolean> {
  const result = await pool.query('SELECT status FROM agent_runs WHERE id=$1 AND organization_id=$2 LIMIT 1', [runId, organizationId]);
  return result.rows[0]?.status === 'cancelled';
}

async function persistVerifiedMemories(pool: any, organizationId: string, agentId: string, runId: string, memoryWrites: any[], completedToolNames: Set<string>): Promise<void> {
  for (const memory of memoryWrites || []) {
    if (!memory?.memoryKey || !memory?.content || !memory?.sourceTool || !completedToolNames.has(memory.sourceTool)) continue;
    const importance = Math.min(1, Math.max(0, Number(memory.importance ?? 0.7)));
    await pool.query("INSERT INTO agent_memories (id,organization_id,agent_id,memory_key,content,importance,metadata,source_run_id,source_tool,verified) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,TRUE) ON CONFLICT (organization_id,agent_id,memory_key) DO UPDATE SET content=EXCLUDED.content,importance=EXCLUDED.importance,metadata=EXCLUDED.metadata,source_run_id=EXCLUDED.source_run_id,source_tool=EXCLUDED.source_tool,verified=TRUE,updated_at=CURRENT_TIMESTAMP", ["amem_"+Date.now()+"_"+Math.random().toString(36).slice(2,8),organizationId,agentId,memory.memoryKey,memory.content,importance,JSON.stringify({provenance:'verified_tool_result'}),runId,memory.sourceTool]);
    await auditAgentLifecycle(pool, { organizationId, agentId, runId, action:'memory_written', input:{memoryKey:memory.memoryKey,sourceTool:memory.sourceTool}, output:{verified:true} });
  }
}

async function getAgentConfig(pool: any, organizationId: string, agentId: string): Promise<AgentDefinition> {
  const result = await pool.query(
    'SELECT * FROM agent_configs WHERE id=$1 AND organization_id=$2 AND enabled=TRUE LIMIT 1',
    [agentId, organizationId],
  );
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
     WHERE organization_id=$1 AND agent_id=$2
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
  const required: Record<string, string> = {
    run_5_step_skip_trace: 'research_tools',
    search_property: 'read_only',
    search_owner: 'read_only',
    score_lead: 'read_only',
    create_crm_task: 'crm_read_write',
    create_lead: 'crm_read_write',
    enqueue_workflow: 'workflow_dispatch',
    reconcile_crm_import: 'crm_read_write',
    make_call: 'telephony_trigger',
  };
  const permission = required[toolName];
  if (!permission) return;
  const allowed = permission === 'read_only'
    ? ['read_only', 'crm_read_write', 'research_tools', 'all_tools'].some((p) => agent.permissions.includes(p))
    : agent.permissions.includes(permission) || agent.permissions.includes('all_tools');
  if (!allowed) throw new Error(`Agent ${agent.id} lacks required permission ${permission} for ${toolName}`);
}

function agentToolDefinitions(agent: AgentDefinition): AgentToolDefinition[] {
  return agent.allowedTools.map((name) => TOOLS[name]).filter(Boolean).map((tool: any) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(Object.entries(tool.parameters || {}).map(([key, value]: [string, any]) => {
        if (typeof value === 'string') {
          if (value === 'object') return [key, { type: 'object', additionalProperties: true }];
          if (value === 'array') return [key, { type: 'array', items: {} }];
          return [key, { type: ['number', 'boolean'].includes(value) ? value : 'string' }];
        }
        return [key, value];
      })),
      additionalProperties: false,
    },
  }));
}

async function writeRunStep(
  pool: any, organizationId: string, runId: string, stepNo: number, status: string,
  input: any, output: any, error?: string, toolName?: string, latencyMs = 0,
) {
  await pool.query(
    `INSERT INTO agent_run_steps
      (id,organization_id,run_id,step_no,step_type,tool_name,status,input,output,error,latency_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)`,
    [
      `ars_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      organizationId, runId, stepNo, toolName ? 'tool' : 'model', toolName || null,
      status, JSON.stringify(input || {}), JSON.stringify(output || {}), error || null, latencyMs,
    ],
  );
}

function protocol(agent: AgentDefinition, memory: string, objective: string, context: Record<string, any>): string {
  return `You are Vortex One agent "${agent.name}" (${agent.id}). You are a real AI operator, not a rules engine.
Your job: ${agent.primaryResponsibility}
System instructions: ${agent.systemInstructions}
Available tools: ${agent.allowedTools.join(', ') || 'none'}.
Never invent database facts. Use tools for authoritative facts.
Human approval is required before risky external or mutating actions.
Only write memory when a completed tool result directly establishes the fact. For memory_writes, include memoryKey, content, importance, and sourceTool matching a tool you actually used.
Return ONLY JSON: {"final":"string","tool_calls":[{"name":"tool_name","args":{}}],"memory_writes":[{"memoryKey":"...","content":"...","importance":0.7,"sourceTool":"..."}]}.
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
  const maxAttempts = Math.min(5, Math.max(1, request.maxAttempts || agent.maxRetries || 3));
  const timeoutMs = Math.min(300000, Math.max(10000, request.timeoutMs || Number(process.env.AI_AGENT_TIMEOUT_MS || 120000)));
  const maxCostUsd = request.maxCostUsd ?? Number(process.env.AI_AGENT_MAX_COST_USD || 0);
  const idempotencyKey = request.idempotencyKey || `agent:${request.organizationId}:${agent.id}:${request.objective.trim().slice(0,120)}`;

  if (maxCostUsd > 0) {
    const spend = await pool.query(
      `SELECT COALESCE(SUM(estimated_cost_usd),0) AS spend FROM agent_runs
       WHERE organization_id=$1 AND started_at >= date_trunc('month',CURRENT_TIMESTAMP)`,
      [request.organizationId],
    );
    if (Number(spend.rows[0]?.spend || 0) >= maxCostUsd) {
      throw new Error(`AI agent budget exceeded for organization (limit ${maxCostUsd.toFixed(4)}).`);
    }
  }

  const existing = await pool.query(
    `SELECT id,status,output,pending_approval_id,provider,model,input_tokens,output_tokens,estimated_cost_usd
     FROM agent_runs
     WHERE organization_id=$1 AND idempotency_key=$2
     ORDER BY started_at DESC LIMIT 1`,
    [request.organizationId, idempotencyKey],
  );
  if (existing.rows.length) {
    const row = existing.rows[0];
    return {
      runId: row.id,
      status: row.status,
      finalText: row.output?.final,
      pendingApprovalId: row.pending_approval_id,
      provider: row.provider,
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      estimatedCostUsd: Number(row.estimated_cost_usd || 0),
    } as AgentRunResult;
  }

  const runId = `arun_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const started = Date.now();
  const memory = agent.memoryEnabled === false ? '' : await loadMemory(pool, request.organizationId, agent.id);
  const messages: AgentMessage[] = [{ role:'user', content:protocol(agent,memory,request.objective,request.context || {}) }];
  const tools = agentToolDefinitions(agent);
  void tools;

  try {
    await pool.query(
      `INSERT INTO agent_runs
        (id,organization_id,agent_id,user_id,objective,provider,model,status,input_context,max_attempts,idempotency_key,started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'running',$8::jsonb,$9,$10,CURRENT_TIMESTAMP)`,
      [
        runId, request.organizationId, agent.id, request.userId || null, request.objective,
        provider, agent.model, JSON.stringify({ ...(request.context || {}), idempotency_key: idempotencyKey }),
        maxAttempts, idempotencyKey,
      ],
    );
    await auditAgentLifecycle(pool, { organizationId: request.organizationId, agentId: agent.id, runId, action:'run_started', input:{objective:request.objective} });
  } catch (error:any) {
    if (error?.code !== '23505') throw error;
    const raced = await pool.query(
      `SELECT id,status,output,pending_approval_id,provider,model,input_tokens,output_tokens,estimated_cost_usd
       FROM agent_runs WHERE organization_id=$1 AND idempotency_key=$2
       ORDER BY started_at DESC LIMIT 1`,
      [request.organizationId, idempotencyKey],
    );
    if (!raced.rows.length) throw error;
    const row = raced.rows[0];
    return {
      runId: row.id,
      status: row.status,
      finalText: row.output?.final,
      pendingApprovalId: row.pending_approval_id,
      provider: row.provider,
      model: row.model,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      estimatedCostUsd: Number(row.estimated_cost_usd || 0),
    } as AgentRunResult;
  }

  let totalInput = 0;
  let totalOutput = 0;
  let totalCost = 0;

  try {
    const completedToolNames = new Set<string>();
    for (let attempt=1; attempt<=maxAttempts; attempt++) {
      try {
        if (await isRunCancelled(pool, request.organizationId, runId)) throw new Error('Agent run cancelled');
        if (Date.now()-started > timeoutMs) throw new Error(`Agent run exceeded timeout of ${timeoutMs}ms`);
        const result = await Promise.race([
          generateWithAgentProvider({
            provider, model: agent.model, systemInstruction: agent.systemInstructions,
            messages, tools, temperature: agent.temperature, maxTokens: agent.maxTokens,
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Agent provider timeout after ${timeoutMs}ms`)), timeoutMs)),
        ]);
        totalInput += result.inputTokens || 0;
        totalOutput += result.outputTokens || 0;
        totalCost += estimateCost(provider,result.inputTokens,result.outputTokens);
        if (maxCostUsd > 0 && totalCost > maxCostUsd) throw new Error(`AI agent run exceeded cost limit of ${maxCostUsd.toFixed(4)}.`);

        const envelope=parseEnvelope(result.text);
        await writeRunStep(pool,request.organizationId,runId,attempt,'completed',{objective:request.objective},{text:result.text,provider},undefined,undefined,Date.now()-started);
        const calls=result.toolCalls?.length
          ? result.toolCalls.map((call:any)=>({name:call.name,args:call.args || {},id:call.id}))
          : (Array.isArray(envelope.tool_calls)?envelope.tool_calls:[]);

        if (!calls.length) {
          const finalText=envelope.final || result.text;
          await persistVerifiedMemories(pool, request.organizationId, agent.id, runId, envelope.memory_writes || [], completedToolNames);
          await pool.query(
            `UPDATE agent_runs SET status='completed',output=$2::jsonb,attempts=$3,input_tokens=$4,output_tokens=$5,estimated_cost_usd=$6,execution_time_ms=$7,completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$8`,
            [runId,JSON.stringify({final:finalText}),attempt,totalInput,totalOutput,totalCost,Date.now()-started,request.organizationId],
          );
          await auditAgentLifecycle(pool, { organizationId: request.organizationId, agentId: agent.id, runId, action:'run_completed', output:{attempts:attempt,estimatedCostUsd:totalCost} });
          return {runId,status:'completed',finalText,provider,model:agent.model,inputTokens:totalInput,outputTokens:totalOutput,estimatedCostUsd:totalCost,attempts:attempt};
        }

        for (const call of calls) {
          assertToolAllowed(agent,call.name);
          if (DANGEROUS_TOOLS.has(call.name) && !agent.permissions.includes('auto_execute_external')) {
            const approvalId=`approval_agent_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
            await createApproval(pool,request.organizationId,{
              approval_id:approvalId,action_type:`agent_tool:${call.name}`,
              description:`Agent ${agent.name} requested tool ${call.name}`,
              reason:'Agent permission policy requires human approval before external or mutating action.',
              risk_level:'high',requires_human_approval:true,proposed_by:agent.id,
              payload:{run_id:runId,agent_id:agent.id,tool_name:call.name,args:call.args || {}},
              status:'pending',issues:[],
            });
            await pool.query(
              `UPDATE agent_runs SET status='awaiting_approval',pending_approval_id=$2,attempts=$3 WHERE id=$1 AND organization_id=$4`,
              [runId,approvalId,attempt,request.organizationId],
            );
            return {runId,status:'awaiting_approval',pendingApprovalId:approvalId,provider,model:agent.model,inputTokens:totalInput,outputTokens:totalOutput,estimatedCostUsd:totalCost,attempts:attempt};
          }

          const actionKey=`agent-action:${runId}:${call.name}:${JSON.stringify(call.args || {})}`;
          const prior=await pool.query(
            `SELECT output FROM agent_run_steps
             WHERE organization_id=$1 AND run_id=$2 AND tool_name=$3 AND status='completed'
               AND input->>'_idempotency_key'=$4 LIMIT 1`,
            [request.organizationId,runId,call.name,actionKey],
          );
          if (prior.rows.length) {
            messages.push({role:'tool',name:call.name,content:JSON.stringify(prior.rows[0].output)});
            continue;
          }

          if (await isRunCancelled(pool, request.organizationId, runId)) throw new Error('Agent run cancelled');
          const toolStart=Date.now();
          await auditAgentAction(pool, { organizationId: request.organizationId, agentId: agent.id, runId, toolName:call.name, action:'requested', input:call.args || {} });
          const output=await executeTool(call.name,{...(call.args || {}),_idempotency_key:actionKey},{organizationId:request.organizationId,agentId:agent.id});
          const toolLatency=Date.now()-toolStart;
          await writeRunStep(pool,request.organizationId,runId,attempt,'completed',{...(call.args || {}),_idempotency_key:actionKey},output,undefined,call.name,toolLatency);
          completedToolNames.add(call.name);
          await auditAgentAction(pool, { organizationId: request.organizationId, agentId: agent.id, runId, toolName:call.name, action:'completed', input:call.args || {}, output, latencyMs:toolLatency });
          messages.push({role:'assistant',content:JSON.stringify({tool_call:call})});
          messages.push({role:'tool',name:call.name,content:JSON.stringify(output)});
        }
      } catch(error:any) {
        await writeRunStep(pool,request.organizationId,runId,attempt,'failed',{}, {},error?.message || String(error),undefined,Date.now()-started);
        if(attempt>=maxAttempts) throw error;
        await new Promise(resolve=>setTimeout(resolve,Math.min(2000,attempt*400)));
      }
    }
    throw new Error('Agent execution exhausted retries');
  } catch(error:any) {
    const cancelled=error?.message === 'Agent run cancelled' || await isRunCancelled(pool, request.organizationId, runId);
    await pool.query(
      `UPDATE agent_runs SET status=$2,error=$3,attempts=GREATEST(attempts,1),input_tokens=$4,output_tokens=$5,estimated_cost_usd=$6,execution_time_ms=$7,completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$8`,
      [runId,cancelled ? 'cancelled' : 'failed',error?.message || String(error),totalInput,totalOutput,totalCost,Date.now()-started,request.organizationId],
    );
    await auditAgentLifecycle(pool, { organizationId:request.organizationId, agentId:agent.id, runId, action:cancelled ? 'run_cancelled' : 'run_failed', error:error?.message || String(error) });
    return {runId,status:'failed',error:error?.message || String(error),provider,model:agent.model,inputTokens:totalInput,outputTokens:totalOutput,estimatedCostUsd:totalCost};
  }
}

export async function cancelAgentRun(organizationId:string, runId:string, cancelledBy?:string):Promise<any> {
  const pool=getPgPool(); if(!pool) throw new Error('PostgreSQL is required');
  const current=await pool.query('SELECT id,agent_id,status FROM agent_runs WHERE id=$1 AND organization_id=$2',[runId,organizationId]);
  if(!current.rows.length) return null;
  if(['completed','failed','cancelled'].includes(current.rows[0].status)) return current.rows[0];
  const result=await pool.query(
    `UPDATE agent_runs SET status='cancelled',error='Cancelled by user',cancelled_by=$3,cancelled_at=CURRENT_TIMESTAMP,completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2 AND status IN ('running','awaiting_approval') RETURNING *`,
    [runId,organizationId,cancelledBy || null],
  );
  if(result.rows.length) await auditAgentLifecycle(pool,{organizationId,agentId:result.rows[0].agent_id,runId,action:'run_cancelled',input:{cancelledBy}});
  return result.rows[0] || current.rows[0];
}

export async function listAgentRuns(organizationId:string,limit=50):Promise<any[]> {
  const pool=getPgPool(); if(!pool) throw new Error('PostgreSQL is required');
  const result=await pool.query(
    `SELECT id,agent_id,objective,provider,model,status,attempts,max_attempts,input_tokens,output_tokens,estimated_cost_usd,execution_time_ms,pending_approval_id,error,started_at,completed_at
     FROM agent_runs WHERE organization_id=$1 ORDER BY started_at DESC LIMIT $2`,
    [organizationId,Math.min(200,Math.max(1,limit))],
  );
  return result.rows;
}

export async function getAgentRun(organizationId:string,runId:string):Promise<any|null> {
  const pool=getPgPool(); if(!pool) throw new Error('PostgreSQL is required');
  const run=await pool.query('SELECT * FROM agent_runs WHERE id=$1 AND organization_id=$2',[runId,organizationId]);
  if(!run.rows.length) return null;
  const steps=await pool.query('SELECT * FROM agent_run_steps WHERE run_id=$1 AND organization_id=$2 ORDER BY step_no ASC,created_at ASC',[runId,organizationId]);
  return {...run.rows[0],steps:steps.rows};
}

export async function continueApprovedAgentRun(organizationId:string,runId:string,approvalId:string,decidedBy?:string):Promise<AgentRunResult> {
  const pool=getPgPool(); if(!pool) throw new Error('PostgreSQL is required');
  const approval=await pool.query('SELECT * FROM approvals WHERE id=$1 AND organization_id=$2',[approvalId,organizationId]);
  if(!approval.rows.length) throw new Error('Approval not found');
  if(!['approved','modified'].includes(approval.rows[0].status)) throw new Error('Approval is not approved');
  const approvalRow=approval.rows[0];
  const payload=approvalRow.payload || {};
  await auditAgentLifecycle(pool, { organizationId, agentId:payload.agent_id, runId, action:'approval_decided', input:{approvalId,decision:approvalRow.status,decidedBy} });
  const actionKey=`agent-action:${runId}:${payload.tool_name}:${JSON.stringify(payload.args || {})}`;
  const prior=await pool.query(
    `SELECT output FROM agent_run_steps WHERE organization_id=$1 AND run_id=$2 AND tool_name=$3 AND status='completed' AND input->>'_idempotency_key'=$4 LIMIT 1`,
    [organizationId,runId,payload.tool_name,actionKey],
  );
  let output:any;
  if(prior.rows.length) output=prior.rows[0].output;
  else {
    await auditAgentAction(pool,{organizationId,agentId:payload.agent_id,runId,toolName:payload.tool_name,action:'requested',input:payload.args || {},source:'approval'});
    const approvalToolStart=Date.now();
    output=await executeTool(payload.tool_name,{...(payload.args || {}),_idempotency_key:actionKey},{organizationId,agentId:payload.agent_id});
    const approvalToolLatency=Date.now()-approvalToolStart;
    await writeRunStep(pool,organizationId,runId,Date.now(),'completed',{...(payload.args || {}),_idempotency_key:actionKey},output,undefined,payload.tool_name,approvalToolLatency);
    await auditAgentAction(pool,{organizationId,agentId:payload.agent_id,runId,toolName:payload.tool_name,action:'completed',input:payload.args || {},output,latencyMs:approvalToolLatency,source:'approval'});
  }
  await pool.query(`UPDATE agent_runs SET status='running',pending_approval_id=NULL WHERE id=$1 AND organization_id=$2`,[runId,organizationId]);
  const agent=await getAgentConfig(pool,organizationId,payload.agent_id);
  const provider=agent.provider || inferAgentProvider(agent.model);
  const result=await generateWithAgentProvider({
    provider,model:agent.model,systemInstruction:agent.systemInstructions,
    messages:[{role:'user',content:`The approved tool ${payload.tool_name} completed. Tool result:\n${JSON.stringify(output)}\nOriginal objective: ${(await getAgentRun(organizationId,runId))?.objective}. Return only JSON {"final":"...","tool_calls":[]}.`}],
    temperature:agent.temperature,maxTokens:agent.maxTokens,tools:agentToolDefinitions(agent),
  });
  await pool.query(
    `UPDATE agent_runs SET status='completed',output=$2::jsonb,output_tokens=COALESCE(output_tokens,0)+$3,input_tokens=COALESCE(input_tokens,0)+$4,estimated_cost_usd=COALESCE(estimated_cost_usd,0)+$5,completed_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$6`,
    [runId,JSON.stringify({final:parseEnvelope(result.text).final || result.text}),result.outputTokens || 0,result.inputTokens || 0,estimateCost(provider,result.inputTokens,result.outputTokens),organizationId],
  );
  return {runId,status:'completed',finalText:parseEnvelope(result.text).final || result.text,provider,model:agent.model};
}
