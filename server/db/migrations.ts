/**
 * Vortex One - Production-Grade PostgreSQL Schema Migration System
 * Handles automated version tracking, transactional migrations, and table bootstrap
 */

import { POSTGRESQL_AUTH_MIGRATION } from './postgresqlAuthMigration';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_create_core_platform_schema',
    sql: `
      -- Schema version tracking
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- Organizations table (Tenant Isolation)
      CREATE TABLE IF NOT EXISTS organizations (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        settings JSONB DEFAULT '{}'::jsonb NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'member' NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT uq_users_org_email UNIQUE(organization_id, email)
      );

      CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
    `,
  },
  {
    version: 2,
    name: '002_create_property_and_crm_schema',
    sql: `
      -- Property Owners table
      CREATE TABLE IF NOT EXISTS property_owners (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        entity_type VARCHAR(50) DEFAULT 'individual' NOT NULL,
        mailing_address VARCHAR(255),
        mailing_city VARCHAR(100),
        mailing_state VARCHAR(50),
        mailing_zip VARCHAR(20),
        phone_numbers JSONB DEFAULT '[]'::jsonb NOT NULL,
        email_addresses JSONB DEFAULT '[]'::jsonb NOT NULL,
        properties_owned_count INTEGER DEFAULT 1 NOT NULL,
        total_portfolio_value NUMERIC(15, 2) DEFAULT 0 NOT NULL,
        total_portfolio_equity NUMERIC(15, 2) DEFAULT 0 NOT NULL,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_property_owners_org ON property_owners(organization_id);
      CREATE INDEX IF NOT EXISTS idx_property_owners_name ON property_owners(organization_id, name);

      -- Properties table
      CREATE TABLE IF NOT EXISTS properties (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) REFERENCES property_owners(id) ON DELETE SET NULL,
        address VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(50) NOT NULL,
        zip VARCHAR(20) NOT NULL,
        county VARCHAR(100) NOT NULL,
        apn VARCHAR(100) NOT NULL,
        property_type VARCHAR(50) NOT NULL,
        units_count INTEGER DEFAULT 1 NOT NULL,
        square_feet INTEGER DEFAULT 0 NOT NULL,
        year_built INTEGER,
        estimated_value NUMERIC(15, 2) DEFAULT 0 NOT NULL,
        assessed_tax_value NUMERIC(15, 2) DEFAULT 0 NOT NULL,
        estimated_equity NUMERIC(15, 2) DEFAULT 0 NOT NULL,
        mortgage_balance NUMERIC(15, 2) DEFAULT 0 NOT NULL,
        is_absentee_owner BOOLEAN DEFAULT false NOT NULL,
        is_corporate_owned BOOLEAN DEFAULT false NOT NULL,
        tax_delinquent BOOLEAN DEFAULT false NOT NULL,
        last_sale_date DATE,
        last_sale_price NUMERIC(15, 2),
        provenance JSONB DEFAULT '{}'::jsonb NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT uq_properties_org_apn UNIQUE(organization_id, apn)
      );

      CREATE INDEX IF NOT EXISTS idx_properties_org ON properties(organization_id);
      CREATE INDEX IF NOT EXISTS idx_properties_city_county ON properties(organization_id, county, city);
      CREATE INDEX IF NOT EXISTS idx_properties_owner ON properties(owner_id);

      -- Leads table
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) REFERENCES property_owners(id) ON DELETE CASCADE,
        primary_property_id VARCHAR(64) REFERENCES properties(id) ON DELETE SET NULL,
        lead_score INTEGER DEFAULT 0 NOT NULL,
        classification VARCHAR(50) DEFAULT 'nurture' NOT NULL,
        factors JSONB DEFAULT '[]'::jsonb NOT NULL,
        stage VARCHAR(50) DEFAULT 'identified' NOT NULL,
        assigned_agent VARCHAR(64) DEFAULT 'sub_agent_2' NOT NULL,
        dnc_compliant BOOLEAN DEFAULT true NOT NULL,
        last_activity_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        next_recommended_action TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_leads_org_score ON leads(organization_id, lead_score DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(organization_id, stage);

      -- CRM Records
      CREATE TABLE IF NOT EXISTS crm_records (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE CASCADE,
        record_type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        created_by_agent VARCHAR(64) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_crm_lead ON crm_records(lead_id);
    `,
  },
  {
    version: 3,
    name: '003_create_dialer_production_schema',
    sql: `
      -- Campaign table
      CREATE TABLE IF NOT EXISTS campaign (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'draft' NOT NULL,
        target_market VARCHAR(255),
        telephony_provider VARCHAR(50) DEFAULT 'mock' NOT NULL,
        total_contacts INTEGER DEFAULT 0 NOT NULL,
        dialed_count INTEGER DEFAULT 0 NOT NULL,
        connected_count INTEGER DEFAULT 0 NOT NULL,
        converted_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_campaign_org_status ON campaign(organization_id, status);

      -- Campaign Contact table
      CREATE TABLE IF NOT EXISTS campaign_contact (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        campaign_id VARCHAR(64) NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
        lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL,
        contact_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        property_address VARCHAR(255),
        dial_status VARCHAR(50) DEFAULT 'queued' NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        last_dialed_at TIMESTAMP WITH TIME ZONE,
        priority INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT uq_campaign_contact_phone UNIQUE(campaign_id, phone_number)
      );

      CREATE INDEX IF NOT EXISTS idx_camp_contact_status ON campaign_contact(campaign_id, dial_status);

      -- Dialing Session table
      CREATE TABLE IF NOT EXISTS dialing_session (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        campaign_id VARCHAR(64) NOT NULL REFERENCES campaign(id) ON DELETE CASCADE,
        agent_user_id VARCHAR(64) NOT NULL,
        status VARCHAR(50) DEFAULT 'active' NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        ended_at TIMESTAMP WITH TIME ZONE,
        calls_placed INTEGER DEFAULT 0 NOT NULL,
        contacts_reached INTEGER DEFAULT 0 NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_dialing_session_camp ON dialing_session(campaign_id, status);

      -- Call table
      CREATE TABLE IF NOT EXISTS call (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        session_id VARCHAR(64) REFERENCES dialing_session(id) ON DELETE SET NULL,
        campaign_id VARCHAR(64) REFERENCES campaign(id) ON DELETE SET NULL,
        lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL,
        telephony_call_id VARCHAR(128),
        contact_name VARCHAR(255) NOT NULL,
        phone_number VARCHAR(50) NOT NULL,
        direction VARCHAR(20) DEFAULT 'outbound' NOT NULL,
        status VARCHAR(50) DEFAULT 'initiated' NOT NULL,
        disposition VARCHAR(50),
        duration_seconds INTEGER DEFAULT 0 NOT NULL,
        call_strategy_brief TEXT,
        recording_url VARCHAR(512),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        ended_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_call_org_created ON call(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_call_status ON call(status);

      -- Call Event table (FSM Events)
      CREATE TABLE IF NOT EXISTS call_event (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        call_id VARCHAR(64) NOT NULL REFERENCES call(id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb NOT NULL,
        occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_call_event_call ON call_event(call_id, occurred_at ASC);

      -- Call Note table
      CREATE TABLE IF NOT EXISTS call_note (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        call_id VARCHAR(64) NOT NULL REFERENCES call(id) ON DELETE CASCADE,
        author_id VARCHAR(64) NOT NULL,
        note_content TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_call_note_call ON call_note(call_id);

      -- Suppression Record table (DNC / TCPA Compliance)
      CREATE TABLE IF NOT EXISTS suppression_record (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        phone_number VARCHAR(50) NOT NULL,
        reason VARCHAR(100) NOT NULL,
        source VARCHAR(100) DEFAULT 'manual' NOT NULL,
        suppressed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT uq_suppression_org_phone UNIQUE(organization_id, phone_number)
      );

      CREATE INDEX IF NOT EXISTS idx_suppression_phone ON suppression_record(organization_id, phone_number);

      -- Processed Events table (Webhook Idempotency)
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id VARCHAR(128) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_processed_events_org ON processed_events(organization_id, processed_at);
    `,
  },
  {
    version: 4,
    name: '004_create_multi_agent_system_schema',
    sql: `
      -- Agent Configurations (Dynamic Agent Registry)
      CREATE TABLE IF NOT EXISTS agent_configs (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        primary_responsibility TEXT NOT NULL,
        system_instructions TEXT NOT NULL,
        allowed_tools JSONB DEFAULT '[]'::jsonb NOT NULL,
        allowed_data JSONB DEFAULT '[]'::jsonb NOT NULL,
        model VARCHAR(100) NOT NULL,
        temperature NUMERIC(3, 2) DEFAULT 0.20 NOT NULL,
        max_tokens INTEGER DEFAULT 4096,
        permissions JSONB DEFAULT '[]'::jsonb NOT NULL,
        parent_agent_id VARCHAR(64),
        enabled BOOLEAN DEFAULT true NOT NULL,
        capabilities JSONB DEFAULT '[]'::jsonb NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_agent_configs_org ON agent_configs(organization_id);

      -- Tasks table
      CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        parent_task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
        assigned_agent VARCHAR(64) NOT NULL,
        objective TEXT NOT NULL,
        input JSONB DEFAULT '{}'::jsonb NOT NULL,
        dependencies JSONB DEFAULT '[]'::jsonb NOT NULL,
        priority VARCHAR(20) DEFAULT 'medium' NOT NULL,
        status VARCHAR(30) DEFAULT 'queued' NOT NULL,
        result JSONB,
        confidence NUMERIC(4, 3) DEFAULT 0.000 NOT NULL,
        provenance JSONB DEFAULT '[]'::jsonb NOT NULL,
        warnings JSONB DEFAULT '[]'::jsonb NOT NULL,
        error TEXT,
        execution_time_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_org_status ON tasks(organization_id, status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_agent ON tasks(organization_id, assigned_agent);

      -- Workflows table
      CREATE TABLE IF NOT EXISTS workflows (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'custom' NOT NULL,
        steps JSONB DEFAULT '[]'::jsonb NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      -- Approvals table (Human in the loop)
      CREATE TABLE IF NOT EXISTS approvals (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
        workflow_run_id VARCHAR(64),
        action_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        reason TEXT NOT NULL,
        risk_level VARCHAR(20) DEFAULT 'medium' NOT NULL,
        requires_human_approval BOOLEAN DEFAULT true NOT NULL,
        proposed_by VARCHAR(64) NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb NOT NULL,
        status VARCHAR(30) DEFAULT 'pending' NOT NULL,
        issues JSONB DEFAULT '[]'::jsonb NOT NULL,
        modifications JSONB,
        decided_by VARCHAR(64),
        decided_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_approvals_org_status ON approvals(organization_id, status);

      -- Audit Logs table
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        agent VARCHAR(64) NOT NULL,
        task_id VARCHAR(64),
        action VARCHAR(255) NOT NULL,
        input JSONB,
        output JSONB,
        status VARCHAR(30) NOT NULL,
        latency_ms INTEGER DEFAULT 0 NOT NULL,
        error TEXT,
        confidence NUMERIC(4, 3),
        source VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_agent ON audit_logs(agent);
    `,
  },
  {
    version: 5,
    name: '005_add_properties_unique_constraint',
    sql: `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_properties_org_apn'
        ) THEN
          ALTER TABLE properties ADD CONSTRAINT uq_properties_org_apn UNIQUE (organization_id, apn);
        END IF;
      END $$;
    `,
  },
  {
    version: 6,
    name: '006_add_property_search_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_properties_org_apn ON properties(organization_id, apn);
      CREATE INDEX IF NOT EXISTS idx_properties_org_value_equity ON properties(organization_id, estimated_value, estimated_equity);
      CREATE INDEX IF NOT EXISTS idx_properties_org_flags ON properties(organization_id, is_absentee_owner, is_corporate_owned, tax_delinquent);
      CREATE INDEX IF NOT EXISTS idx_properties_org_type_year ON properties(organization_id, property_type, year_built);
      CREATE INDEX IF NOT EXISTS idx_properties_org_zip ON properties(organization_id, zip);
      CREATE INDEX IF NOT EXISTS idx_property_owners_org_state ON property_owners(organization_id, mailing_state);
      CREATE INDEX IF NOT EXISTS idx_property_owners_org_portfolio ON property_owners(organization_id, properties_owned_count);
    `,
  },
  {
    version: 7,
    name: '007_add_campaign_dialer_controls',
    sql: `
      ALTER TABLE campaign ADD COLUMN IF NOT EXISTS concurrency_limit INTEGER DEFAULT 3 NOT NULL;
      ALTER TABLE campaign ADD COLUMN IF NOT EXISTS retry_limit INTEGER DEFAULT 3 NOT NULL;
      ALTER TABLE campaign ADD COLUMN IF NOT EXISTS calling_hours_start TIME DEFAULT '08:00' NOT NULL;
      ALTER TABLE campaign ADD COLUMN IF NOT EXISTS calling_hours_end TIME DEFAULT '20:00' NOT NULL;
      ALTER TABLE campaign ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'America/Los_Angeles' NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_campaign_contact_queue ON campaign_contact(organization_id, campaign_id, dial_status, priority DESC, created_at ASC);
    `,
  },
  {
    version: 8,
    name: '008_create_crm_contacts_activities',
    sql: `
      CREATE TABLE IF NOT EXISTS contacts (
        id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) REFERENCES property_owners(id) ON DELETE SET NULL, lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL,
        full_name VARCHAR(255) NOT NULL, phone_numbers JSONB DEFAULT '[]'::jsonb NOT NULL, email_addresses JSONB DEFAULT '[]'::jsonb NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT uq_contacts_org_name UNIQUE(organization_id, full_name)
      );
      CREATE INDEX IF NOT EXISTS idx_contacts_org_owner ON contacts(organization_id, owner_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_org_lead ON contacts(organization_id, lead_id);

      CREATE TABLE IF NOT EXISTS activities (
        id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE CASCADE, contact_id VARCHAR(64) REFERENCES contacts(id) ON DELETE SET NULL,
        activity_type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, content TEXT NOT NULL, metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
        created_by VARCHAR(64), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activities_org_lead_created ON activities(organization_id, lead_id, created_at DESC);
    `,
  },
  {
    version: 9,
    name: '009_create_durable_jobs',
    sql: `
      CREATE TABLE IF NOT EXISTS jobs (
        id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        job_type VARCHAR(100) NOT NULL, payload JSONB DEFAULT '{}'::jsonb NOT NULL, status VARCHAR(30) DEFAULT 'queued' NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL, max_attempts INTEGER DEFAULT 3 NOT NULL, available_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        locked_at TIMESTAMP WITH TIME ZONE, locked_by VARCHAR(128), last_error TEXT, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE
      );
      CREATE INDEX IF NOT EXISTS idx_jobs_queue ON jobs(organization_id, status, available_at);
    `,
  },
  {
    version: 10,
    name: '010_harden_call_identifiers_and_notes',
    sql: `
      ALTER TABLE call ADD COLUMN IF NOT EXISTS notes TEXT;
      ALTER TABLE call ADD COLUMN IF NOT EXISTS ringcentral_ringout_id VARCHAR(128);
      ALTER TABLE call ADD COLUMN IF NOT EXISTS telephony_session_id VARCHAR(128);
      ALTER TABLE call ADD COLUMN IF NOT EXISTS ringcentral_party_id VARCHAR(128);
      ALTER TABLE call ADD COLUMN IF NOT EXISTS answered_at TIMESTAMP WITH TIME ZONE;
      CREATE INDEX IF NOT EXISTS idx_call_rc_session ON call(organization_id, telephony_session_id);
      CREATE INDEX IF NOT EXISTS idx_call_rc_ringout ON call(organization_id, ringcentral_ringout_id);
    `,
  },
  { version: 11, name: '011_add_manual_call_idempotency', sql: `
    ALTER TABLE call ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_call_org_idempotency ON call(organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
  `, },
  // Version 12 was historically missing from this chain: the authentication/webhook/voicemail foundation was
  // created lazily at request time by whichever database role served the first login. It is now part of the
  // ordered, admin-applied migration chain. The SQL is fully idempotent (IF NOT EXISTS), so databases that
  // already received it through the old lazy bootstrap simply re-run it as a no-op.
  { version: 12, name: '012_auth_webhook_voicemail_foundation', sql: POSTGRESQL_AUTH_MIGRATION.sql },
  {
    version: 13,
    name: '013_create_email_outreach_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS outreach_templates (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        channel VARCHAR(30) NOT NULL CHECK (channel = 'email'),
        category VARCHAR(80) NOT NULL DEFAULT 'custom',
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        variables JSONB DEFAULT '[]'::jsonb NOT NULL,
        tags JSONB DEFAULT '[]'::jsonb NOT NULL,
        is_default BOOLEAN DEFAULT false NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_by VARCHAR(128)
      );
      CREATE INDEX IF NOT EXISTS idx_outreach_templates_org_channel
        ON outreach_templates(organization_id, channel, updated_at DESC);

      CREATE TABLE IF NOT EXISTS email_outreach (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        lead_id VARCHAR(64) NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        template_id VARCHAR(64) REFERENCES outreach_templates(id) ON DELETE SET NULL,
        idempotency_key VARCHAR(255) NOT NULL,
        recipient_email VARCHAR(320) NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued','processing','sent','failed')),
        provider_message_id VARCHAR(255),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        job_id VARCHAR(64) REFERENCES jobs(id) ON DELETE SET NULL,
        created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        sent_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (organization_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_email_outreach_org_status
        ON email_outreach(organization_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_email_outreach_org_lead
        ON email_outreach(organization_id, lead_id, created_at DESC);
    `,
  },
  {
    version: 14,
    name: '014_create_integration_connections',
    sql: `
      CREATE TABLE IF NOT EXISTS integration_connections (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider VARCHAR(100) NOT NULL,
        external_account_id VARCHAR(255),
        account_email VARCHAR(320),
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP WITH TIME ZONE,
        scopes JSONB DEFAULT '[]'::jsonb NOT NULL,
        status VARCHAR(30) DEFAULT 'connected' NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE (organization_id, user_id, provider)
      );
      CREATE INDEX IF NOT EXISTS idx_integration_connections_org
        ON integration_connections(organization_id, status);

      CREATE TABLE IF NOT EXISTS integration_oauth_states (
        state_hash VARCHAR(64) PRIMARY KEY,
        provider VARCHAR(100) NOT NULL,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        code_verifier TEXT NOT NULL,
        redirect_uri VARCHAR(2048) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_integration_oauth_states_expiry
        ON integration_oauth_states(expires_at);
    `,
  },

  {
    version: 15,
    name: '015_create_durable_workflow_runs',
    sql: `
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        workflow_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(30) NOT NULL CHECK (status IN ('queued','running','completed','failed','paused_approval')),
        current_step_id VARCHAR(128),
        current_step_name VARCHAR(255),
        current_agent_id VARCHAR(128),
        total_steps INTEGER NOT NULL DEFAULT 0,
        completed_steps INTEGER NOT NULL DEFAULT 0,
        initiated_by VARCHAR(255) NOT NULL,
        tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
        node_states JSONB NOT NULL DEFAULT '{}'::jsonb,
        step_outputs JSONB NOT NULL DEFAULT '{}'::jsonb,
        qa_verification JSONB,
        final_summary TEXT,
        execution_time_ms INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_created ON workflow_runs(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_status ON workflow_runs(organization_id, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_workflow ON workflow_runs(organization_id, workflow_id, created_at DESC);
    `,
  },
  {
    version: 16,
    name: '016_create_shared_rate_limit_buckets',
    sql: `
      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        bucket_key VARCHAR(512) PRIMARY KEY,
        window_start BIGINT NOT NULL,
        request_count INTEGER NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_updated
        ON rate_limit_buckets(updated_at);
    `,
  },
  {
    version: 17,
    name: '017_enforce_global_user_email_identity',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS uq_users_global_email_lower
        ON users (LOWER(email));
    `,
  },

  {
    version: 18,
    name: '018_create_workflow_automation_runtime',
    sql: `
      CREATE TABLE IF NOT EXISTS workflow_versions (id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, workflow_id VARCHAR(64) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE, version INTEGER NOT NULL, definition JSONB NOT NULL DEFAULT '{}'::jsonb, status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')), created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, published_at TIMESTAMP WITH TIME ZONE, UNIQUE (organization_id, workflow_id, version), UNIQUE (organization_id, id));
      CREATE INDEX IF NOT EXISTS idx_workflow_versions_lookup ON workflow_versions(organization_id, workflow_id, version DESC);
      CREATE TABLE IF NOT EXISTS workflow_schedules (id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, workflow_id VARCHAR(64) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE, workflow_version_id VARCHAR(64) REFERENCES workflow_versions(id) ON DELETE RESTRICT, name VARCHAR(255) NOT NULL, schedule_type VARCHAR(20) NOT NULL DEFAULT 'once' CHECK (schedule_type IN ('once','interval','cron')), run_at TIMESTAMP WITH TIME ZONE, interval_seconds INTEGER, cron_expression VARCHAR(255), timezone VARCHAR(100) NOT NULL DEFAULT 'UTC', status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','completed','failed')), next_run_at TIMESTAMP WITH TIME ZONE, last_run_at TIMESTAMP WITH TIME ZONE, last_error TEXT, trigger_payload JSONB NOT NULL DEFAULT '{}'::jsonb, created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, CHECK (interval_seconds IS NULL OR interval_seconds > 0), CHECK (schedule_type <> 'interval' OR interval_seconds IS NOT NULL), CHECK (schedule_type <> 'once' OR run_at IS NOT NULL), CHECK (schedule_type <> 'cron' OR cron_expression IS NOT NULL));
      CREATE INDEX IF NOT EXISTS idx_workflow_schedules_due ON workflow_schedules(status, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_workflow_schedules_org ON workflow_schedules(organization_id, status, next_run_at);
      CREATE TABLE IF NOT EXISTS workflow_execution_steps (id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, workflow_run_id VARCHAR(64) NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE, workflow_step_id VARCHAR(128) NOT NULL, step_index INTEGER NOT NULL DEFAULT 0, action_type VARCHAR(50) NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','waiting','completed','failed','blocked','skipped')), attempt INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, scheduled_at TIMESTAMP WITH TIME ZONE, started_at TIMESTAMP WITH TIME ZONE, completed_at TIMESTAMP WITH TIME ZONE, idempotency_key VARCHAR(255) NOT NULL, input JSONB NOT NULL DEFAULT '{}'::jsonb, output JSONB, error TEXT, provider_reference VARCHAR(255), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, UNIQUE (organization_id, idempotency_key));
      CREATE INDEX IF NOT EXISTS idx_workflow_execution_steps_run ON workflow_execution_steps(organization_id, workflow_run_id, step_index);
      CREATE INDEX IF NOT EXISTS idx_workflow_execution_steps_due ON workflow_execution_steps(status, scheduled_at);
      CREATE TABLE IF NOT EXISTS workflow_execution_logs (id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, workflow_run_id VARCHAR(64) REFERENCES workflow_runs(id) ON DELETE CASCADE, workflow_step_id VARCHAR(128), level VARCHAR(20) NOT NULL DEFAULT 'info' CHECK (level IN ('debug','info','warn','error')), event VARCHAR(100) NOT NULL, message TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_workflow_execution_logs_run ON workflow_execution_logs(organization_id, workflow_run_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_jobs_workflow_due ON jobs(job_type, status, available_at);
    `,
  },

  {
    version: 19,
    name: '019_production_auth_account_management',
    sql: `
      CREATE TABLE IF NOT EXISTS organization_invites (
        id VARCHAR(128) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        invited_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        accepted_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_org_invites_org ON organization_invites(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_org_invites_email ON organization_invites(lower(email), expires_at);

      CREATE TABLE IF NOT EXISTS auth_sessions (
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS webhook_endpoints (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        url VARCHAR(2048) NOT NULL,
        events JSONB NOT NULL,
        enabled BOOLEAN DEFAULT true NOT NULL,
        description TEXT,
        secret VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON webhook_endpoints(organization_id);

      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id VARCHAR(64) PRIMARY KEY,
        endpoint_id VARCHAR(64) NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        event_id VARCHAR(128) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        url VARCHAR(2048) NOT NULL,
        status VARCHAR(50) NOT NULL,
        status_code INTEGER,
        attempts INTEGER DEFAULT 0 NOT NULL,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE
      );
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_org ON webhook_deliveries(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS voicemail_library (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        label VARCHAR(255) NOT NULL,
        url VARCHAR(2048) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_voicemail_library_org ON voicemail_library(organization_id, created_at DESC);

      ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false NOT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_backup_codes JSONB DEFAULT '[]'::jsonb NOT NULL;

      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500);
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS ip_address INET;
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS device_label VARCHAR(255);
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS mfa_verified_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMP WITH TIME ZONE;
      CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user
        ON auth_sessions(user_id, last_seen_at DESC)
        WHERE revoked_at IS NULL;

      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_email_verification_user
        ON email_verification_tokens(user_id, expires_at DESC);

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        used_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_password_reset_user
        ON password_reset_tokens(user_id, expires_at DESC);

      CREATE TABLE IF NOT EXISTS auth_mfa_challenges (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        challenge_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_mfa_challenges_user
        ON auth_mfa_challenges(user_id, expires_at DESC);

      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_email VARCHAR(320);
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'America/Los_Angeles' NOT NULL;

      CREATE TABLE IF NOT EXISTS organization_billing (
        organization_id VARCHAR(64) PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
        plan VARCHAR(40) NOT NULL DEFAULT 'free',
        subscription_status VARCHAR(40) NOT NULL DEFAULT 'active',
        billing_customer_id VARCHAR(255),
        billing_subscription_id VARCHAR(255),
        trial_ends_at TIMESTAMP WITH TIME ZONE,
        current_period_start TIMESTAMP WITH TIME ZONE,
        current_period_end TIMESTAMP WITH TIME ZONE,
        cancel_at_period_end BOOLEAN DEFAULT false NOT NULL,
        limits JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS organization_usage (
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        period_start DATE NOT NULL,
        metric VARCHAR(80) NOT NULL,
        used BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        PRIMARY KEY (organization_id, period_start, metric)
      );
      CREATE INDEX IF NOT EXISTS idx_organization_usage_period
        ON organization_usage(organization_id, period_start DESC);

      INSERT INTO organization_billing (organization_id, plan, subscription_status, limits)
      SELECT id, 'free', 'active',
        '{"users":5,"calls_month":250,"emails_month":500,"sms_month":100,"ai_actions_month":250,"properties":10000}'::jsonb
      FROM organizations
      ON CONFLICT (organization_id) DO NOTHING;

      UPDATE users SET email_verified_at = COALESCE(email_verified_at, created_at)
      WHERE email_verified_at IS NULL;
    `,
  },
  {
    version: 20,
    name: '020_create_reporting_analytics_layer',
    sql: `
      CREATE TABLE IF NOT EXISTS analytics_cost_events (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        campaign_id VARCHAR(64) REFERENCES campaign(id) ON DELETE SET NULL,
        category VARCHAR(50) NOT NULL,
        provider VARCHAR(100),
        quantity NUMERIC(18,6) NOT NULL DEFAULT 1,
        unit_cost_usd NUMERIC(18,6) NOT NULL DEFAULT 0,
        total_cost_usd NUMERIC(18,6) NOT NULL,
        reference_type VARCHAR(80),
        reference_id VARCHAR(128),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_cost_org_time
        ON analytics_cost_events(organization_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_cost_org_campaign
        ON analytics_cost_events(organization_id, campaign_id, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS analytics_ai_usage (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        agent_id VARCHAR(128),
        workflow_run_id VARCHAR(64) REFERENCES workflow_runs(id) ON DELETE SET NULL,
        provider VARCHAR(100) NOT NULL,
        model VARCHAR(150),
        operation VARCHAR(100) NOT NULL,
        input_tokens BIGINT NOT NULL DEFAULT 0,
        output_tokens BIGINT NOT NULL DEFAULT 0,
        total_tokens BIGINT NOT NULL DEFAULT 0,
        estimated_cost_usd NUMERIC(18,8) NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        success BOOLEAN NOT NULL DEFAULT true,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_ai_org_time
        ON analytics_ai_usage(organization_id, occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_ai_org_agent
        ON analytics_ai_usage(organization_id, agent_id, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS analytics_value_events (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL,
        property_id VARCHAR(64) REFERENCES properties(id) ON DELETE SET NULL,
        campaign_id VARCHAR(64) REFERENCES campaign(id) ON DELETE SET NULL,
        event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('revenue','acquisition_value','management_value','other')),
        amount_usd NUMERIC(18,2) NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        occurred_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_value_org_time
        ON analytics_value_events(organization_id, occurred_at DESC);

      CREATE TABLE IF NOT EXISTS appointments (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL,
        campaign_id VARCHAR(64) REFERENCES campaign(id) ON DELETE SET NULL,
        assigned_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'scheduled'
          CHECK (status IN ('scheduled','confirmed','completed','cancelled','no_show')),
        outcome VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_appointments_org_scheduled
        ON appointments(organization_id, scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_appointments_org_status
        ON appointments(organization_id, status);
    `,
  },
  {
    version: 21,
    name: '021_create_file_assets',
    sql: `
      CREATE TABLE IF NOT EXISTS file_assets (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        entity_type VARCHAR(50), entity_id VARCHAR(64), category VARCHAR(50) NOT NULL,
        original_name VARCHAR(512) NOT NULL, storage_bucket VARCHAR(255) NOT NULL,
        storage_path VARCHAR(1024) NOT NULL, mime_type VARCHAR(255) NOT NULL,
        size_bytes BIGINT NOT NULL DEFAULT 0, checksum_sha256 VARCHAR(64), description TEXT,
        extracted_text TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(30) NOT NULL DEFAULT 'pending', uploaded_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, deleted_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT uq_file_assets_org_storage UNIQUE (organization_id, storage_bucket, storage_path),
        CONSTRAINT ck_file_assets_status CHECK (status IN ('pending','ready','failed','deleted')),
        CONSTRAINT ck_file_assets_category CHECK (category IN ('property_document','owner_document','contract','photo','call_recording','call_transcript','import','export','other'))
      );
      CREATE INDEX IF NOT EXISTS idx_file_assets_org_created ON file_assets(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_file_assets_org_entity ON file_assets(organization_id, entity_type, entity_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_file_assets_org_category ON file_assets(organization_id, category, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_file_assets_search ON file_assets USING GIN (to_tsvector('simple', coalesce(original_name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(extracted_text,'')));
    `,
  },
  {
    version: 22,
    name: '022_create_workflow_communication_suppression',
    sql: `
      CREATE TABLE IF NOT EXISTS communication_suppression (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        channel VARCHAR(20) NOT NULL CHECK (channel IN ('email','sms','phone')),
        destination VARCHAR(320) NOT NULL,
        reason TEXT,
        source VARCHAR(100),
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE (organization_id, channel, destination)
      );
      CREATE INDEX IF NOT EXISTS idx_communication_suppression_lookup ON communication_suppression(organization_id, channel, destination);
    `,
  },
  {
    version: 23,
    name: '023_create_workflow_communication_deliveries',
    sql: `
      CREATE TABLE IF NOT EXISTS workflow_communication_deliveries (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        workflow_run_id VARCHAR(64) REFERENCES workflow_runs(id) ON DELETE SET NULL,
        workflow_step_id VARCHAR(128),
        channel VARCHAR(20) NOT NULL CHECK (channel IN ('email','sms','phone')),
        destination VARCHAR(320) NOT NULL,
        idempotency_key VARCHAR(255) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','manual_review')),
        provider_reference VARCHAR(255),
        error TEXT,
        request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE (organization_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_workflow_communication_delivery_status ON workflow_communication_deliveries(organization_id, status, updated_at);
    `,
  },
  {
    version: 24,
    name: '024_create_stripe_webhook_events',
    sql: `
      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        id VARCHAR(255) PRIMARY KEY,
        event_type VARCHAR(120) NOT NULL,
        payload JSONB NOT NULL,
        received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type_time
        ON stripe_webhook_events(event_type, received_at DESC);
    `,
  },

  {
    version: 25,
    name: '025_create_owner_enrichment',
    sql: `
      CREATE TABLE IF NOT EXISTS owner_enrichment_providers (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        provider_key VARCHAR(100) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        priority INTEGER NOT NULL DEFAULT 100,
        capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(organization_id, provider_key)
      );
      CREATE TABLE IF NOT EXISTS owner_enrichment_jobs (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
        property_id VARCHAR(64) REFERENCES properties(id) ON DELETE SET NULL,
        provider_key VARCHAR(100),
        job_type VARCHAR(50) NOT NULL DEFAULT 'FULL_ENRICHMENT',
        status VARCHAR(30) NOT NULL DEFAULT 'queued',
        requested_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
        records_found INTEGER NOT NULL DEFAULT 0,
        records_added INTEGER NOT NULL DEFAULT 0,
        records_updated INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_owner_enrichment_jobs_org_owner ON owner_enrichment_jobs(organization_id, owner_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS owner_source_records (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) REFERENCES property_owners(id) ON DELETE CASCADE,
        property_id VARCHAR(64) REFERENCES properties(id) ON DELETE SET NULL,
        enrichment_job_id VARCHAR(64) REFERENCES owner_enrichment_jobs(id) ON DELETE SET NULL,
        source_type VARCHAR(100) NOT NULL,
        provider_key VARCHAR(100),
        external_record_id VARCHAR(255),
        source_url TEXT,
        raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        raw_hash VARCHAR(64) NOT NULL,
        retrieved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_owner_source_records_org_owner ON owner_source_records(organization_id, owner_id, retrieved_at DESC);
      CREATE TABLE IF NOT EXISTS owner_contact_points (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL,
        value TEXT NOT NULL,
        normalized_value TEXT NOT NULL,
        contact_subtype VARCHAR(30),
        is_primary BOOLEAN NOT NULL DEFAULT false,
        is_verified BOOLEAN NOT NULL DEFAULT false,
        confidence_score NUMERIC(5,4),
        source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
        first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(organization_id, owner_id, type, normalized_value)
      );
      CREATE INDEX IF NOT EXISTS idx_owner_contact_points_org_owner ON owner_contact_points(organization_id, owner_id, type);
      CREATE TABLE IF NOT EXISTS owner_ownerships (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
        property_id VARCHAR(64) NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        ownership_type VARCHAR(50) NOT NULL DEFAULT 'record_owner',
        ownership_percentage NUMERIC(7,4),
        start_date DATE,
        end_date DATE,
        recorded_date DATE,
        source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
        confidence_score NUMERIC(5,4) NOT NULL DEFAULT 1,
        UNIQUE(organization_id, owner_id, property_id, ownership_type)
      );
      CREATE INDEX IF NOT EXISTS idx_owner_ownerships_org_owner ON owner_ownerships(organization_id, owner_id);
      CREATE TABLE IF NOT EXISTS owner_relationships (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
        related_entity_type VARCHAR(50) NOT NULL,
        related_entity_id VARCHAR(64),
        related_name VARCHAR(255) NOT NULL,
        relationship_type VARCHAR(50) NOT NULL,
        confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
        source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(organization_id, owner_id, related_entity_type, related_name, relationship_type)
      );
      CREATE TABLE IF NOT EXISTS owner_lead_signals (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
        property_id VARCHAR(64) REFERENCES properties(id) ON DELETE CASCADE,
        signal_type VARCHAR(80) NOT NULL,
        signal_value JSONB NOT NULL DEFAULT '{}'::jsonb,
        score NUMERIC(6,2) NOT NULL DEFAULT 0,
        confidence_score NUMERIC(5,4) NOT NULL DEFAULT 0.5,
        source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
        observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(organization_id, owner_id, property_id, signal_type)
      );
      CREATE INDEX IF NOT EXISTS idx_owner_lead_signals_org_owner ON owner_lead_signals(organization_id, owner_id, score DESC);
      CREATE TABLE IF NOT EXISTS owner_identity_matches (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
        candidate_name VARCHAR(255) NOT NULL,
        match_score NUMERIC(5,4) NOT NULL,
        match_status VARCHAR(30) NOT NULL DEFAULT 'candidate',
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `,
  },
  {
    version: 26,
    name: '026_create_unified_communications',
    sql: `
      ALTER TABLE outreach_templates DROP CONSTRAINT IF EXISTS outreach_templates_channel_check;
      ALTER TABLE outreach_templates ALTER COLUMN subject DROP NOT NULL;
      ALTER TABLE outreach_templates ADD CONSTRAINT outreach_templates_channel_check CHECK (channel IN ('email','sms','call_script'));

      CREATE TABLE IF NOT EXISTS communication_threads (
        id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        channel VARCHAR(20) NOT NULL CHECK (channel IN ('email','sms')), provider VARCHAR(100) NOT NULL,
        contact_key VARCHAR(320) NOT NULL, external_thread_id VARCHAR(255), subject TEXT,
        lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL, owner_id VARCHAR(64) REFERENCES property_owners(id) ON DELETE SET NULL,
        property_id VARCHAR(64) REFERENCES properties(id) ON DELETE SET NULL, last_message_at TIMESTAMP WITH TIME ZONE,
        created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_communication_threads_org_channel_time ON communication_threads(organization_id, channel, last_message_at DESC);
      CREATE INDEX IF NOT EXISTS idx_communication_threads_org_contact ON communication_threads(organization_id, channel, contact_key);
      CREATE INDEX IF NOT EXISTS idx_communication_threads_org_lead ON communication_threads(organization_id, lead_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS communication_messages (
        id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        thread_id VARCHAR(64) NOT NULL REFERENCES communication_threads(id) ON DELETE CASCADE,
        channel VARCHAR(20) NOT NULL CHECK (channel IN ('email','sms')), provider VARCHAR(100) NOT NULL,
        direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound','outbound')), external_message_id VARCHAR(255),
        from_address VARCHAR(320), to_address VARCHAR(320), subject TEXT, body TEXT NOT NULL, html_body TEXT,
        status VARCHAR(40) NOT NULL DEFAULT 'queued', error_message TEXT, tracking_token VARCHAR(128), idempotency_key VARCHAR(255),
        lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL, owner_id VARCHAR(64) REFERENCES property_owners(id) ON DELETE SET NULL,
        property_id VARCHAR(64) REFERENCES properties(id) ON DELETE SET NULL, created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        sent_at TIMESTAMP WITH TIME ZONE, received_at TIMESTAMP WITH TIME ZONE, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_communication_messages_org_idempotency ON communication_messages(organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_communication_messages_provider_external ON communication_messages(organization_id, provider, external_message_id) WHERE external_message_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_communication_messages_org_thread_time ON communication_messages(organization_id, thread_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_communication_messages_tracking ON communication_messages(tracking_token) WHERE tracking_token IS NOT NULL;

      CREATE TABLE IF NOT EXISTS communication_events (
        id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        message_id VARCHAR(64) NOT NULL REFERENCES communication_messages(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL, event_url TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_communication_events_org_message ON communication_events(organization_id, message_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS communication_suppressions (
        id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        channel VARCHAR(20) NOT NULL CHECK (channel IN ('email','sms','voice','all')), contact_key VARCHAR(320) NOT NULL,
        reason TEXT NOT NULL, source VARCHAR(100), created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE (organization_id, channel, contact_key)
      );
      CREATE INDEX IF NOT EXISTS idx_communication_suppressions_lookup ON communication_suppressions(organization_id, channel, contact_key);

      CREATE TABLE IF NOT EXISTS messaging_numbers (
        id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        provider VARCHAR(100) NOT NULL, phone_number VARCHAR(32) NOT NULL, friendly_name VARCHAR(255),
        capabilities JSONB NOT NULL DEFAULT '{}'::jsonb, status VARCHAR(30) NOT NULL DEFAULT 'active',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE (organization_id, provider, phone_number)
      );
      CREATE INDEX IF NOT EXISTS idx_messaging_numbers_org_status ON messaging_numbers(organization_id, status);

      CREATE TABLE IF NOT EXISTS communication_sequences (
        id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL, description TEXT, status VARCHAR(30) NOT NULL DEFAULT 'draft',
        created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_communication_sequences_org_status ON communication_sequences(organization_id, status, updated_at DESC);

      CREATE TABLE IF NOT EXISTS communication_sequence_steps (
        id VARCHAR(64) PRIMARY KEY, sequence_id VARCHAR(64) NOT NULL REFERENCES communication_sequences(id) ON DELETE CASCADE,
        step_order INTEGER NOT NULL, channel VARCHAR(20) NOT NULL CHECK (channel IN ('email','sms')),
        template_id VARCHAR(64) REFERENCES outreach_templates(id) ON DELETE SET NULL, delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, UNIQUE (sequence_id, step_order)
      );

      CREATE TABLE IF NOT EXISTS communication_sequence_enrollments (
        id VARCHAR(64) PRIMARY KEY, organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        sequence_id VARCHAR(64) NOT NULL REFERENCES communication_sequences(id) ON DELETE CASCADE,
        lead_id VARCHAR(64) NOT NULL REFERENCES leads(id) ON DELETE CASCADE, status VARCHAR(30) NOT NULL DEFAULT 'active',
        current_step_order INTEGER NOT NULL, next_run_at TIMESTAMP WITH TIME ZONE,
        created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL, UNIQUE (sequence_id, lead_id)
      );
      CREATE INDEX IF NOT EXISTS idx_communication_sequence_enrollments_due ON communication_sequence_enrollments(organization_id, status, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_communication_sequence_enrollments_lead ON communication_sequence_enrollments(organization_id, lead_id, status);
    `,
  },
  {
    version: 27,
    name: '027_create_file_processing_jobs',
    sql: `
      CREATE TABLE IF NOT EXISTS file_processing_jobs (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        file_id VARCHAR(64) NOT NULL REFERENCES file_assets(id) ON DELETE CASCADE,
        job_type VARCHAR(40) NOT NULL CHECK (job_type IN ('recording_archive','transcript_extract','document_extract','malware_scan')),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        locked_at TIMESTAMP WITH TIME ZONE,
        last_error TEXT,
        result JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (file_id, job_type)
      );
      CREATE INDEX IF NOT EXISTS idx_file_processing_jobs_ready ON file_processing_jobs(status, available_at);
      CREATE INDEX IF NOT EXISTS idx_file_processing_jobs_org ON file_processing_jobs(organization_id, created_at DESC);
    `,
  },

  {
    version: 28,
    name: '028_create_real_ai_agent_runtime',
    sql: `
      ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS provider VARCHAR(20);
      ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS max_retries INTEGER NOT NULL DEFAULT 3;
      ALTER TABLE agent_configs ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN NOT NULL DEFAULT true;

      CREATE TABLE IF NOT EXISTS agent_memories (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        agent_id VARCHAR(64) NOT NULL,
        memory_key VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        importance NUMERIC(4,3) NOT NULL DEFAULT 0.500,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UNIQUE(organization_id, agent_id, memory_key)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_memories_org_agent ON agent_memories(organization_id, agent_id, importance DESC, updated_at DESC);

      CREATE TABLE IF NOT EXISTS agent_runs (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        agent_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        objective TEXT NOT NULL,
        provider VARCHAR(20) NOT NULL,
        model VARCHAR(100) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'running',
        input_context JSONB NOT NULL DEFAULT '{}'::jsonb,
        output JSONB,
        error TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 3,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        estimated_cost_usd NUMERIC(14,8) NOT NULL DEFAULT 0,
        execution_time_ms INTEGER,
        pending_approval_id VARCHAR(64),
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE
      );
      CREATE INDEX IF NOT EXISTS idx_agent_runs_org_started ON agent_runs(organization_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_org_agent ON agent_runs(organization_id, agent_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_org_status ON agent_runs(organization_id, status, started_at DESC);

      CREATE TABLE IF NOT EXISTS agent_run_steps (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        run_id VARCHAR(64) NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
        step_no INTEGER NOT NULL,
        step_type VARCHAR(30) NOT NULL,
        tool_name VARCHAR(100),
        status VARCHAR(30) NOT NULL,
        input JSONB NOT NULL DEFAULT '{}'::jsonb,
        output JSONB NOT NULL DEFAULT '{}'::jsonb,
        error TEXT,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent_run_steps_org_run ON agent_run_steps(organization_id, run_id, step_no, created_at);
    `,
  },
  {
    version: 29,
    name: '029_billing_invoice_history',
    sql: `
      CREATE TABLE IF NOT EXISTS billing_invoices (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        stripe_invoice_id VARCHAR(255) NOT NULL UNIQUE,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        status VARCHAR(40),
        collection_method VARCHAR(40),
        currency VARCHAR(10),
        amount_due BIGINT,
        amount_paid BIGINT,
        amount_remaining BIGINT,
        hosted_invoice_url TEXT,
        invoice_pdf TEXT,
        period_start TIMESTAMP WITH TIME ZONE,
        period_end TIMESTAMP WITH TIME ZONE,
        due_date TIMESTAMP WITH TIME ZONE,
        paid_at TIMESTAMP WITH TIME ZONE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_created
        ON billing_invoices(organization_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_billing_invoices_org_status
        ON billing_invoices(organization_id, status, created_at DESC);
      UPDATE organization_billing
         SET limits = limits || CASE plan
           WHEN 'starter' THEN '{"enrichment_credits_month":500,"property_searches_month":2000,"storage_mb":5000}'::jsonb
           WHEN 'professional' THEN '{"enrichment_credits_month":5000,"property_searches_month":10000,"storage_mb":50000}'::jsonb
           WHEN 'enterprise' THEN '{"enrichment_credits_month":1000000,"property_searches_month":1000000,"storage_mb":1000000}'::jsonb
           ELSE '{"enrichment_credits_month":25,"property_searches_month":100,"storage_mb":500}'::jsonb
         END,
             updated_at=CURRENT_TIMESTAMP;
    `,
  },
  {
    version: 30,
    name: '030_harden_owner_signal_dedupe',
    sql: `
      ALTER TABLE owner_lead_signals
        DROP CONSTRAINT IF EXISTS owner_lead_signals_organization_id_owner_id_property_id_signal_type_key;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_lead_signals_property
        ON owner_lead_signals(organization_id, owner_id, property_id, signal_type)
        WHERE property_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_lead_signals_portfolio
        ON owner_lead_signals(organization_id, owner_id, signal_type)
        WHERE property_id IS NULL;
    `,
  },
  {
    version: 31,
    name: '031_owner_source_record_idempotency',
    sql: `
      CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_source_records_org_provider_hash
        ON owner_source_records(organization_id, provider_key, raw_hash);
    `,
  },
  {
    version: 32,
    name: '032_scope_agent_config_keys_to_organization',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'agent_configs'::regclass
            AND contype = 'p'
            AND conname = 'agent_configs_pkey'
        ) THEN
          ALTER TABLE agent_configs DROP CONSTRAINT agent_configs_pkey;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'agent_configs'::regclass
            AND contype = 'p'
            AND conname = 'agent_configs_org_id_pkey'
        ) THEN
          ALTER TABLE agent_configs
            ADD CONSTRAINT agent_configs_org_id_pkey PRIMARY KEY (organization_id, id);
        END IF;
      END $$;
      CREATE INDEX IF NOT EXISTS idx_agent_configs_org_id ON agent_configs(organization_id, id);
    `,
  },
  {
    version: 33,
    name: '033_owner_identity_match_candidate_reference',
    sql: `
      ALTER TABLE owner_identity_matches
        ADD COLUMN IF NOT EXISTS candidate_owner_id VARCHAR(64)
        REFERENCES property_owners(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_owner_identity_matches_candidate
        ON owner_identity_matches(organization_id, candidate_owner_id, match_score DESC);
    `,
  },
  {
    version: 34,
    name: '034_owner_enrichment_conflicts',
    sql: `
      CREATE TABLE IF NOT EXISTS owner_enrichment_conflicts (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
        conflict_type VARCHAR(50) NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        conflicting_value TEXT NOT NULL,
        conflicting_owner_id VARCHAR(64) REFERENCES property_owners(id) ON DELETE SET NULL,
        source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMPTZ
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_enrichment_conflict
        ON owner_enrichment_conflicts(
          organization_id, owner_id, conflict_type, field_name,
          conflicting_value, COALESCE(conflicting_owner_id, '')
        );
      CREATE INDEX IF NOT EXISTS idx_owner_enrichment_conflicts_org_owner
        ON owner_enrichment_conflicts(organization_id, owner_id, status, created_at DESC);
    `,
  },
  {
    version: 35,
    name: '035_create_native_property_map_spatial_layer',
    sql: `
      CREATE EXTENSION IF NOT EXISTS postgis;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS parcel_geometry JSONB;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS map_signals JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS hazard_flags JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE properties ADD COLUMN IF NOT EXISTS location geography(Point, 4326);
      CREATE INDEX IF NOT EXISTS idx_properties_location_gist ON properties USING GIST (location);
      CREATE INDEX IF NOT EXISTS idx_properties_org_lat_lon ON properties(organization_id, latitude, longitude);
      UPDATE properties SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location IS NULL;
    `,
  },
  {
    version: 36,
    name: '036_create_backup_events',
    sql: `
      CREATE TABLE IF NOT EXISTS backup_events (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        entity_type VARCHAR(64) NOT NULL,
        entity_id VARCHAR(128) NOT NULL,
        destination VARCHAR(32) NOT NULL CHECK (destination IN ('google_sheets','google_drive')),
        status VARCHAR(32) NOT NULL CHECK (status IN ('pending','success','failed')),
        content_hash VARCHAR(128) NOT NULL,
        external_id VARCHAR(255),
        external_url TEXT,
        error TEXT,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
        completed_at TIMESTAMP WITH TIME ZONE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_backup_events_destination
        ON backup_events(organization_id, entity_type, entity_id, destination, content_hash);
      CREATE INDEX IF NOT EXISTS idx_backup_events_org_status
        ON backup_events(organization_id, status, created_at DESC);
    `,
  },

  {
    version: 37,
    name: '037_extend_workflow_delivery_idempotency',
    sql: `
      ALTER TABLE workflow_communication_deliveries
        DROP CONSTRAINT IF EXISTS workflow_communication_deliveries_channel_check;
      ALTER TABLE workflow_communication_deliveries
        ADD CONSTRAINT workflow_communication_deliveries_channel_check
        CHECK (channel IN ('email','sms','phone','webhook'));
      CREATE INDEX IF NOT EXISTS idx_workflow_communication_deliveries_reconcile
        ON workflow_communication_deliveries(organization_id, status, updated_at);
    `,
  },
  {
    version: 38,
    name: '038_make_audit_logs_append_only',
    sql: `
      CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only';
      END;
      $$;

      DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
      CREATE TRIGGER trg_audit_logs_immutable
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_mutation();
    `,
  },
  {
    version: 39,
    name: '039_add_agent_run_controls',
    sql: `
      ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
      CREATE UNIQUE INDEX IF NOT EXISTS uq_agent_runs_org_idempotency
        ON agent_runs(organization_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_agent_runs_org_budget
        ON agent_runs(organization_id, started_at, estimated_cost_usd);
    `,
  },
  {
    version: 40,
    name: '040_ensure_owner_enrichment_conflicts',
    sql: `
      CREATE TABLE IF NOT EXISTS owner_enrichment_conflicts (
        id VARCHAR(64) PRIMARY KEY,
        organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        owner_id VARCHAR(64) NOT NULL REFERENCES property_owners(id) ON DELETE CASCADE,
        conflict_type VARCHAR(50) NOT NULL,
        field_name VARCHAR(100) NOT NULL,
        conflicting_value TEXT NOT NULL,
        conflicting_owner_id VARCHAR(64) REFERENCES property_owners(id) ON DELETE SET NULL,
        source_record_id VARCHAR(64) REFERENCES owner_source_records(id) ON DELETE SET NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'open',
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMPTZ
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_owner_enrichment_conflict
        ON owner_enrichment_conflicts(
          organization_id, owner_id, conflict_type, field_name,
          conflicting_value, COALESCE(conflicting_owner_id, '')
        );
      CREATE INDEX IF NOT EXISTS idx_owner_enrichment_conflicts_org_owner
        ON owner_enrichment_conflicts(organization_id, owner_id, status, created_at DESC);
    `,
  },
 ];

