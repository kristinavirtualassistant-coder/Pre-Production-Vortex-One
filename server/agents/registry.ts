/**
 * Vortex One - Dynamic Centralized Agent Registry & Capability Discovery
 */

import { AgentDefinition, AgentId } from '../../src/types';

export const DEFAULT_AGENTS: Record<string, AgentDefinition> = {
  agent_1: {
    id: 'agent_1',
    name: 'Master Control Orchestrator',
    role: 'orchestrator',
    description: 'Central multi-agent intelligence and workflow coordination layer.',
    primaryResponsibility: 'Understand intent, decompose requests, delegate tasks to specialized sub-agents, enforce QA, and synthesize results.',
    systemInstructions: 'You are Agent 1, the Master Orchestrator of Vortex One. You coordinate specialized Sub-Agents 0 through 9. You never perform specialized work alone; you assign tasks, enforce dependencies, demand QA verification from Sub-Agent 9, and ensure all claims have provenance.',
    allowedTools: ['search_property', 'search_owner', 'score_lead', 'create_crm_task', 'verify_result'],
    allowedData: ['properties', 'owners', 'leads', 'campaigns', 'workflows', 'audit_logs'],
    model: 'gemini-3.1-pro-preview',
    temperature: 0.1,
    permissions: ['all_read', 'orchestration_control', 'workflow_dispatch'],
    parentAgentId: null,
    enabled: true,
    capabilities: ['orchestration', 'task_planning', 'conflict_resolution', 'result_synthesis'],
    avatarIcon: 'BrainCircuit',
  },

  sub_agent_0: {
    id: 'sub_agent_0',
    name: 'System Intelligence Specialist',
    role: 'reasoning',
    description: 'General intelligence, hypothesis generation, and cross-domain reasoning specialist.',
    primaryResponsibility: 'Complex problem decomposition, missing information detection, and routing recommendations.',
    systemInstructions: 'You are Sub-Agent 0. You provide foundational reasoning, analyze cross-domain dependencies, and formulate hypotheses when goals require multi-domain synthesis.',
    allowedTools: ['analyze_data', 'verify_result'],
    allowedData: ['general_context', 'domain_rules'],
    model: 'gemini-3.1-pro-preview',
    temperature: 0.2,
    permissions: ['read_only'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['reasoning', 'hypothesis_generation', 'decomposition'],
    avatarIcon: 'Cpu',
  },

  sub_agent_1: {
    id: 'sub_agent_1',
    name: 'Property Intelligence Agent',
    role: 'property',
    description: 'Specialist in parcel analysis, valuation, tax history, equity, and ownership structures.',
    primaryResponsibility: 'Identify properties, calculate equity spreads, detect absentee ownership, and analyze portfolio concentrations.',
    systemInstructions: 'You are Sub-Agent 1 (Property Intelligence). You analyze real estate records for Vortex One and CMC Realty. Never fabricate property data; retain provenance for all calculations.',
    allowedTools: ['search_property', 'search_owner'],
    allowedData: ['properties', 'property_owners', 'county_records'],
    model: 'gemini-3.5-flash',
    temperature: 0.1,
    permissions: ['property_read'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['property_analysis', 'valuation_equity', 'parcel_lookup', 'portfolio_analysis'],
    avatarIcon: 'Building2',
  },

  sub_agent_2: {
    id: 'sub_agent_2',
    name: 'Lead & CRM Intelligence Agent',
    role: 'crm_lead',
    description: 'Manages lead scoring, pipeline qualification, duplicate detection, and lifecycle tracking.',
    primaryResponsibility: 'Evaluate prospect viability for property management, score leads with explainable factor breakdowns.',
    systemInstructions: 'You are Sub-Agent 2. You calculate explainable lead scores. Every score must have explicit factors and weights.',
    allowedTools: ['score_lead', 'search_owner', 'create_crm_task'],
    allowedData: ['leads', 'owners', 'crm_records'],
    model: 'gemini-3.5-flash',
    temperature: 0.1,
    permissions: ['crm_read_write'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['lead_scoring', 'lead_qualification', 'crm_management', 'duplicate_detection'],
    avatarIcon: 'UserCheck',
  },

  sub_agent_3: {
    id: 'sub_agent_3',
    name: 'Structured Research Agent',
    role: 'research',
    description: 'Performs deep public records, market research, and web grounding with strict provenance.',
    primaryResponsibility: 'Distinguish verified facts from strong indications and inferences; search public records and local market trends.',
    systemInstructions: 'You are Sub-Agent 3. Perform grounded research. Clearly tag statements as VERIFIED, STRONG_INDICATION, or INFERENCE.',
    allowedTools: ['search_property', 'search_owner'],
    allowedData: ['public_records', 'search_index'],
    model: 'gemini-3.5-flash',
    temperature: 0.2,
    permissions: ['research_tools'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['research', 'market_intelligence', 'entity_research', 'provenance_logging'],
    avatarIcon: 'Search',
  },

  sub_agent_4: {
    id: 'sub_agent_4',
    name: 'Data Enrichment & Normalization Agent',
    role: 'enrichment',
    description: 'Transforms raw records into clean structured intelligence via entity resolution and deduplication.',
    primaryResponsibility: 'Normalize addresses, phone numbers, match corporate entities to individual owners with confidence scores.',
    systemInstructions: 'You are Sub-Agent 4. Maintain the lineage: raw data -> normalized data -> enriched data -> verified data.',
    allowedTools: ['search_owner', 'search_property'],
    allowedData: ['raw_leads', 'property_owners'],
    model: 'gemini-3.1-flash-lite',
    temperature: 0.0,
    permissions: ['data_transform'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['data_enrichment', 'address_normalization', 'entity_resolution', 'deduplication'],
    avatarIcon: 'Sparkles',
  },

  sub_agent_5: {
    id: 'sub_agent_5',
    name: 'Outreach Intelligence Agent',
    role: 'outreach',
    description: 'Formulates hyper-personalized call briefs, SMS strategies, and objection handling for CMC Realty.',
    primaryResponsibility: 'Prepare tailored pitches for absentee landlords, craft value propositions, and synthesize audio call briefings.',
    systemInstructions: 'You are Sub-Agent 5 (Outreach Intelligence for CMC Realty & Property Management). Never claim to have contacted a lead prematurely; distinguish proposed vs executed actions.',
    allowedTools: ['make_call', 'generate_speech_brief', 'create_crm_task'],
    allowedData: ['leads', 'properties', 'call_scripts'],
    model: 'gemini-3.5-flash',
    temperature: 0.3,
    permissions: ['outreach_drafting', 'telephony_trigger'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['outreach_strategy', 'call_brief_generation', 'sms_drafting', 'objection_handling', 'speech_brief'],
    avatarIcon: 'PhoneCall',
  },

  sub_agent_6: {
    id: 'sub_agent_6',
    name: 'Analytics & Scoring Agent',
    role: 'analytics',
    description: 'Calculates portfolio KPIs, conversion rates, call analytics, and trend forecasting.',
    primaryResponsibility: 'Produce verifiable business intelligence and reproducible mathematical metrics for campaigns.',
    systemInstructions: 'You are Sub-Agent 6. Calculate exact metrics without inventing numbers. Every calculation must be reproducible.',
    allowedTools: ['analyze_data'],
    allowedData: ['campaigns', 'calls', 'properties', 'leads'],
    model: 'gemini-3.1-flash-lite',
    temperature: 0.0,
    permissions: ['analytics_read'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['analytics', 'kpi_calculation', 'trend_detection', 'forecasting'],
    avatarIcon: 'BarChart3',
  },

  sub_agent_7: {
    id: 'sub_agent_7',
    name: 'Compliance & Risk Review Agent',
    role: 'compliance',
    description: 'Audits operations for DNC/TCPA compliance, data privacy, and enforces human approval gating.',
    primaryResponsibility: 'Evaluate outbound campaigns for legal risk, identify actions needing human sign-off, and flag discrepancies.',
    systemInstructions: 'You are Sub-Agent 7 (Compliance & Risk). Your duty is to prevent illegal or risky actions. Require human approval for bulk operations, sensitive modifications, and external communications.',
    allowedTools: ['verify_result'],
    allowedData: ['suppression_records', 'campaigns', 'approvals'],
    model: 'gemini-3.5-flash',
    temperature: 0.0,
    permissions: ['compliance_gatekeeper'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['compliance', 'risk_assessment', 'tcpa_dnc_screening', 'human_approval_gate'],
    avatarIcon: 'ShieldAlert',
  },

  sub_agent_8: {
    id: 'sub_agent_8',
    name: 'Operational Automation Agent',
    role: 'automation',
    description: 'Executes authorized workflows across CRM, telephony, and database subsystems.',
    primaryResponsibility: 'Execute approved actions following the strict lifecycle: PROPOSED -> APPROVED -> EXECUTING -> COMPLETED.',
    systemInstructions: 'You are Sub-Agent 8. Execute only approved operations. If an operation fails, transition state to FAILED with full error diagnostic.',
    allowedTools: ['create_crm_task', 'make_call'],
    allowedData: ['crm_records', 'tasks', 'dialing_sessions'],
    model: 'gemini-3.1-flash-lite',
    temperature: 0.0,
    permissions: ['operational_execution'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['automation', 'workflow_execution', 'crm_updates', 'task_completion'],
    avatarIcon: 'Workflow',
  },

  sub_agent_9: {
    id: 'sub_agent_9',
    name: 'QA & Independent Audit Agent',
    role: 'qa_audit',
    description: 'Independent verification layer that audits agent outputs, checks arithmetic, and detects hallucinations.',
    primaryResponsibility: 'Validate all answers against the ground-truth database and return PASS, FAIL, or NEEDS_REVIEW with confidence ratings.',
    systemInstructions: 'You are Sub-Agent 9 (QA & Audit). You are independent and uncompromising. Audit all proposed results from Agent 1 and sub-agents before response delivery.',
    allowedTools: ['verify_result'],
    allowedData: ['audit_logs', 'provenance_store', 'raw_outputs'],
    model: 'gemini-3.1-pro-preview',
    temperature: 0.0,
    permissions: ['audit_inspector'],
    parentAgentId: 'agent_1',
    enabled: true,
    capabilities: ['qa_verification', 'hallucination_detection', 'provenance_audit', 'contradiction_check'],
    avatarIcon: 'CheckCheck',
  },
};

// Dynamic registry state supporting runtime agent creations
let dynamicRegistry: Record<string, AgentDefinition> = { ...DEFAULT_AGENTS };

export function getAllAgents(): AgentDefinition[] {
  return Object.values(dynamicRegistry);
}

export function getAgent(id: AgentId): AgentDefinition | undefined {
  return dynamicRegistry[id];
}

export function registerAgent(agent: AgentDefinition): AgentDefinition {
  dynamicRegistry[agent.id] = agent;
  return agent;
}

export function updateAgent(id: AgentId, updates: Partial<AgentDefinition>): AgentDefinition | null {
  if (!dynamicRegistry[id]) return null;
  dynamicRegistry[id] = { ...dynamicRegistry[id], ...updates };
  return dynamicRegistry[id];
}

export function getCapabilityMap(): Record<string, AgentId[]> {
  const map: Record<string, AgentId[]> = {};
  for (const agent of Object.values(dynamicRegistry)) {
    if (!agent.enabled) continue;
    for (const cap of agent.capabilities) {
      if (!map[cap]) map[cap] = [];
      map[cap].push(agent.id);
    }
  }
  return map;
}
