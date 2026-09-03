/**
 * Vortex One - Shared Core Type Definitions
 * Multi-Tenant Multi-Agent Architecture
 */

export type AgentId =
  | 'agent_1'
  | 'sub_agent_0'
  | 'sub_agent_1'
  | 'sub_agent_2'
  | 'sub_agent_3'
  | 'sub_agent_4'
  | 'sub_agent_5'
  | 'sub_agent_6'
  | 'sub_agent_7'
  | 'sub_agent_8'
  | 'sub_agent_9'
  | string;

export type AgentRole =
  | 'orchestrator'
  | 'reasoning'
  | 'property'
  | 'crm_lead'
  | 'research'
  | 'enrichment'
  | 'outreach'
  | 'analytics'
  | 'compliance'
  | 'automation'
  | 'qa_audit'
  | 'custom';

export type AgentStatus = 'idle' | 'working' | 'reviewing' | 'auditing' | 'running' | 'error' | 'disabled';

export interface AgentDefinition {
  id: AgentId;
  name: string;
  role: AgentRole;
  description: string;
  primaryResponsibility: string;
  systemInstructions: string;
  allowedTools: string[];
  allowedData: string[];
  model: string;
  temperature: number;
  maxTokens?: number;
  permissions: string[];
  parentAgentId: string | null;
  enabled: boolean;
  capabilities: string[];
  avatarIcon?: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'needs_review' | 'awaiting_approval';

export interface AgentProvenance {
  source: string;
  sourceType: 'database' | 'public_records' | 'google_search' | 'google_maps' | 'crm' | 'telephony' | 'user_input';
  retrievedAt: string;
  recordId?: string;
  confidence: number;
  hash?: string;
  verified: boolean;
}

export interface Task {
  task_id: string;
  parent_task_id: string | null;
  assigned_agent: AgentId;
  objective: string;
  input: Record<string, any>;
  dependencies: string[];
  priority: TaskPriority;
  status: TaskStatus;
  result?: Record<string, any>;
  confidence: number;
  created_at: string;
  due_date?: string;
  completed_at?: string;
  error?: string;
  provenance?: AgentProvenance[];
  warnings?: string[];
  executionTimeMs?: number;
}

export type MessageType = 'TASK' | 'RESULT' | 'QUERY' | 'CLARIFICATION' | 'ALERT' | 'VERIFICATION_REQUEST' | 'AUDIT_REPORT';

export interface AgentMessage {
  message_id: string;
  task_id: string;
  from_agent: AgentId;
  to_agent: AgentId;
  message_type: MessageType;
  objective: string;
  payload: Record<string, any>;
  required_output?: Record<string, any>;
  priority: TaskPriority;
  timestamp: string;
  status?: string;
  result?: Record<string, any>;
  confidence?: number;
  provenance?: AgentProvenance[];
  warnings?: string[];
}

export type WorkflowStepType = 'SEQUENTIAL' | 'PARALLEL' | 'CONDITIONAL' | 'RETRY' | 'WAIT' | 'HUMAN_APPROVAL' | 'ESCALATION';

export interface WorkflowStep {
  step_id: string;
  name: string;
  type: WorkflowStepType;
  assigned_agent: AgentId;
  objective: string;
  input_mapping?: Record<string, string>;
  dependencies: string[];
  requiresApproval?: boolean;
  condition?: string;
  retryCount?: number;
}

export interface Workflow {
  workflow_id: string;
  name: string;
  description: string;
  category: 'prospecting' | 'qualification' | 'outreach' | 'audit' | 'custom';
  steps: WorkflowStep[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  run_id: string;
  workflow_id: string;
  name: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'paused_approval';
  current_step_id?: string;
  current_step_name?: string;
  current_agent_id?: string;
  total_steps?: number;
  completed_steps?: number;
  tasks: Task[];
  initiated_by: string;
  created_at: string;
  completed_at?: string;
  execution_time_ms?: number;
  final_summary?: string;
  node_states?: Record<string, {
    status: 'idle' | 'running' | 'completed' | 'failed' | 'approval_required';
    executionTimeMs?: number;
    confidence?: number;
    resultSummary?: string;
    error?: string;
    startedAt?: string;
    completedAt?: string;
  }>;
  step_outputs?: Record<string, any>;
  qa_verification?: QAVerificationResult;
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface ApprovalRequest {
  approval_id: string;
  task_id?: string;
  workflow_run_id?: string;
  action_type: string;
  description: string;
  reason: string;
  risk_level: RiskLevel;
  requires_human_approval: boolean;
  proposed_by: AgentId;
  payload: Record<string, any>;
  status: ApprovalStatus;
  issues: string[];
  created_at: string;
  decided_at?: string;
  decided_by?: string;
  modifications?: Record<string, any>;
}

export interface QAVerificationResult {
  status: 'PASS' | 'FAIL' | 'NEEDS_REVIEW';
  confidence: number;
  errors: string[];
  warnings: string[];
  verification_notes: string[];
  audited_at: string;
  audited_by: AgentId;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  agent: AgentId;
  task_id?: string;
  action: string;
  input?: any;
  output?: any;
  status: 'success' | 'warning' | 'error' | 'info';
  latency_ms: number;
  error?: string;
  confidence?: number;
  source?: string;
  organization_id: string;
}

// Property & CRM Domain Types
export interface Property {
  id: string;
  organization_id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  apn: string; // Assessor's Parcel Number
  property_type: 'Single Family' | 'Multi-Family' | 'Commercial' | 'Condo' | 'Industrial' | 'Unknown';
  units_count: number;
  square_feet: number;
  year_built: number;
  estimated_value: number;
  assessed_tax_value: number;
  estimated_equity: number;
  mortgage_balance: number;
  owner_id: string;
  owner_name: string;
  is_absentee_owner: boolean;
  is_corporate_owned: boolean;
  last_sale_date?: string;
  last_sale_price?: number;
  tax_delinquent: boolean;
  provenance: AgentProvenance;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  assigned_agent?: string;
  data_quality?: 'green' | 'yellow' | 'red';
  data_quality_notes?: string;
}

export interface PropertyTagDefinition {
  name: string;
  category?: 'priority' | 'status' | 'qualification' | 'custom';
  color: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  dotClass: string;
}

export interface PropertyOwner {
  id: string;
  organization_id: string;
  name: string;
  entity_type: 'individual' | 'llc' | 'trust' | 'corporation';
  mailing_address: string;
  mailing_city: string;
  mailing_state: string;
  mailing_zip: string;
  phone_numbers: Array<{ number: string; type: 'mobile' | 'landline'; dnc_status: boolean; confidence: number }>;
  email_addresses: Array<{ email: string; verified: boolean; confidence: number }>;
  properties_owned_count: number;
  total_portfolio_value: number;
  total_portfolio_equity: number;
  notes?: string;
}

export interface LeadFactor {
  factor: string;
  impact?: number;
  score_contribution?: number;
  description?: string;
  reasoning?: string;
}

export interface LeadActivityLog {
  id: string;
  timestamp: string;
  action: string;
  agent: string;
  notes?: string;
}

export interface LeadEngagementMetrics {
  total_calls_count?: number;
  connected_calls_count?: number;
  total_talk_duration_seconds?: number;
  avg_call_duration_seconds?: number;
  recent_call_date?: string;
  call_engagement_score?: number; // 0 - 35 pts

  email_sent_count?: number;
  email_opened_count?: number;
  email_clicked_count?: number;
  email_replied_count?: number;
  recent_email_open_date?: string;
  email_engagement_score?: number; // 0 - 30 pts

  property_views_count?: number;
  gis_parcel_searches_count?: number;
  saved_searches_count?: number;
  underwriting_pdf_views_count?: number;
  recent_search_date?: string;
  property_search_score?: number; // 0 - 35 pts

  dynamic_engagement_score?: number; // 0 - 100 pts
  score_trend?: 'up' | 'down' | 'stable';
  score_delta?: number; // e.g. +14, -3
  last_recalculated_at?: string;
  recalculation_reason?: string;
  engagement_tier?: 'blazing' | 'warm' | 'nurture' | 'cold';
}

export interface LeadRecord {
  id: string;
  organization_id: string;
  owner_id: string;
  primary_property_id: string;
  property_id?: string; // Compatibility alias with relational SQL column
  owner_name: string;
  property_address: string;
  phone_number?: string;
  email?: string;
  lead_score: number;
  classification: 'high_priority' | 'medium_priority' | 'nurture' | 'disqualified';
  priority_tier?: 'high_priority' | 'medium_priority' | 'nurture' | 'disqualified';
  status?: string;
  factors: LeadFactor[];
  stage: 'identified' | 'enriched' | 'qualified' | 'outreach_ready' | 'contacted' | 'meeting_scheduled' | 'won' | 'lost';
  assigned_agent: AgentId;
  dnc_compliant: boolean;
  last_activity_date: string;
  next_recommended_action: string;
  created_at: string;
  updated_at?: string;
  data_quality?: 'green' | 'yellow' | 'red';
  data_quality_notes?: string;
  notes?: string;
  tags?: string[];
  lead_source?: string;
  disposition?: 'uncontacted' | 'interested' | 'not_interested' | 'call_back_later' | 'wrong_number' | 'do_not_call' | 'under_contract';
  estimated_equity?: number;
  estimated_value?: number;
  units_count?: number;
  property_type?: string;
  city?: string;
  activity_log?: LeadActivityLog[];
  engagement_metrics?: LeadEngagementMetrics;
}

export interface DialerCampaign {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'scheduled';
  total_contacts: number;
  dialed_count: number;
  connected_count: number;
  converted_count: number;
  target_market: string;
  telephony_provider: 'ringcentral';
  scheduled_at?: string;
  scheduled_by?: string;
  timezone?: string;
  created_at: string;
  updated_at?: string;
}

export interface DialingSession {
  id: string;
  organization_id: string;
  campaign_id: string;
  agent_user_id: string;
  status: 'active' | 'paused' | 'ended';
  started_at: string;
  ended_at?: string;
  calls_placed: number;
  contacts_reached: number;
}

export interface CallRecord {
  id: string;
  organization_id: string;
  session_id?: string;
  campaign_id?: string;
  lead_id?: string;
  telephony_call_id?: string;
  ringcentral_ringout_id?: string | number;
  telephony_session_id?: string;
  ringcentral_party_id?: string;
  contact_name: string;
  phone_number: string;
  property_address: string;
  status: 'initiated' | 'ringing' | 'in-progress' | 'connected' | 'completed' | 'voicemail' | 'no_answer' | 'busy' | 'failed';
  direction: 'outbound' | 'inbound';
  duration_seconds: number;
  disposition?: 'interested' | 'not_interested' | 'call_back_later' | 'wrong_number' | 'do_not_call';
  call_strategy_brief?: string;
  lead_source?: string;
  recording_url?: string;
  audio_tts_url?: string;
  notes?: string;
  created_at: string;
  answered_at?: string;
  ended_at?: string;
}

export interface QuickSnippet {
  id: string;
  title: string;
  content: string;
  category: 'objection' | 'info' | 'closing' | 'other';
}

export interface VoicemailFile {
  id: string;
  organization_id: string;
  label: string;
  url: string;
  created_at: string;
}

export interface DialerMetrics {
  id: string;
  organization_id: string;
  campaign_id: string;
  call_volume: number;
  success_rate: number;
  avg_talk_time: number;
  abandonment_rate?: number;
  date: string;
}

export interface OpportunityRecord {
  id: string;
  organization_id: string;
  property_id: string;
  property_address: string;
  city: string;
  owner_id: string;
  owner_name: string;
  score: number;
  priority: 'high' | 'medium' | 'low';
  signal_type: 'portfolio_growth' | 'absentee_high_equity' | 'ownership_transition' | 'tax_distress' | 'market_arbitrage';
  signal_title: string;
  why_it_matters: string;
  confidence: 'High' | 'Medium' | 'Verified';
  data_freshness: string;
  estimated_value: number;
  estimated_equity: number;
  score_components: {
    ownership: number;
    property_type: number;
    portfolio: number;
    market: number;
    signal_strength: number;
  };
  created_at: string;
}

export interface PortfolioRecord {
  id: string;
  organization_id: string;
  owner_id: string;
  owner_name: string;
  entity_type: 'individual' | 'llc' | 'trust' | 'corporation';
  property_count: number;
  markets_count: number;
  markets: string[];
  total_valuation: number;
  total_equity: number;
  total_units: number;
  opportunity_count: number;
  properties: Property[];
  top_signal: string;
}

export type InspectorContentType = 'property' | 'owner' | 'lead' | 'opportunity' | 'portfolio' | 'task';

export interface ContextInspectorState {
  isOpen: boolean;
  type: InspectorContentType;
  contentType?: InspectorContentType;
  data: any;
}

export interface SharedMemoryState {
  userContext: {
    organization_id: string;
    user_name: string;
    role: string;
    active_project: string;
  };
  taskMemory: Record<string, Task>;
  agentMemory: Record<AgentId, {
    lastAction: string;
    workingNotes: string[];
    scratchpad: Record<string, any>;
  }>;
  businessMemory: {
    client_name: string; // CMC Realty & Property Management
    objective: string;
    target_geography: string[];
    min_equity_percent: number;
    require_absentee_focus: boolean;
    compliance_rules: string[];
  };
  auditMemoryCount: number;
}

export interface DatabaseStatus {
  connected: boolean;
  type: 'postgresql' | 'in_memory';
  instance: string;
  database: string;
  appliedMigrationsCount: number;
  lastMigrationName?: string;
  error?: string;
}

export interface ValidationIssue {
  recordIndex: number;
  field?: string;
  message: string;
  type: 'error' | 'warning';
  value?: any;
}

export interface ImportAuditLog {
  id: string;
  batch_id: string;
  organization_id: string;
  source_system: string;
  status: 'success' | 'warning' | 'error';
  total_records: number;
  success_count: number;
  failure_count: number;
  suppression_count: number;
  properties_created: number;
  properties_updated: number;
  owners_created: number;
  owners_updated: number;
  leads_generated: number;
  portfolio_value_reconciled: number;
  portfolio_equity_reconciled: number;
  warnings: string[];
  errors: string[];
  validation_issues?: ValidationIssue[];
  latency_ms: number;
  timestamp: string;
}

export interface FieldMappingDefinition {
  sourceKey?: string;
  rawKey?: string;
  targetColumn?: string;
  targetField?: string;
  transformType?: 'string' | 'number' | 'boolean' | 'phone' | 'email' | 'currency';
  defaultValue?: any;
}

// Background Task Scheduler for Property Data
export interface PropertyRefreshSchedule {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  target_property_ids: string[];
  target_selection_mode: 'selected' | 'all' | 'high_equity' | 'absentee_only' | 'county_filter';
  county_filter?: string;
  interval_hours: number;
  cron_expression?: string;
  status: 'active' | 'paused' | 'running';
  last_run_at: string | null;
  next_run_at: string;
  last_run_status?: 'success' | 'warning' | 'error';
  last_run_summary?: string;
  last_run_refreshed_count?: number;
  enrichment_options: {
    refresh_tax_assessor: boolean;
    refresh_gis_geometry: boolean;
    refresh_market_valuation: boolean;
    check_absentee_status: boolean;
    verify_tcpa_dnc: boolean;
  };
  created_at: string;
  updated_at: string;
  created_by?: string;
  history?: PropertyRefreshLog[];
}

export interface PropertyRefreshLog {
  id: string;
  schedule_id: string;
  executed_at: string;
  duration_ms: number;
  properties_processed: number;
  properties_updated: number;
  status: 'success' | 'warning' | 'error';
  details: string;
  valuation_delta?: number;
  equity_delta?: number;
  errors?: string[];
}

// Outreach Template Manager Types
export type OutreachChannel = 'email' | 'sms' | 'call_script';

export type TemplateCategory =
  | 'absentee_owner'
  | 'high_equity'
  | 'property_management'
  | 'off_market_acquisition'
  | 'distressed_preforeclosure'
  | 'expired_listing'
  | 'follow_up'
  | 'tax_delinquency'
  | 'cold_outreach'
  | 'custom';

export interface TemplateVariable {
  key: string;
  label: string;
  sampleValue: string;
  category: 'owner' | 'property' | 'agent' | 'financial';
  description: string;
}

export interface OutreachTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  channel: OutreachChannel;
  category: TemplateCategory;
  subject?: string; // For Email templates
  body: string;
  variables: string[]; // List of detected variables like ['owner_name', 'property_address']
  tags: string[];
  is_default?: boolean;
  performance_metrics?: {
    usage_count: number;
    response_rate_percent?: number;
    conversion_rate_percent?: number;
    last_used_at?: string;
  };
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface TemplateRenderResult {
  template_id?: string;
  channel: OutreachChannel;
  rendered_subject?: string;
  rendered_body: string;
  resolved_variables: Record<string, string>;
  unresolved_variables: string[];
  char_count: number;
  sms_segments?: number;
}

// 5-Step Skip Trace Suite Types
export interface SkipTraceStep1_GIS {
  apn: string;
  county: string;
  state: string;
  zoning_code: string;
  parcel_acres: number;
  parcel_sqft: number;
  latitude?: number;
  longitude?: number;
  gis_source_name: string;
  gis_endpoint_url: string;
  county_gis_portal_url: string;
  verified: boolean;
}

export interface SkipTraceStep2_AssessorOwner {
  legal_owner_name: string;
  recorded_deed_date?: string;
  assessed_tax_value: number;
  assessed_land_value: number;
  assessed_improvement_value: number;
  estimated_market_value: number;
  estimated_equity: number;
  entity_type: 'individual' | 'llc' | 'trust' | 'corporation';
  tax_delinquent: boolean;
  provenance_source: string;
}

export interface SkipTraceStep3_MailingAnalysis {
  situs_address: string;
  situs_city: string;
  situs_state: string;
  situs_zip: string;
  tax_billing_address: string;
  tax_billing_city: string;
  tax_billing_state: string;
  tax_billing_zip: string;
  is_absentee: boolean;
  absentee_tier: 'Owner-Occupied' | 'In-County Absentee' | 'Out-of-County Absentee' | 'Out-of-State Absentee';
  distance_category: string;
  strategic_pitch_note: string;
}

export interface SkipTraceStep4_CorporateTrace {
  is_corporate_entity: boolean;
  entity_name: string;
  entity_type: string;
  sos_lookup_url: string;
  opencorporates_url: string;
  registered_agent_name?: string;
  registered_agent_address?: string;
  managing_members: string[];
  entity_status: 'Active / Good Standing' | 'Suspended / Inactive' | 'Not Applicable (Individual Owner)';
  filing_jurisdiction: string;
  piercing_notes: string;
}

export interface LookupPlatformLink {
  platformName:
    | 'TruePeopleSearch'
    | 'CyberBackgroundChecks'
    | 'PublicCountyRecords'
    | 'BusinessRegistries'
    | 'FastPeopleSearch'
    | 'CountyRecorder'
    | 'AssessorWebsites'
    | 'LinkedInSearch'
    | 'FacebookSearch'
    | 'Whitepages'
    | 'VoterRecords'
    | 'ThatsThem'
    | 'ZabaSearch'
    | 'AnyWho'
    | 'GoogleDork'
    | 'CaliforniaSOS';
  label: string;
  url: string;
  targetName: string;
  targetLocation: string;
  description: string;
  category?: 'directory' | 'reverse_address' | 'background' | 'corporate' | 'public_records' | 'social' | 'voter' | 'dork';
}

export interface SkipTraceStep5_ContactDiscovery {
  target_search_names: string[];
  primary_search_location: string;
  lookup_links: LookupPlatformLink[];
  existing_phones: Array<{ number: string; type: 'mobile' | 'landline'; dnc_status: boolean; confidence: number }>;
  existing_emails: Array<{ email: string; verified: boolean; confidence: number }>;
  tcpa_dnc_scrub_status: string;
}

export interface Full5StepSkipTraceResult {
  skip_trace_id: string;
  timestamp: string;
  property_id: string;
  owner_id: string;
  organization_id: string;
  address: string;
  step1_gis: SkipTraceStep1_GIS;
  step2_assessor_owner: SkipTraceStep2_AssessorOwner;
  step3_mailing_analysis: SkipTraceStep3_MailingAnalysis;
  step4_corporate_trace: SkipTraceStep4_CorporateTrace;
  step5_contact_discovery: SkipTraceStep5_ContactDiscovery;
  overall_confidence: number;
  next_recommended_actions: string[];
}

export interface AutomatedPipelineParams {
  county: string;
  city?: string;
  zip?: string;
  propertyType?: string;
  minUnits?: number;
  maxUnits?: number;
  absenteeOnly?: boolean;
  minEquity?: number;
  limit?: number;
  organizationId?: string;
  autoEnrichContacts?: boolean;
  createLeads?: boolean;
}

export interface AutomatedPipelineStepProgress {
  step: 'gis_discovery' | 'assessor_enrichment' | 'mailing_analysis' | 'corporate_piercing' | 'public_engine_lookups' | 'dnc_scrub' | 'crm_lead_creation' | 'completed';
  message: string;
  progressPercent: number;
  currentPropertyIndex: number;
  totalProperties: number;
  discoveredParcels: number;
  enrichedOwners: number;
  contactsFoundCount: number;
  dncScrubbedCount: number;
  leadsCreatedCount: number;
}

export interface AutomatedPipelineResult {
  jobId: string;
  status: 'completed' | 'failed' | 'in_progress';
  timestamp: string;
  criteria: AutomatedPipelineParams;
  totalDiscovered: number;
  totalSkipTraced: number;
  contactsFoundCount: number;
  leadsCreatedCount: number;
  dncCompliantPhoneCount: number;
  results: Array<{
    property: Property;
    owner: PropertyOwner;
    skipTrace: Full5StepSkipTraceResult;
    lead?: LeadRecord;
  }>;
}



