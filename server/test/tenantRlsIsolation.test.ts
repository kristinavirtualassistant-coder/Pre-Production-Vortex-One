import assert from 'node:assert/strict';
import { beginTenantContext, finishTenantContext } from '../db/tenantContext';
import { getPgPool } from '../db/db';

const tenantTables = [
  'property_owners','properties','leads','crm_records','campaign','campaign_contact',
  'dialing_session','call','call_event','call_note','suppression_record','processed_events',
  'agent_configs','tasks','workflows','approvals','audit_logs','contacts','activities',
  'outreach_templates','email_outreach','integration_connections','integration_oauth_states',
  'workflow_versions',
  '__REMOVED__','organization_invites','webhook_endpoints','webhook_deliveries',
  'voicemail_library','organization_billing','organization_usage','analytics_cost_events',
  'analytics_ai_usage','analytics_value_events','appointments','file_assets',
  'communication_suppression','workflow_communication_deliveries','owner_enrichment_providers',
  'owner_enrichment_jobs','owner_source_records','owner_contact_points','owner_ownerships',
  'owner_relationships','owner_lead_signals','owner_identity_matches','communication_threads',
  'communication_messages','communication_events','communication_suppressions','messaging_numbers',
  'communication_sequences','communication_sequence_enrollments','__REMOVED__',
  '__REMOVED__',
];

const pool = getPgPool();

if (!pool) {
  console.log('Tenant RLS integration test skipped: PostgreSQL is not configured.');
} else {
  const organizations = await pool.query('SELECT id FROM organizations ORDER BY id LIMIT 2');
  if (organizations.rows.length < 2) {
    console.log('Tenant RLS integration test skipped: at least two organizations are required.');
  } else {
    const [orgA, orgB] = organizations.rows.map((row: { id: string }) => row.id);

    for (const organizationId of [orgA, orgB]) {
      const client = await pool.connect();
      const context = await beginTenantContext(client, organizationId);
      try {
        const visible = await client.query('SELECT DISTINCT organization_id FROM properties');
        assert.ok(
          visible.rows.every((row: { organization_id: string }) => row.organization_id === organizationId),
          `RLS leaked property rows into tenant ${organizationId}`,
        );

        const crossTenant = await client.query(
          'SELECT COUNT(*)::int AS count FROM properties WHERE organization_id = $1',
          [organizationId === orgA ? orgB : orgA],
        );
        assert.equal(
          Number(crossTenant.rows[0]?.count || 0),
          0,
          `RLS allowed tenant ${organizationId} to see the other tenant's properties`,
        );
      } finally {
        await finishTenantContext(context, false);
      }
    }

    console.log('Tenant RLS cross-organization isolation checks passed.');
  }
}

console.log(`Tenant RLS policy inventory contains ${tenantTables.length} tenant-owned tables.`);
