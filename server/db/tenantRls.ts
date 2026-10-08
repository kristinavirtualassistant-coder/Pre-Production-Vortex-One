import type { Pool } from 'pg';

export const TENANT_RLS_TABLES = [
  'users','property_owners','properties','leads','crm_records','campaign','campaign_contact',
  'dialing_session','call','call_event','call_note','suppression_record','processed_events',
  'agent_configs','tasks','workflows','approvals','audit_logs','contacts','activities','jobs',
  'outreach_templates','email_outreach','integration_connections','integration_oauth_states',
  'workflow_runs','workflow_versions','workflow_schedules','workflow_execution_steps',
  'workflow_execution_logs','organization_invites','webhook_endpoints','webhook_deliveries',
  'backup_events','voicemail_library','organization_billing','organization_usage','analytics_cost_events',
  'analytics_ai_usage','analytics_value_events','appointments','file_assets',
  'communication_suppression','workflow_communication_deliveries','owner_enrichment_providers',
  'owner_enrichment_jobs','owner_source_records','owner_contact_points','owner_ownerships',
  'owner_relationships','owner_lead_signals','owner_identity_matches','communication_threads',
  'communication_messages','communication_events','communication_suppressions','messaging_numbers',
  'communication_sequences','communication_sequence_enrollments','file_processing_jobs',
  'agent_memories','agent_runs','agent_run_steps',
] as const;

/**
 * Explicit activation hook for a controlled deployment step.
 *
 * Do not call this until every tenant-sensitive request query is executed
 * inside a transaction carrying vortex_one.organization_id.
 */
export async function enableTenantRls(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const table of TENANT_RLS_TABLES) {
      await client.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await client.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}
