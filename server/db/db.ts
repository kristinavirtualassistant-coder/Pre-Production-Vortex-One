/**
 * Vortex One - Database Layer with Cloud SQL / PostgreSQL Support & In-Memory Store
 */

import { Pool, PoolClient } from 'pg';
import { MIGRATIONS } from './migrations';
import type { CampaignContactRecord } from '../dialer/types';
import {
  Property,
  PropertyOwner,
  LeadRecord,
  DialerCampaign,
  DialingSession,
  CallRecord,
  AgentDefinition,
  Task,
  Workflow,
  WorkflowRun,
  ApprovalRequest,
  AuditLogEntry,
  PropertyRefreshSchedule,
  PropertyRefreshLog,
  OutreachTemplate,
} from '../../src/types';

export interface DatabaseStatus {
  connected: boolean;
  type: 'postgresql' | 'in_memory';
  instance: string;
  database: string;
  appliedMigrationsCount: number;
  lastMigrationName?: string;
  error?: string;
}

let pgPool: Pool | null = null;
let currentDbStatus: DatabaseStatus = {
  connected: false,
  type: 'in_memory',
  instance: process.env.CLOUD_SQL_CONNECTION_NAME || 'vortex-one:us-central1:vortex-one-instance',
  database: process.env.DB_NAME || 'vortex-one-database',
  appliedMigrationsCount: 5,
  lastMigrationName: '005_add_properties_unique_constraint',
};

// In-memory persistent collections (synchronized across app execution)
export const inMemoryStore = {
  organizations: [
    {
      id: 'org_cmc_realty',
      name: 'CMC Realty & Property Management',
      slug: 'cmc-realty',
      settings: { timezone: 'America/Los_Angeles', targetMarket: 'Orange County, CA' },
    },
  ],
  properties: [] as Property[],
  propertyOwners: [] as PropertyOwner[],
  leads: [] as LeadRecord[],
  campaigns: [] as DialerCampaign[],
  campaignContacts: [] as CampaignContactRecord[],
  sessions: [] as DialingSession[],
  calls: [] as CallRecord[],
  agentConfigs: [] as AgentDefinition[],
  tasks: [] as Task[],
  workflows: [] as Workflow[],
  runs: [] as WorkflowRun[],
  approvals: [] as ApprovalRequest[],
  auditLogs: [] as AuditLogEntry[],
  suppressionRecords: [] as Array<{ id: string; phone_number: string; reason: string; suppressed_at: string }>,
  smartForwarding: {
    enabled: false,
    rules: [] as Array<{ leadSource: string; extension: string }>,
  },
  propertyRefreshSchedules: [] as PropertyRefreshSchedule[],
  propertyRefreshLogs: [] as PropertyRefreshLog[],
  outreachTemplates: [] as OutreachTemplate[],
};

/**
 * Seed realistic property, lead, and CRM data tailored for CMC Realty & Property Management
 */
export function seedInitialData() {
  const orgId = 'org_cmc_realty';

  // Seed Owners
  const owners: PropertyOwner[] = [
    {
      id: 'owner_101',
      organization_id: orgId,
      name: 'Sterling West Holdings LLC',
      entity_type: 'llc',
      mailing_address: '9400 Wilshire Blvd, Suite 1200',
      mailing_city: 'Beverly Hills',
      mailing_state: 'CA',
      mailing_zip: '90212',
      phone_numbers: [
        { number: '(949) 555-0182', type: 'mobile', dnc_status: false, confidence: 0.96 },
        { number: '(310) 555-4921', type: 'landline', dnc_status: false, confidence: 0.88 },
      ],
      email_addresses: [
        { email: 'mgmt@sterlingwestholdings.com', verified: true, confidence: 0.92 },
      ],
      properties_owned_count: 4,
      total_portfolio_value: 6850000,
      total_portfolio_equity: 4200000,
      notes: 'Out-of-area managing member. High potential for full-service commercial & multi-family management.',
    },
    {
      id: 'owner_102',
      organization_id: orgId,
      name: 'Marcus & Eleanor Vance',
      entity_type: 'individual',
      mailing_address: '412 Ocean Blvd',
      mailing_city: 'Corona Del Mar',
      mailing_state: 'CA',
      mailing_zip: '92625',
      phone_numbers: [
        { number: '(949) 555-7341', type: 'mobile', dnc_status: false, confidence: 0.94 },
      ],
      email_addresses: [
        { email: 'mvance.properties@gmail.com', verified: true, confidence: 0.95 },
      ],
      properties_owned_count: 3,
      total_portfolio_value: 4120000,
      total_portfolio_equity: 2950000,
      notes: 'Self-managing triplex & duplexes in Costa Mesa. Tired landlord indicators observed.',
    },
    {
      id: 'owner_103',
      organization_id: orgId,
      name: 'Pacific Heritage Trust',
      entity_type: 'trust',
      mailing_address: '777 South Figueroa St, 32nd Fl',
      mailing_city: 'Los Angeles',
      mailing_state: 'CA',
      mailing_zip: '90017',
      phone_numbers: [
        { number: '(714) 555-9203', type: 'landline', dnc_status: false, confidence: 0.85 },
      ],
      email_addresses: [
        { email: 'trustee@pacificheritagetrust.org', verified: true, confidence: 0.89 },
      ],
      properties_owned_count: 5,
      total_portfolio_value: 9400000,
      total_portfolio_equity: 7100000,
      notes: 'Estate trust with absentee beneficiary. Low maintenance velocity reported.',
    },
    {
      id: 'owner_104',
      organization_id: orgId,
      name: 'David K. Tanaka',
      entity_type: 'individual',
      mailing_address: '1888 Greenbrae St',
      mailing_city: 'Honolulu',
      mailing_state: 'HI',
      mailing_zip: '96816',
      phone_numbers: [
        { number: '(808) 555-2391', type: 'mobile', dnc_status: false, confidence: 0.91 },
      ],
      email_addresses: [
        { email: 'david.tanaka.investments@outlook.com', verified: false, confidence: 0.78 },
      ],
      properties_owned_count: 2,
      total_portfolio_value: 2890000,
      total_portfolio_equity: 1950000,
      notes: 'Out-of-state owner (Hawaii). Inherited multi-family 4-plex in Santa Ana.',
    },
  ];

  // Seed Properties
  const properties: Property[] = [
    {
      id: 'prop_201',
      organization_id: orgId,
      address: '1420 Newport Blvd',
      city: 'Costa Mesa',
      state: 'CA',
      zip: '92627',
      county: 'Orange County',
      apn: '423-112-09',
      property_type: 'Multi-Family',
      units_count: 6,
      square_feet: 5800,
      year_built: 1986,
      estimated_value: 2650000,
      assessed_tax_value: 1720000,
      estimated_equity: 1800000,
      mortgage_balance: 850000,
      owner_id: 'owner_101',
      owner_name: 'Sterling West Holdings LLC',
      is_absentee_owner: true,
      is_corporate_owned: true,
      tax_delinquent: false,
      last_sale_date: '2016-04-12',
      last_sale_price: 1850000,
      tags: ['Hot Lead', 'High Equity'],
      provenance: {
        source: 'Orange County Assessor & Title Records',
        sourceType: 'public_records',
        retrievedAt: '2026-08-20T10:15:00Z',
        recordId: 'APN-423-112-09',
        confidence: 0.98,
        hash: 'sha256-a9b8c7e1f230',
        verified: true,
      },
    },
    {
      id: 'prop_202',
      organization_id: orgId,
      address: '2840 Harbor Blvd',
      city: 'Costa Mesa',
      state: 'CA',
      zip: '92626',
      county: 'Orange County',
      apn: '424-081-14',
      property_type: 'Commercial',
      units_count: 4,
      square_feet: 7200,
      year_built: 1994,
      estimated_value: 4200000,
      assessed_tax_value: 3100000,
      estimated_equity: 2400000,
      mortgage_balance: 1800000,
      owner_id: 'owner_101',
      owner_name: 'Sterling West Holdings LLC',
      is_absentee_owner: true,
      is_corporate_owned: true,
      tax_delinquent: false,
      last_sale_date: '2018-09-22',
      last_sale_price: 3400000,
      tags: ['Research Required', 'Commercial Target'],
      provenance: {
        source: 'CoStar / Orange County GIS Database',
        sourceType: 'database',
        retrievedAt: '2026-08-21T14:30:00Z',
        recordId: 'APN-424-081-14',
        confidence: 0.96,
        hash: 'sha256-55cc89aa10ff',
        verified: true,
      },
    },
    {
      id: 'prop_203',
      organization_id: orgId,
      address: '385 17th St',
      city: 'Costa Mesa',
      state: 'CA',
      zip: '92627',
      county: 'Orange County',
      apn: '425-331-02',
      property_type: 'Multi-Family',
      units_count: 3,
      square_feet: 3100,
      year_built: 1978,
      estimated_value: 1980000,
      assessed_tax_value: 1100000,
      estimated_equity: 1450000,
      mortgage_balance: 530000,
      owner_id: 'owner_102',
      owner_name: 'Marcus & Eleanor Vance',
      is_absentee_owner: true,
      is_corporate_owned: false,
      tax_delinquent: false,
      last_sale_date: '2012-07-15',
      last_sale_price: 980000,
      tags: ['Qualified'],
      provenance: {
        source: 'First American Title / Property Intelligence Engine',
        sourceType: 'database',
        retrievedAt: '2026-08-22T09:00:00Z',
        recordId: 'APN-425-331-02',
        confidence: 0.97,
        hash: 'sha256-880011bbef33',
        verified: true,
      },
    },
    {
      id: 'prop_204',
      organization_id: orgId,
      address: '1102 N Main St',
      city: 'Santa Ana',
      state: 'CA',
      zip: '92701',
      county: 'Orange County',
      apn: '398-204-18',
      property_type: 'Multi-Family',
      units_count: 4,
      square_feet: 4200,
      year_built: 1982,
      estimated_value: 1750000,
      assessed_tax_value: 890000,
      estimated_equity: 1250000,
      mortgage_balance: 500000,
      owner_id: 'owner_104',
      owner_name: 'David K. Tanaka',
      is_absentee_owner: true,
      is_corporate_owned: false,
      tax_delinquent: false,
      last_sale_date: '2008-01-10',
      last_sale_price: 720000,
      tags: ['Hot Lead', 'Absentee Landlord'],
      provenance: {
        source: 'California Department of Real Estate / County Recorder',
        sourceType: 'public_records',
        retrievedAt: '2026-08-24T11:45:00Z',
        recordId: 'APN-398-204-18',
        confidence: 0.99,
        hash: 'sha256-ee3300449911',
        verified: true,
      },
    },
  ];

  // Seed Leads with Explainable Factors
  const leads: LeadRecord[] = [
    {
      id: 'lead_301',
      organization_id: orgId,
      owner_id: 'owner_101',
      primary_property_id: 'prop_201',
      owner_name: 'Sterling West Holdings LLC',
      property_address: '1420 Newport Blvd, Costa Mesa, CA',
      lead_score: 94,
      classification: 'high_priority',
      factors: [
        { factor: 'multiple_owned_properties', impact: 25, description: 'Owns 4 commercial & multi-family properties in OC' },
        { factor: 'out_of_area_absentee_owner', impact: 25, description: 'Owner mailing address in Beverly Hills (45+ miles away)' },
        { factor: 'substantial_equity_spread', impact: 20, description: 'Over $4.2M estimated portfolio equity' },
        { factor: 'corporate_entity_structure', impact: 15, description: 'LLC structure indicates professional investment vehicle' },
        { factor: 'verified_direct_contact', impact: 9, description: 'Direct mobile phone and corporate email verified' },
      ],
      stage: 'outreach_ready',
      assigned_agent: 'sub_agent_2',
      dnc_compliant: true,
      last_activity_date: new Date().toISOString(),
      next_recommended_action: 'Trigger Sub-Agent 5 (Outreach) to generate multi-family management proposal & brief.',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'lead_302',
      organization_id: orgId,
      owner_id: 'owner_104',
      primary_property_id: 'prop_204',
      owner_name: 'David K. Tanaka',
      property_address: '1102 N Main St, Santa Ana, CA',
      lead_score: 89,
      classification: 'high_priority',
      factors: [
        { factor: 'out_of_state_absentee_owner', impact: 35, description: 'Owner located in Honolulu, Hawaii' },
        { factor: 'aging_asset_maintenance', impact: 20, description: 'Built in 1982 with 4 residential units' },
        { factor: 'long_tenure_low_debt', impact: 20, description: 'Held for 18 years, high equity position ($1.25M)' },
        { factor: 'single_point_of_contact', impact: 14, description: 'Direct mobile phone verified via SkipTrace' },
      ],
      stage: 'qualified',
      assigned_agent: 'sub_agent_2',
      dnc_compliant: true,
      last_activity_date: new Date().toISOString(),
      next_recommended_action: 'Initiate absentee owner personalized management call brief targeting Hawaii time zone.',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'lead_303',
      organization_id: orgId,
      owner_id: 'owner_102',
      primary_property_id: 'prop_203',
      owner_name: 'Marcus & Eleanor Vance',
      property_address: '385 17th St, Costa Mesa, CA',
      lead_score: 82,
      classification: 'high_priority',
      factors: [
        { factor: 'multiple_coastal_units', impact: 25, description: 'Triplex in prime 17th St corridor Costa Mesa' },
        { factor: 'high_equity_ratio', impact: 25, description: '73% equity ratio ($1.45M equity on $1.98M value)' },
        { factor: 'self_managed_fatigue', impact: 20, description: 'Owner occupied primary home elsewhere in Corona Del Mar' },
        { factor: 'strong_rental_demand', impact: 12, description: 'Current market rent spread is 18% above historical leases' },
      ],
      stage: 'enriched',
      assigned_agent: 'sub_agent_2',
      dnc_compliant: true,
      last_activity_date: new Date().toISOString(),
      next_recommended_action: 'Generate comparative rental yield analysis for 17th St triplex.',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  // Seed Campaigns
  const campaigns: DialerCampaign[] = [
    {
      id: 'camp_401',
      organization_id: orgId,
      name: 'Orange County Absentee Multi-Family Owners Q3',
      description: 'Targeting 2-10 unit property owners with >$1M equity and out-of-area mailing addresses for CMC Management services.',
      status: 'active',
      target_market: 'Orange County, CA',
      telephony_provider: 'ringcentral',
      total_contacts: 48,
      dialed_count: 14,
      connected_count: 8,
      converted_count: 3,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'camp_402',
      organization_id: orgId,
      name: 'High-Equity Commercial Portfolio Landlords',
      description: 'Outreach to LLC and Trust owned commercial assets along Newport & Harbor corridors.',
      status: 'active',
      target_market: 'Costa Mesa & Newport Beach, CA',
      telephony_provider: 'ringcentral',
      total_contacts: 26,
      dialed_count: 6,
      connected_count: 4,
      converted_count: 2,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ];

  // Seed Calls
  const calls: CallRecord[] = [
    {
      id: 'call_501',
      organization_id: orgId,
      campaign_id: 'camp_401',
      contact_name: 'Sterling West Holdings LLC (Rep: Jonathan Sterling)',
      phone_number: '(949) 555-0182',
      property_address: '1420 Newport Blvd, Costa Mesa, CA',
      status: 'completed',
      direction: 'outbound',
      duration_seconds: 184,
      disposition: 'interested',
      call_strategy_brief: 'Lead owns 6-unit multi-family on Newport Blvd with remote management from Beverly Hills. Highlighted CMC 24/7 maintenance response and local Costa Mesa team.',
      notes: 'Jonathan confirmed current manager has delayed tenant turnovers. Requested a formal management proposal and fee schedule sent to mgmt@sterlingwestholdings.com.',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
    {
      id: 'call_502',
      organization_id: orgId,
      campaign_id: 'camp_401',
      contact_name: 'David K. Tanaka',
      phone_number: '(808) 555-2391',
      property_address: '1102 N Main St, Santa Ana, CA',
      status: 'completed',
      direction: 'outbound',
      duration_seconds: 96,
      disposition: 'call_back_later',
      call_strategy_brief: 'Owner lives in Honolulu. Highlighted remote owner portal, monthly direct deposit, and routine quarterly inspections.',
      notes: 'Currently traveling. Asked to follow up next Tuesday morning PST.',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
  ];

  // Seed Pending Approvals
  const approvals: ApprovalRequest[] = [
    {
      approval_id: 'appr_601',
      task_id: 'task_auto_801',
      action_type: 'bulk_sms_outreach',
      description: 'Send personalized SMS follow-up sequence to 12 qualified absentee landlords in Costa Mesa.',
      reason: 'Bulk outbound communication to high-value portfolio prospects.',
      risk_level: 'medium',
      requires_human_approval: true,
      proposed_by: 'sub_agent_5',
      payload: {
        template: 'Hi {Owner_Name}, CMC Realty is offering comprehensive local property management for your {Property_Address} property with 0% vacancy guarantee.',
        contactCount: 12,
        market: 'Costa Mesa, CA',
      },
      status: 'pending',
      issues: ['Requires marketing message compliance verification and sender number verification.'],
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
  ];

  // Seed Production Workflows
  const workflows: Workflow[] = [
    {
      workflow_id: 'wf_01',
      name: 'End-to-End Absentee Portfolio Prospecting DAG',
      description: 'Sequential & Parallel pipeline extracting parcels, normalizing owner entities, scoring management viability, crafting pitch briefs, and auditing with Sub-Agent 9.',
      category: 'prospecting',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      steps: [
        {
          step_id: 'step_1_prop',
          name: 'County Cadastral Parcel Discovery',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_1',
          objective: 'Find multi-family and commercial properties in Orange County with >$1M equity and absentee ownership.',
          dependencies: [],
          requiresApproval: false,
        },
        {
          step_id: 'step_2_norm',
          name: 'Entity & Address Resolution',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_4',
          objective: 'Resolve corporate LLC/Trust ownership records and normalize postal delivery addresses.',
          dependencies: ['step_1_prop'],
          requiresApproval: false,
        },
        {
          step_id: 'step_3_score',
          name: 'Explainable Viability Scoring',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_2',
          objective: 'Calculate 0-100 property management prospect scores with explainable weighted factor breakdowns.',
          dependencies: ['step_2_norm'],
          requiresApproval: false,
        },
        {
          step_id: 'step_4_pitch',
          name: 'Hyper-Personalized Call Pitch Formulation',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_5',
          objective: 'Synthesize custom objection counters, local market rent roll briefs, and owner pitch strategy.',
          dependencies: ['step_3_score'],
          requiresApproval: false,
        },
        {
          step_id: 'step_5_tcpa',
          name: 'TCPA & DNC Legal Compliance Audit',
          type: 'CONDITIONAL',
          assigned_agent: 'sub_agent_7',
          objective: 'Verify National DNC registry and TCPA calling hour constraints before outbound campaign inclusion.',
          dependencies: ['step_4_pitch'],
          requiresApproval: true,
        },
        {
          step_id: 'step_6_qa',
          name: 'Independent QA & Hallucination Audit',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_9',
          objective: 'Perform independent mathematical validation and factual provenance check across all extracted data.',
          dependencies: ['step_5_tcpa'],
          requiresApproval: false,
        },
      ],
    },
    {
      workflow_id: 'wf_02',
      name: 'High-Touch Executive Outbound Briefing & TTS Pipeline',
      description: 'Generates specialized executive call scripts, market comparables, and synthesized voice briefing for top-tier prospects.',
      category: 'outreach',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 7200000).toISOString(),
      steps: [
        {
          step_id: 'step_exec_1',
          name: 'High-Equity Lead Profile Lookup',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_2',
          objective: 'Lookup high-priority qualified lead profile and ownership portfolio holdings for Jonathan Sterling.',
          dependencies: [],
          requiresApproval: false,
        },
        {
          step_id: 'step_exec_2',
          name: 'Public Records & Market Research',
          type: 'PARALLEL',
          assigned_agent: 'sub_agent_3',
          objective: 'Extract recent comparable commercial lease rates along Newport Blvd corridor.',
          dependencies: ['step_exec_1'],
          requiresApproval: false,
        },
        {
          step_id: 'step_exec_3',
          name: 'Audio Strategy Briefing & TTS Synthesis',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_5',
          objective: 'Craft high-converting executive pitch script and generate audio voice briefing using Gemini TTS.',
          dependencies: ['step_exec_1', 'step_exec_2'],
          requiresApproval: false,
        },
        {
          step_id: 'step_exec_4',
          name: 'Verification & Provenance Check',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_9',
          objective: 'Verify factual claims in generated call brief against verified county records.',
          dependencies: ['step_exec_3'],
          requiresApproval: false,
        },
      ],
    },
    {
      workflow_id: 'wf_03',
      name: 'TCPA-Gated Bulk Multi-Family Outreach Campaign',
      description: 'Pre-screens multi-family landlords, requires human sign-off for bulk sequences, and triggers automated CRM actions.',
      category: 'qualification',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
      steps: [
        {
          step_id: 'step_bulk_1',
          name: 'Multi-Family Parcel Filter',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_1',
          objective: 'Extract all 4-to-12 unit residential properties with estimated equity >$800K.',
          dependencies: [],
          requiresApproval: false,
        },
        {
          step_id: 'step_bulk_2',
          name: 'Owner Contact Enrichment',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_4',
          objective: 'Resolve mobile and landline numbers for target owner entities.',
          dependencies: ['step_bulk_1'],
          requiresApproval: false,
        },
        {
          step_id: 'step_bulk_3',
          name: 'Compliance Screening & Gatekeeper',
          type: 'HUMAN_APPROVAL',
          assigned_agent: 'sub_agent_7',
          objective: 'Screen for suppression list matches and queue human approval for bulk campaign batch.',
          dependencies: ['step_bulk_2'],
          requiresApproval: true,
        },
        {
          step_id: 'step_bulk_4',
          name: 'Automated CRM Campaign Sync',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_8',
          objective: 'Sync approved contact records to active dialer queue and log audit trail.',
          dependencies: ['step_bulk_3'],
          requiresApproval: false,
        },
      ],
    },
  ];

  inMemoryStore.properties = properties;
  inMemoryStore.propertyOwners = owners;
  inMemoryStore.leads = leads;
  inMemoryStore.campaigns = campaigns;
  inMemoryStore.calls = calls;
  inMemoryStore.approvals = approvals;
  inMemoryStore.workflows = workflows;
  inMemoryStore.auditLogs = [
    {
      id: 'audit_event_101',
      timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(), // 4 mins ago
      agent: 'sub_agent_1',
      action: 'property_search',
      task_id: 'task_search_01',
      input: { county: 'Orange County', city: 'Costa Mesa', apn: '423-112-09' },
      output: {
        address: '1420 Newport Blvd',
        city: 'Costa Mesa',
        state: 'CA',
        estimated_value: 2650000,
        assessed_tax_value: 1720000,
        owner_name: 'Sterling West Holdings LLC',
        units_count: 6,
      },
      status: 'success',
      latency_ms: 185,
      confidence: 0.98,
      source: 'Orange County Assessor & Title Records',
      organization_id: orgId,
    },
    {
      id: 'audit_event_102',
      timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(), // 12 mins ago
      agent: 'agent_1',
      action: 'bulk_apply_property_tags',
      input: {
        propertyIds: ['prop_201', 'prop_202'],
        tags: ['Hot Lead', 'Qualified'],
        mode: 'add',
      },
      output: { updatedCount: 2, tagsApplied: ['Hot Lead', 'Qualified'] },
      status: 'success',
      latency_ms: 65,
      confidence: 1.0,
      source: 'Operations Executive Action',
      organization_id: orgId,
    },
    {
      id: 'audit_event_103',
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(), // 25 mins ago
      agent: 'sub_agent_7',
      action: 'tcpa_dnc_suppression_check',
      task_id: 'task_tcpa_902',
      input: { phone_number: '(949) 555-0182', contact_name: 'Jonathan Sterling' },
      output: { isSuppressed: false, dncRegistryChecked: true, scrubTimestamp: new Date().toISOString() },
      status: 'success',
      latency_ms: 92,
      confidence: 0.99,
      source: 'National & California Do-Not-Call Registry',
      organization_id: orgId,
    },
    {
      id: 'audit_event_104',
      timestamp: new Date(Date.now() - 1000 * 60 * 48).toISOString(), // 48 mins ago
      agent: 'sub_agent_2',
      action: 'lead_viability_scoring',
      task_id: 'task_score_401',
      input: { property_id: 'prop_201', owner_id: 'owner_101' },
      output: {
        lead_score: 94,
        classification: 'high_priority',
        top_factors: ['multiple_owned_properties', 'out_of_area_absentee_owner', 'substantial_equity_spread'],
      },
      status: 'success',
      latency_ms: 240,
      confidence: 0.96,
      source: 'Vortex One Scoring Engine',
      organization_id: orgId,
    },
    {
      id: 'audit_event_105',
      timestamp: new Date(Date.now() - 1000 * 60 * 95).toISOString(), // ~1.5 hours ago
      agent: 'sub_agent_5',
      action: 'dispatch_dialer_call',
      task_id: 'task_dial_501',
      input: {
        campaign_id: 'camp_401',
        to_number: '(949) 555-0182',
        contact_name: 'Jonathan Sterling',
        telephony_provider: 'mock',
      },
      output: {
        call_id: 'call_501',
        status: 'completed',
        duration_seconds: 184,
        disposition: 'interested',
      },
      status: 'success',
      latency_ms: 320,
      confidence: 0.94,
      source: 'Telephony FSM Adapter (Mock)',
      organization_id: orgId,
    },
    {
      id: 'audit_event_106',
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
      agent: 'sub_agent_9',
      action: 'qa_provenance_verification',
      task_id: 'task_qa_882',
      input: {
        claims: ['1420 Newport Blvd contains 6 units', 'Marcus & Eleanor Vance equity is $2.95M'],
        sources: ['Orange County Assessor', 'First American Title'],
      },
      output: {
        status: 'PASS',
        confidence: 0.97,
        verified_claims_count: 2,
        hallucination_score: 0.0,
      },
      status: 'success',
      latency_ms: 410,
      confidence: 0.97,
      source: 'Sub-Agent 9 Independent QA Auditor',
      organization_id: orgId,
    },
    {
      id: 'audit_event_107',
      timestamp: new Date(Date.now() - 1000 * 60 * 320).toISOString(), // ~5.3 hours ago
      agent: 'sub_agent_4',
      action: 'skiptrace_contact_enrichment',
      task_id: 'task_skip_302',
      input: { owner_name: 'David K. Tanaka', property_address: '1102 N Main St, Santa Ana, CA' },
      output: {
        primary_phone: '(808) 555-2391',
        phone_type: 'mobile',
        mailing_address: '1888 Greenbrae St, Honolulu, HI 96816',
        match_confidence: 0.91,
      },
      status: 'success',
      latency_ms: 780,
      confidence: 0.91,
      source: 'LexisNexis / County Recorder SkipTrace Engine',
      organization_id: orgId,
    },
    {
      id: 'audit_event_108',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 9).toISOString(), // 9 hours ago
      agent: 'agent_1',
      action: 'human_approval_approved',
      task_id: 'appr_wf_exec_01',
      input: {
        approval_id: 'appr_601',
        action_type: 'bulk_sms_outreach',
        decided_by: 'Operations Executive',
      },
      output: { decision: 'approve', reason: 'Verified compliance copy and approved targeted send' },
      status: 'success',
      latency_ms: 45,
      confidence: 1.0,
      source: 'Human Approval Center',
      organization_id: orgId,
    },
    {
      id: 'audit_event_109',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(), // 14 hours ago
      agent: 'sub_agent_7',
      action: 'tcpa_compliance_flag',
      task_id: 'task_suppr_warn',
      input: { phone_number: '(949) 555-9999', reason: 'National DNC Registry Block' },
      output: {
        warning: 'Number actively enrolled in DNC suppression list. Outbound campaign blocked.',
      },
      status: 'warning',
      latency_ms: 120,
      confidence: 0.99,
      source: 'TCPA Compliance Screening Guardrail',
      organization_id: orgId,
    },
    {
      id: 'audit_event_110',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(), // 22 hours ago
      agent: 'sub_agent_1',
      action: 'property_schedule_refresh',
      task_id: 'sched_daily_oc_portfolio',
      input: { schedule_id: 'sched_daily_oc_portfolio', target_property_count: 3 },
      output: {
        refreshed_count: 3,
        details: 'Assessor tax rolls verified. 3 assets updated with zero tax delinquency.',
      },
      status: 'success',
      latency_ms: 840,
      confidence: 0.98,
      source: 'Automated 24h GIS Background Scheduler',
      organization_id: orgId,
    },
    {
      id: 'audit_event_111',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(), // 1.1 days ago
      agent: 'sub_agent_8',
      action: 'reconcile_crm_import',
      input: {
        source: 'production_crm_seed',
        batch_size: 4,
        options: { autoScoreLeads: true, enforceDncVerification: true },
      },
      output: {
        totalRecords: 4,
        successCount: 4,
        propertiesCreated: 4,
        ownersCreated: 4,
        leadsGenerated: 3,
        dncSuppressedCount: 0,
      },
      status: 'success',
      latency_ms: 1250,
      confidence: 0.99,
      source: 'Automated CRM Reconciliation Service',
      organization_id: orgId,
    },
    {
      id: 'audit_event_112',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 days ago
      agent: 'sub_agent_3',
      action: 'market_rent_comparables_search',
      task_id: 'task_comp_102',
      input: { corridor: 'Newport Blvd / 17th St', asset_type: 'Multi-Family' },
      output: {
        avg_market_rent_per_unit: 2850,
        historical_growth_rate: '4.8% YoY',
        active_comps_count: 8,
      },
      status: 'success',
      latency_ms: 610,
      confidence: 0.92,
      source: 'Public Records & CoStar Market Index',
      organization_id: orgId,
    },
    {
      id: 'audit_event_113',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
      agent: 'sub_agent_0',
      action: 'system_reasoning_decomposition',
      task_id: 'task_reason_001',
      input: { objective: 'Decompose multi-family acquisition campaign for Orange County' },
      output: {
        sub_agents_assigned: ['sub_agent_1', 'sub_agent_4', 'sub_agent_2', 'sub_agent_5', 'sub_agent_7'],
        critical_path_length: 5,
      },
      status: 'success',
      latency_ms: 380,
      confidence: 0.95,
      source: 'Vortex One System Intelligence Specialist',
      organization_id: orgId,
    },
    {
      id: 'audit_event_114',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(), // 4 days ago
      agent: 'sub_agent_5',
      action: 'telephony_dial_error',
      task_id: 'task_dial_err_01',
      input: { phone_number: '(949) 555-0000', provider: 'mock' },
      output: { error: 'Network timeout: Telephony SIP endpoint failed to establish handshake' },
      status: 'error',
      latency_ms: 2150,
      confidence: 0.0,
      source: 'Telephony Gateway Adapter',
      organization_id: orgId,
    },
  ];
  inMemoryStore.runs = [
    {
      run_id: 'run_wf_01_init',
      workflow_id: 'wf_01',
      name: 'Absentee Owner Commercial Management Pipeline',
      status: 'completed',
      initiated_by: 'Operations Executive',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      completed_at: new Date(Date.now() - 7192000).toISOString(),
      tasks: [],
      final_summary: 'Identified 3 absentee high-equity commercial parcels in Irvine & Newport Beach, verified phone contacts, and synthesized initial pitch.',
    },
    {
      run_id: 'run_wf_03_init',
      workflow_id: 'wf_03',
      name: 'TCPA-Gated Bulk Multi-Family Outreach Campaign',
      status: 'paused_approval',
      current_step_id: 'step_bulk_3',
      initiated_by: 'Automated Schedule',
      created_at: new Date(Date.now() - 1800000).toISOString(),
      tasks: [],
      final_summary: 'Paused at Compliance Screening & Gatekeeper step waiting for human TCPA sign-off.',
    },
  ];

  inMemoryStore.propertyRefreshSchedules = [
    {
      id: 'sched_daily_oc_portfolio',
      organization_id: orgId,
      name: 'Orange County Core Portfolio 24h Sync',
      description: 'Automated 24-hour background task querying California Statewide Open GIS & County Assessor rolls to refresh assessed valuations, tax delinquency, and absentee status.',
      target_property_ids: ['prop_201', 'prop_202', 'prop_203'],
      target_selection_mode: 'selected',
      interval_hours: 24,
      cron_expression: '0 0 * * *',
      status: 'active',
      last_run_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      next_run_at: new Date(Date.now() + 3600000 * 20).toISOString(),
      last_run_status: 'success',
      last_run_summary: 'Synchronized 3 core property records from CA Open Data Cadastral and Assessor tax records.',
      last_run_refreshed_count: 3,
      enrichment_options: {
        refresh_tax_assessor: true,
        refresh_gis_geometry: true,
        refresh_market_valuation: true,
        check_absentee_status: true,
        verify_tcpa_dnc: true,
      },
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      created_by: 'Sub-Agent 1 (Property Intelligence)',
      history: [
        {
          id: 'log_oc_01',
          schedule_id: 'sched_daily_oc_portfolio',
          executed_at: new Date(Date.now() - 3600000 * 4).toISOString(),
          duration_ms: 840,
          properties_processed: 3,
          properties_updated: 3,
          status: 'success',
          details: 'Updated assessed market valuation (+1.2% tax appreciation) and verified active absentee ownership status for 3 assets.',
          valuation_delta: 45000,
          equity_delta: 45000,
        },
        {
          id: 'log_oc_02',
          schedule_id: 'sched_daily_oc_portfolio',
          executed_at: new Date(Date.now() - 3600000 * 28).toISOString(),
          duration_ms: 920,
          properties_processed: 3,
          properties_updated: 3,
          status: 'success',
          details: 'Verified cadastral parcel boundaries with CA Statewide Public FeatureServer.',
          valuation_delta: 0,
          equity_delta: 0,
        },
      ],
    },
    {
      id: 'sched_high_equity_absentee',
      organization_id: orgId,
      name: 'High-Equity Absentee Asset Monitoring',
      description: 'Daily automated surveillance on properties with >$1M estimated equity to flag sudden liens, tax delinquencies, or title transfers.',
      target_property_ids: ['prop_201', 'prop_202', 'prop_204'],
      target_selection_mode: 'high_equity',
      interval_hours: 24,
      cron_expression: '0 2 * * *',
      status: 'active',
      last_run_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      next_run_at: new Date(Date.now() + 3600000 * 12).toISOString(),
      last_run_status: 'success',
      last_run_summary: 'Audited 3 high-equity properties ($12.5M combined valuation). No new default notices or tax encumbrances.',
      last_run_refreshed_count: 3,
      enrichment_options: {
        refresh_tax_assessor: true,
        refresh_gis_geometry: false,
        refresh_market_valuation: true,
        check_absentee_status: true,
        verify_tcpa_dnc: false,
      },
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      created_by: 'Sub-Agent 4 (Data Enrichment)',
      history: [
        {
          id: 'log_he_01',
          schedule_id: 'sched_high_equity_absentee',
          executed_at: new Date(Date.now() - 3600000 * 12).toISOString(),
          duration_ms: 1150,
          properties_processed: 3,
          properties_updated: 3,
          status: 'success',
          details: 'Verified zero tax delinquencies across Costa Mesa & Irvine target parcels.',
          valuation_delta: 0,
          equity_delta: 0,
        },
      ],
    },
  ];

  // Seed Default High-Converting Outreach Templates
  const templates: OutreachTemplate[] = [
    {
      id: 'tpl_email_absentee_01',
      organization_id: orgId,
      name: 'Absentee Landlord Multi-Family Management Proposal',
      description: 'High-touch value proposition targeting out-of-area multi-family owners with estimated equity over $1M.',
      channel: 'email',
      category: 'absentee_owner',
      subject: 'Management & Rent Roll Optimization for {{property_address}}, {{property_city}}',
      body: `Dear {{owner_name}},

I noticed your {{units_count}}-unit multi-family asset located at {{property_address}} in {{property_city}}. As an out-of-area property owner, managing tenant turnovers, maintenance dispatches, and local municipal compliance from a distance can be demanding.

At {{company_name}}, we specialize in turnkey Orange County asset management:
• Rapid tenant placement with 100% verified income & credit screening
• 24/7 in-house maintenance dispatch at negotiated local contractor rates
• Direct deposit owner disbursements on the 1st of every month
• Real-time owner portal with live expense, invoice, and inspection reporting

Based on current {{property_city}} market data, similar properties are leasing with a strong premium over historical leases. With your estimated equity position of {{estimated_equity}}, optimizing your rent roll can substantially increase your annual net operating income (NOI).

Would you be open to a brief 10-minute call this week to review our comprehensive rent comparables report for {{property_address}}?

Best regards,
{{agent_name}}
{{company_name}}
Direct: {{agent_phone}}
Email: {{agent_email}}`,
      variables: [
        'owner_name',
        'units_count',
        'property_address',
        'property_city',
        'company_name',
        'estimated_equity',
        'agent_name',
        'agent_phone',
        'agent_email',
      ],
      tags: ['Absentee', 'Multi-Family', 'Turnkey Management', 'High Equity'],
      is_default: true,
      performance_metrics: {
        usage_count: 24,
        response_rate_percent: 28.5,
        conversion_rate_percent: 14.2,
        last_used_at: new Date(Date.now() - 3600000 * 5).toISOString(),
      },
      created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_by: 'Sub-Agent 5 (Outreach Specialist)',
    },
    {
      id: 'tpl_sms_absentee_01',
      organization_id: orgId,
      name: 'Absentee Owner Quick SMS Inquiry (Costa Mesa / OC)',
      description: 'Concise, TCPA-compliant SMS text to initiate conversational interest with absentee landlords.',
      channel: 'sms',
      category: 'absentee_owner',
      body: `Hi {{first_name}}, this is {{agent_name}} with {{company_name}}. Are you still managing the {{units_count}}-unit property at {{property_address}} yourself, or open to seeing our 2026 rental comp report? Reply STOP to opt out.`,
      variables: ['first_name', 'agent_name', 'company_name', 'units_count', 'property_address'],
      tags: ['SMS', 'Absentee', 'Quick Intro', 'TCPA Compliant'],
      is_default: true,
      performance_metrics: {
        usage_count: 46,
        response_rate_percent: 34.8,
        conversion_rate_percent: 18.0,
        last_used_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      created_by: 'Sub-Agent 5 (Outreach Specialist)',
    },
    {
      id: 'tpl_email_high_equity_01',
      organization_id: orgId,
      name: 'High-Equity Portfolio Cash-Flow Optimization',
      description: 'Strategic proposal highlighting cap rate optimization and operating expense reduction.',
      channel: 'email',
      category: 'high_equity',
      subject: 'Unlocking Peak Cash Flow on {{property_address}} (Estimated Equity: {{estimated_equity}})',
      body: `Hello {{owner_name}},

According to public county records, your asset at {{property_address}} in {{property_city}} holds an estimated equity spread of approximately {{estimated_equity}} (estimated market valuation of {{estimated_value}}).

Many commercial and residential landlords in {{property_city}} are currently reviewing their expense ratios and vendor contracts to maximize capitalization rates. Our team at {{company_name}} conducts complimentary operational audits that typically reduce maintenance overhead by 14–22% while bringing existing lease rates up to fair market value.

We recently prepared an updated valuation and expense analysis for parcel APN {{apn}}.

When is a convenient time for a brief introductory discussion?

Warm regards,
{{agent_name}}
{{company_name}} | {{agent_phone}}`,
      variables: [
        'owner_name',
        'property_address',
        'property_city',
        'estimated_equity',
        'estimated_value',
        'company_name',
        'apn',
        'agent_name',
        'agent_phone',
      ],
      tags: ['High Equity', 'Cap Rate', 'Expense Audit', 'Commercial'],
      is_default: true,
      performance_metrics: {
        usage_count: 18,
        response_rate_percent: 22.0,
        conversion_rate_percent: 11.5,
        last_used_at: new Date(Date.now() - 86400000).toISOString(),
      },
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      created_by: 'Sub-Agent 5 (Outreach Specialist)',
    },
    {
      id: 'tpl_sms_off_market_01',
      organization_id: orgId,
      name: 'Off-Market Acquisition & Valuation Inquiry',
      description: 'Fast-response SMS inquiring if owner would consider off-market acquisition or management review.',
      channel: 'sms',
      category: 'off_market_acquisition',
      body: `Hi {{first_name}}, {{agent_name}} here with {{company_name}}. We have pre-approved buyers looking for {{property_type}} assets near {{property_address}}. Would you consider an off-market offer or property management review? Reply STOP to stop.`,
      variables: ['first_name', 'agent_name', 'company_name', 'property_type', 'property_address'],
      tags: ['SMS', 'Acquisition', 'Off-Market', 'Buyer Interest'],
      is_default: false,
      performance_metrics: {
        usage_count: 31,
        response_rate_percent: 39.2,
        conversion_rate_percent: 21.4,
        last_used_at: new Date(Date.now() - 3600000 * 18).toISOString(),
      },
      created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_by: 'Operations Executive',
    },
    {
      id: 'tpl_email_tax_delinq_01',
      organization_id: orgId,
      name: 'County Assessor Valuation & Tax Relief Consultation',
      description: 'Educates owners on recent county tax assessments and potential operational expense reductions.',
      channel: 'email',
      category: 'tax_delinquency',
      subject: 'Property Tax & Operational Cost Review for {{property_address}}',
      body: `Dear {{owner_name}},

Our intelligence system recently reviewed county tax assessment records for your property at {{property_address}} (APN: {{apn}}).

With current assessed tax values at {{assessed_tax_value}}, many property owners in {{property_city}} are eligible for property tax appeals and local operational credits. At {{company_name}}, we assist owners in contesting inflated assessments and trimming unnecessary operating costs.

If you would like a complimentary summary of recent comparable tax assessments and property management yields in {{property_city}}, please let me know.

Sincerely,
{{agent_name}}
{{company_name}}
{{agent_phone}} | {{agent_email}}`,
      variables: [
        'owner_name',
        'property_address',
        'apn',
        'assessed_tax_value',
        'property_city',
        'company_name',
        'agent_name',
        'agent_phone',
        'agent_email',
      ],
      tags: ['Tax Assessor', 'Prop 13', 'Expense Reduction', 'Assessment Review'],
      is_default: false,
      performance_metrics: {
        usage_count: 12,
        response_rate_percent: 19.5,
        conversion_rate_percent: 8.3,
        last_used_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
      created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      created_by: 'Sub-Agent 1 (Property Intelligence)',
    },
    {
      id: 'tpl_sms_followup_01',
      organization_id: orgId,
      name: 'Post-Call Rental Comp Follow-Up SMS',
      description: 'Friendly post-conversation text delivering promised digital rental comps and owner portal link.',
      channel: 'sms',
      category: 'follow_up',
      body: `Hi {{first_name}}, thank you for speaking with me earlier regarding {{property_address}}. I've sent over the customized rental comp breakdown to your email. Feel free to text me here anytime with questions! - {{agent_name}}, {{company_name}}`,
      variables: ['first_name', 'property_address', 'agent_name', 'company_name'],
      tags: ['SMS', 'Follow-up', 'Comps', 'Warm Lead'],
      is_default: false,
      performance_metrics: {
        usage_count: 58,
        response_rate_percent: 62.0,
        conversion_rate_percent: 36.5,
        last_used_at: new Date(Date.now() - 3600000 * 3).toISOString(),
      },
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      created_by: 'Sub-Agent 5 (Outreach Specialist)',
    },
    {
      id: 'tpl_call_script_01',
      organization_id: orgId,
      name: 'Cold Inbound/Outbound Discovery Call Script',
      description: 'Structured telephony pitch script for multi-family property owners in Costa Mesa/Orange County.',
      channel: 'call_script',
      category: 'property_management',
      body: `[OPENING HOOK]
"Hi {{first_name}}, this is {{agent_name}} with {{company_name}} right here in Orange County. I'm reaching out specifically regarding your {{units_count}}-unit property at {{property_address}}."

[VALUE PROPOSITION]
"We manage several properties in {{property_city}} and notice landlords are frequently struggling with delayed vendor response and tenant lease turnover. We offer a guaranteed 14-day vacancy fill and 24/7 local maintenance."

[QUALIFICATION QUESTIONS]
1. "Are you currently self-managing or working with a third-party property manager?"
2. "When was the last time leases were adjusted to reflect current market rates (approx. {{estimated_value}} valuation)?"

[CLOSING / NEXT STEP]
"I would love to email you our 2-page {{property_city}} rental comparables report. What's the best email address to reach you at?"`,
      variables: [
        'first_name',
        'agent_name',
        'company_name',
        'units_count',
        'property_address',
        'property_city',
        'estimated_value',
      ],
      tags: ['Call Script', 'Discovery', 'Telephony Pitch', 'Objection Handling'],
      is_default: false,
      performance_metrics: {
        usage_count: 73,
        response_rate_percent: 41.2,
        conversion_rate_percent: 23.8,
        last_used_at: new Date(Date.now() - 3600000 * 1).toISOString(),
      },
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      created_by: 'Sub-Agent 5 (Outreach Specialist)',
    },
  ];

  inMemoryStore.outreachTemplates = templates;
}

// Auto-seed in-memory store
seedInitialData();

/**
 * Initialize PostgreSQL connection or safely fall back with diagnostics
 */
export async function initializeDatabase(): Promise<DatabaseStatus> {
  const host = process.env.SQL_HOST || process.env.DB_HOST;
  const port = parseInt(process.env.SQL_PORT || process.env.DB_PORT || '5432', 10);
  const user = process.env.SQL_ADMIN_USER || process.env.SQL_USER || process.env.DB_USER || 'postgres';
  const password = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD || process.env.DB_PASS || '';
  const database = process.env.SQL_DB_NAME || process.env.DB_NAME || 'vortex-one-database';
  
  const isPostgresConfigured = !!host;

  // If explicit PostgreSQL config is available, attempt connection
  if (isPostgresConfigured) {
    try {
      pgPool = new Pool({
        host: host,
        port: port,
        user: user,
        password: password,
        database: database,
        max: 10,
        connectionTimeoutMillis: 5000,
        ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      });

      const client = await pgPool.connect();
      try {
        // Run migrations transactionally
        await client.query('BEGIN');
        await client.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
          );
        `);

        const { rows } = await client.query('SELECT version FROM schema_migrations');
        const appliedVersions = new Set(rows.map((r: any) => r.version));

        for (const migration of MIGRATIONS) {
          if (!appliedVersions.has(migration.version)) {
            console.log(`Applying PostgreSQL Migration ${migration.version}: ${migration.name}`);
            await client.query(migration.sql);
            await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [
              migration.version,
              migration.name,
            ]);
          }
        }
        await client.query('COMMIT');

        // Seed default organizations in PostgreSQL
        try {
          await client.query(`
            INSERT INTO organizations (id, name, slug, settings, created_at, updated_at)
            VALUES 
              ('org_cmc_realty', 'CMC Realty & Property Management', 'cmc-realty', '{"market": "Orange County, CA"}'::jsonb, NOW(), NOW()),
              ('org-vortex-default', 'Vortex One Default Organization', 'vortex-default', '{"market": "National"}'::jsonb, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;
          `);
        } catch (seedErr: any) {
          console.warn('Organization auto-seed notice:', seedErr.message);
        }

        currentDbStatus = {
          connected: true,
          type: 'postgresql',
          instance: process.env.CLOUD_SQL_CONNECTION_NAME || `${host}:${port}`,
          database,
          appliedMigrationsCount: MIGRATIONS.length,
          lastMigrationName: MIGRATIONS[MIGRATIONS.length - 1].name,
        };
        console.log(`PostgreSQL Cloud SQL migrations successfully verified on database '${database}'.`);
      } catch (migErr: any) {
        await client.query('ROLLBACK');
        console.error('Migration error on PostgreSQL:', migErr.message);
        throw migErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      if (pgPool) {
        pgPool.end().catch(() => {});
        pgPool = null;
      }
      
      currentDbStatus = {
        connected: false,
        type: 'in_memory',
        instance: process.env.CLOUD_SQL_CONNECTION_NAME || `${host}:${port}`,
        database,
        appliedMigrationsCount: 0,
        error: `PostgreSQL connection attempt failed (${host}:${port}/${database}): ${err.message}`,
      };
      console.warn(`[Database] PostgreSQL notice (${host}:${port}/${database}): ${err.message}. Operating in resilient in-memory storage mode.`);
    }
  } else {
    // If no host is configured at all, fallback to in-memory
    currentDbStatus = {
      connected: false,
      type: 'in_memory',
      instance: process.env.CLOUD_SQL_CONNECTION_NAME || 'vortex-one:us-west1:ai-studio-96900d81',
      database,
      appliedMigrationsCount: MIGRATIONS.length,
      lastMigrationName: MIGRATIONS[MIGRATIONS.length - 1].name,
      error: 'No SQL_HOST configured',
    };
  }

  return currentDbStatus;
}

export function getDatabaseStatus(): DatabaseStatus {
  return currentDbStatus;
}

export function getPgPool(): Pool | null {
  return pgPool;
}
