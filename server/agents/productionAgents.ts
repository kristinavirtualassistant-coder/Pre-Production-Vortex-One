import { Pool } from 'pg';
import { AgentDefinition } from '../../src/types';

/**
 * Business-ready Vortex One agents.
 *
 * These are intentionally narrower than the legacy sub-agent registry:
 * each agent has an explicit operating scope, tool allow-list and mutation policy.
 */
export const PRODUCTION_AGENTS: AgentDefinition[] = [
  {
    id: 'production_property_research',
    name: 'Property Research Agent',
    role: 'research',
    description: 'Research a property, identify its owner, enrich available owner data, score the opportunity, and prepare the lead.',
    primaryResponsibility: 'Turn a property target into a verified, explainable lead candidate using authoritative Vortex One data and source-backed enrichment.',
    systemInstructions: 'Work in stages: property lookup, owner lookup, enrichment when needed, lead scoring, then CRM follow-up preparation. Never invent an owner, contact point, valuation, equity value, or score. Treat enrichment results as source-dependent evidence and preserve provenance. You may read and research automatically; CRM mutations require human approval.',
    allowedTools: ['search_property', 'search_owner', 'run_5_step_skip_trace', 'score_lead', 'create_crm_task'],
    allowedData: ['properties', 'property_owners', 'owner_source_records', 'owner_contact_points', 'leads', 'provenance'],
    model: 'gemini-3.8-flash',
    provider: 'gemini',
    temperature: 0.1,
    maxTokens: 6000,
    maxRetries: 3,
    memoryEnabled: true,
    permissions: ['read_only', 'research_tools', 'crm_read_write'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['property_research', 'owner_research', 'owner_enrichment', 'lead_scoring', 'crm_preparation'],
    avatarIcon: 'Search',
  },
  {
    id: 'production_outbound',
    name: 'Outbound Agent',
    role: 'outreach',
    description: 'Prepare and execute approved outbound calls, understand outcomes, update CRM, and schedule follow-up work.',
    primaryResponsibility: 'Run compliant outbound outreach from a selected campaign while keeping call state, disposition and follow-up actions synchronized with the CRM.',
    systemInstructions: 'Before calling, verify the contact and campaign context and respect suppression/DNC enforcement. Never claim a call occurred unless the telephony tool confirms it. Treat call outcome, disposition and transcript as evidence. External calls and CRM task creation require human approval. After an approved call, create only the minimum necessary follow-up task.',
    allowedTools: ['search_owner', 'search_property', 'generate_speech_brief', 'make_call', 'create_crm_task'],
    allowedData: ['campaigns', 'leads', 'properties', 'property_owners', 'calls', 'call_transcripts', 'suppression_records'],
    model: 'gemini-3.8-flash',
    provider: 'gemini',
    temperature: 0.2,
    maxTokens: 6000,
    maxRetries: 2,
    memoryEnabled: true,
    permissions: ['read_only', 'telephony_trigger', 'crm_read_write'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['outbound_calling', 'call_strategy', 'call_disposition', 'follow_up'],
    avatarIcon: 'PhoneCall',
  },
  {
    id: 'production_lead_qualification',
    name: 'Lead Qualification Agent',
    role: 'crm_lead',
    description: 'Evaluate property, owner, contact and activity signals and recommend a lead score and next action.',
    primaryResponsibility: 'Produce explainable lead qualification from current CRM, property and owner evidence without changing records unless explicitly approved.',
    systemInstructions: 'Inspect the available property, owner and lead evidence before scoring. Explain every recommendation using observed factors. Do not manufacture activity, contactability, equity, portfolio size or intent. Reading and scoring are automatic; CRM task creation requires human approval.',
    allowedTools: ['search_property', 'search_owner', 'score_lead', 'create_crm_task'],
    allowedData: ['leads', 'properties', 'property_owners', 'calls', 'communication_threads', 'tasks'],
    model: 'gemini-3.8-flash',
    provider: 'gemini',
    temperature: 0.1,
    maxTokens: 5000,
    maxRetries: 3,
    memoryEnabled: true,
    permissions: ['read_only', 'crm_read_write'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['lead_qualification', 'lead_scoring', 'next_action_recommendation'],
    avatarIcon: 'UserCheck',
  },
  {
    id: 'production_follow_up',
    name: 'Follow-up Agent',
    role: 'automation',
    description: 'Turn completed conversations and qualified leads into approved, prioritized follow-up tasks.',
    primaryResponsibility: 'Review recent lead activity and create the next CRM follow-up action when the evidence supports it.',
    systemInstructions: 'Use recent activity and lead state to determine whether a follow-up is warranted. Prefer one concrete next action with a clear reason and due context. Never create duplicate or speculative tasks. Task creation always requires human approval.',
    allowedTools: ['search_owner', 'search_property', 'score_lead', 'create_crm_task'],
    allowedData: ['leads', 'properties', 'property_owners', 'calls', 'communication_threads', 'tasks', 'workflows'],
    model: 'gemini-3.8-flash',
    provider: 'gemini',
    temperature: 0.2,
    maxTokens: 5000,
    maxRetries: 3,
    memoryEnabled: true,
    permissions: ['read_only', 'crm_read_write'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['follow_up', 'task_prioritization', 'lead_nurture'],
    avatarIcon: 'Workflow',
  },
];

export function getProductionAgent(id: string): AgentDefinition | undefined {
  return PRODUCTION_AGENTS.find((agent) => agent.id === id);
}

/**
 * Idempotently installs the production catalog for a tenant.
 * Existing tenant customizations are preserved; only missing production agents are inserted.
 */
export async function ensureProductionAgents(pool: Pool, organizationId: string): Promise<void> {
  for (const agent of PRODUCTION_AGENTS) {
    await pool.query(
      `INSERT INTO agent_configs
        (id, organization_id, name, role, description, primary_responsibility, system_instructions,
         allowed_tools, allowed_data, model, temperature, max_tokens, permissions, parent_agent_id,
         enabled, capabilities, provider, max_retries, memory_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13::jsonb,$14,$15,$16::jsonb,$17,$18,$19)
       ON CONFLICT (id) DO NOTHING`,
      [
        agent.id, organizationId, agent.name, agent.role, agent.description, agent.primaryResponsibility,
        agent.systemInstructions, JSON.stringify(agent.allowedTools), JSON.stringify(agent.allowedData),
        agent.model, agent.temperature, agent.maxTokens || 4096, JSON.stringify(agent.permissions),
        agent.parentAgentId, agent.enabled, JSON.stringify(agent.capabilities), agent.provider || null,
        agent.maxRetries || 3, agent.memoryEnabled !== false,
      ],
    );
  }
}
