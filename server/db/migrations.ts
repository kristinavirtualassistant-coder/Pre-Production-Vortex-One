/**
 * Vortex One - Production-Grade PostgreSQL Schema Migration System
 * Handles automated version tracking, transactional migrations, and table bootstrap
 */

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
];
