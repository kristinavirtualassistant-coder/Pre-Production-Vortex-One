import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  serial,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- Core Platform & Auth Schema ---

export const organizations = pgTable('organizations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  uid: text('uid').unique(), // Firebase Auth UID linkage
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).default('member').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Property Intelligence & CRM Schema ---

export const propertyOwners = pgTable('property_owners', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).default('individual').notNull(),
  mailingAddress: varchar('mailing_address', { length: 255 }),
  mailingCity: varchar('mailing_city', { length: 100 }),
  mailingState: varchar('mailing_state', { length: 50 }),
  mailingZip: varchar('mailing_zip', { length: 20 }),
  phoneNumbers: jsonb('phone_numbers').default([]).notNull(),
  emailAddresses: jsonb('email_addresses').default([]).notNull(),
  propertiesOwnedCount: integer('properties_owned_count').default(1).notNull(),
  totalPortfolioValue: numeric('total_portfolio_value', { precision: 15, scale: 2 }).default('0').notNull(),
  totalPortfolioEquity: numeric('total_portfolio_equity', { precision: 15, scale: 2 }).default('0').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const properties = pgTable('properties', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  ownerId: varchar('owner_id', { length: 64 })
    .references(() => propertyOwners.id, { onDelete: 'set null' }),
  address: varchar('address', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 50 }).notNull(),
  zip: varchar('zip', { length: 20 }).notNull(),
  county: varchar('county', { length: 100 }).notNull(),
  apn: varchar('apn', { length: 100 }).notNull(),
  propertyType: varchar('property_type', { length: 50 }).notNull(),
  unitsCount: integer('units_count').default(1).notNull(),
  squareFeet: integer('square_feet').default(0).notNull(),
  yearBuilt: integer('year_built'),
  estimatedValue: numeric('estimated_value', { precision: 15, scale: 2 }).default('0').notNull(),
  assessedTaxValue: numeric('assessed_tax_value', { precision: 15, scale: 2 }).default('0').notNull(),
  estimatedEquity: numeric('estimated_equity', { precision: 15, scale: 2 }).default('0').notNull(),
  mortgageBalance: numeric('mortgage_balance', { precision: 15, scale: 2 }).default('0').notNull(),
  isAbsenteeOwner: boolean('is_absentee_owner').default(false).notNull(),
  isCorporateOwned: boolean('is_corporate_owned').default(false).notNull(),
  taxDelinquent: boolean('tax_delinquent').default(false).notNull(),
  lastSaleDate: date('last_sale_date'),
  lastSalePrice: numeric('last_sale_price', { precision: 15, scale: 2 }),
  provenance: jsonb('provenance').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const leads = pgTable('leads', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  ownerId: varchar('owner_id', { length: 64 })
    .references(() => propertyOwners.id, { onDelete: 'cascade' }),
  primaryPropertyId: varchar('primary_property_id', { length: 64 })
    .references(() => properties.id, { onDelete: 'set null' }),
  leadScore: integer('lead_score').default(0).notNull(),
  classification: varchar('classification', { length: 50 }).default('nurture').notNull(),
  factors: jsonb('factors').default([]).notNull(),
  stage: varchar('stage', { length: 50 }).default('identified').notNull(),
  assignedAgent: varchar('assigned_agent', { length: 64 }).default('sub_agent_2').notNull(),
  dncCompliant: boolean('dnc_compliant').default(true).notNull(),
  lastActivityDate: timestamp('last_activity_date', { withTimezone: true }).defaultNow().notNull(),
  nextRecommendedAction: text('next_recommended_action'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const crmRecords = pgTable('crm_records', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  leadId: varchar('lead_id', { length: 64 })
    .references(() => leads.id, { onDelete: 'cascade' }),
  recordType: varchar('record_type', { length: 50 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  createdByAgent: varchar('created_by_agent', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Dialer Engine & Telephony Schema ---

export const campaign = pgTable('campaign', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 50 }).default('draft').notNull(),
  targetMarket: varchar('target_market', { length: 255 }),
  telephonyProvider: varchar('telephony_provider', { length: 50 }).default('mock').notNull(),
  totalContacts: integer('total_contacts').default(0).notNull(),
  dialedCount: integer('dialed_count').default(0).notNull(),
  connectedCount: integer('connected_count').default(0).notNull(),
  convertedCount: integer('converted_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const campaignContact = pgTable('campaign_contact', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  campaignId: varchar('campaign_id', { length: 64 })
    .references(() => campaign.id, { onDelete: 'cascade' })
    .notNull(),
  leadId: varchar('lead_id', { length: 64 })
    .references(() => leads.id, { onDelete: 'set null' }),
  contactName: varchar('contact_name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 50 }).notNull(),
  propertyAddress: varchar('property_address', { length: 255 }),
  dialStatus: varchar('dial_status', { length: 50 }).default('queued').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  lastDialedAt: timestamp('last_dialed_at', { withTimezone: true }),
  priority: integer('priority').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dialingSession = pgTable('dialing_session', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  campaignId: varchar('campaign_id', { length: 64 })
    .references(() => campaign.id, { onDelete: 'cascade' })
    .notNull(),
  agentUserId: varchar('agent_user_id', { length: 64 }).notNull(),
  status: varchar('status', { length: 50 }).default('active').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  callsPlaced: integer('calls_placed').default(0).notNull(),
  contactsReached: integer('contacts_reached').default(0).notNull(),
});

export const call = pgTable('call', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  sessionId: varchar('session_id', { length: 64 })
    .references(() => dialingSession.id, { onDelete: 'set null' }),
  campaignId: varchar('campaign_id', { length: 64 })
    .references(() => campaign.id, { onDelete: 'set null' }),
  leadId: varchar('lead_id', { length: 64 })
    .references(() => leads.id, { onDelete: 'set null' }),
  telephonyCallId: varchar('telephony_call_id', { length: 128 }),
  contactName: varchar('contact_name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 50 }).notNull(),
  direction: varchar('direction', { length: 20 }).default('outbound').notNull(),
  status: varchar('status', { length: 50 }).default('initiated').notNull(),
  disposition: varchar('disposition', { length: 50 }),
  durationSeconds: integer('duration_seconds').default(0).notNull(),
  callStrategyBrief: text('call_strategy_brief'),
  notes: text('notes'),
  recordingUrl: varchar('recording_url', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

export const callEvent = pgTable('call_event', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  callId: varchar('call_id', { length: 64 })
    .references(() => call.id, { onDelete: 'cascade' })
    .notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: jsonb('payload').default({}).notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
});

export const callNote = pgTable('call_note', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  callId: varchar('call_id', { length: 64 })
    .references(() => call.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: varchar('author_id', { length: 64 }).notNull(),
  noteContent: text('note_content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const suppressionRecord = pgTable('suppression_record', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  phoneNumber: varchar('phone_number', { length: 50 }).notNull(),
  reason: varchar('reason', { length: 100 }).notNull(),
  source: varchar('source', { length: 100 }).default('manual').notNull(),
  suppressedAt: timestamp('suppressed_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const processedEvents = pgTable('processed_events', {
  eventId: varchar('event_id', { length: 128 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
});

// --- Autonomous Multi-Agent & Orchestration Schema ---

export const agentConfigs = pgTable('agent_configs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  description: text('description').notNull(),
  primaryResponsibility: text('primary_responsibility').notNull(),
  systemInstructions: text('system_instructions').notNull(),
  allowedTools: jsonb('allowed_tools').default([]).notNull(),
  allowedData: jsonb('allowed_data').default([]).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.20').notNull(),
  maxTokens: integer('max_tokens').default(4096),
  permissions: jsonb('permissions').default([]).notNull(),
  parentAgentId: varchar('parent_agent_id', { length: 64 }),
  enabled: boolean('enabled').default(true).notNull(),
  capabilities: jsonb('capabilities').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable('tasks', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  parentTaskId: varchar('parent_task_id', { length: 64 }),
  assignedAgent: varchar('assigned_agent', { length: 64 }).notNull(),
  objective: text('objective').notNull(),
  input: jsonb('input').default({}).notNull(),
  dependencies: jsonb('dependencies').default([]).notNull(),
  priority: varchar('priority', { length: 20 }).default('medium').notNull(),
  status: varchar('status', { length: 30 }).default('queued').notNull(),
  result: jsonb('result'),
  confidence: numeric('confidence', { precision: 4, scale: 3 }).default('0.000').notNull(),
  provenance: jsonb('provenance').default([]).notNull(),
  warnings: jsonb('warnings').default([]).notNull(),
  error: text('error'),
  executionTimeMs: integer('execution_time_ms'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const workflows = pgTable('workflows', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).default('custom').notNull(),
  steps: jsonb('steps').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const approvals = pgTable('approvals', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  taskId: varchar('task_id', { length: 64 })
    .references(() => tasks.id, { onDelete: 'set null' }),
  workflowRunId: varchar('workflow_run_id', { length: 64 }),
  actionType: varchar('action_type', { length: 100 }).notNull(),
  description: text('description').notNull(),
  reason: text('reason').notNull(),
  riskLevel: varchar('risk_level', { length: 20 }).default('medium').notNull(),
  requiresHumanApproval: boolean('requires_human_approval').default(true).notNull(),
  proposedBy: varchar('proposed_by', { length: 64 }).notNull(),
  payload: jsonb('payload').default({}).notNull(),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  issues: jsonb('issues').default([]).notNull(),
  modifications: jsonb('modifications'),
  decidedBy: varchar('decided_by', { length: 64 }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 64 }).primaryKey(),
  organizationId: varchar('organization_id', { length: 64 })
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  agent: varchar('agent', { length: 64 }).notNull(),
  taskId: varchar('task_id', { length: 64 }),
  action: varchar('action', { length: 255 }).notNull(),
  input: jsonb('input'),
  output: jsonb('output'),
  status: varchar('status', { length: 30 }).notNull(),
  latencyMs: integer('latency_ms').default(0).notNull(),
  error: text('error'),
  confidence: numeric('confidence', { precision: 4, scale: 3 }),
  source: varchar('source', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
