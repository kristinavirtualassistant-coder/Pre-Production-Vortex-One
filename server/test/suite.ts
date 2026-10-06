/**
 * Vortex One - Backend & Infrastructure Automated Test Suite
 * Validates FSM, Telephony Adapters, Campaign Lifecycle, DNC Compliance, and Webhook Idempotency
 */

import { MIGRATIONS } from '../db/migrations';
import { getPgPool, inMemoryStore, seedInitialData, initializeDatabase } from '../db/db';
import { CallStateMachine } from '../dialer/fsm';
import { SuppressionService, normalizePhoneNumber, formatPhoneNumber } from '../dialer/suppressionService';
import { getTelephonyAdapter, RingCentralTelephonyAdapter } from '../dialer/telephonyAdapter';
import { CampaignManager } from '../dialer/campaignManager';
import { WebhookHandler } from '../dialer/webhookHandler';
import { DataImportService, RawPropertyRecord } from '../services/dataImportService';
import { UnifiedPropertyDataProvider, buildPropertySearchCachePayload, validateAndClassifyResult } from '../services/propertyProviders/PropertyDataProvider';
import { OrangeCountyGISProvider, normalizeOrangeCountyParcel } from '../services/propertyProviders/OrangeCountyGISProvider';
import { LosAngelesCountyGISProvider } from '../services/propertyProviders/LosAngelesCountyGISProvider';
import { SanDiegoCountyGISProvider } from '../services/propertyProviders/SanDiegoCountyGISProvider';
import { RiversideCountyGISProvider } from '../services/propertyProviders/RiversideCountyGISProvider';
import { SanBernardinoCountyGISProvider } from '../services/propertyProviders/SanBernardinoCountyGISProvider';
import { VenturaCountyGISProvider } from '../services/propertyProviders/VenturaCountyGISProvider';
import { SantaClaraCountyGISProvider } from '../services/propertyProviders/SantaClaraCountyGISProvider';
import { AlamedaCountyGISProvider } from '../services/propertyProviders/AlamedaCountyGISProvider';
import { SacramentoCountyGISProvider } from '../services/propertyProviders/SacramentoCountyGISProvider';
import {
  importCrmBatch,
  parsePropertyCsv,
  parsePropertyJson,
  normalizePhone,
  formatPhoneDisplay,
  validateReferentialIntegrity,
  TEST_ORG_ID,
} from '../../src/services/dataImportService';
import './callActionTenantBoundary.test';
import './agentOperationsService.test';
import './phase6AgentOperationsBoundary.test';
import './rbacRouteBoundary.test';
import './manualDialService.test';
import './realAgentRuntime.test';
import './localDevelopmentAuth.test';
import './localDevelopmentAuthMiddleware.test';
import './dispositionService.test';
import './schedulerTriggerContract.test';
import './workflowRunService.test';
import './accountSecurity.test';
import './workflowAutomationService.test';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, message?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${message || 'Assertion failed'}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log('\n========================================');
  console.log('  Vortex One - Automated Test Suite');
  console.log('========================================\n');

  // Initialize the authoritative PostgreSQL database when CI provides one.
  await initializeDatabase();

  // Initialize seed data for the in-memory compatibility fixtures used by legacy tests.
  seedInitialData();

  // CI uses a clean PostgreSQL database, so create the canonical test organization and
  // a telephony call fixture before exercising FK-constrained services.
  const pgPool = getPgPool();
  if (pgPool) {
    await pgPool.query(`
      INSERT INTO organizations (id, name, slug)
      VALUES
        ('org_cmc_realty', 'CMC Realty Test Organization', 'cmc-realty-test'),
        ('org_test', 'Vortex One Integration Test Organization', 'vortex-one-integration-test'),
        ('org_other_tenant', 'Vortex One Secondary Test Organization', 'vortex-one-secondary-test'),
        ('org_tenant_b', 'Vortex One Tenant B', 'vortex-one-tenant-b')
      ON CONFLICT (id) DO NOTHING
    `);
    await pgPool.query(`
      INSERT INTO call (id, organization_id, telephony_call_id, contact_name, phone_number, status)
      VALUES ('call_fixture_501', 'org_cmc_realty', 'call_501', 'CI Webhook Fixture', '(949) 555-0101', 'initiated')
      ON CONFLICT (id) DO UPDATE
        SET telephony_call_id = EXCLUDED.telephony_call_id, status = 'initiated'
    `);
  }

  // Test Group 1: Database Migration System Integrity
  console.log('[Group 1: Database Migration System]');
  assert(MIGRATIONS.length === 23, 'Migration list contains 23 defined migrations', `Expected 23, got ${MIGRATIONS.length}`);
  assert(MIGRATIONS.some((migration) => migration.version === 14 && migration.name === '014_create_integration_connections'), 'Integration migration 14 present', 'Expected integration migration 14 to be present');
  assert(MIGRATIONS.some((migration) => migration.version === 15 && migration.name === '015_create_durable_workflow_runs'), 'Workflow run migration 15 present', 'Expected workflow run migration 15 to be present');
  assert(MIGRATIONS.some((migration) => migration.version === 16 && migration.name === '016_create_shared_rate_limit_buckets'), 'Rate-limit migration 16 present', 'Expected rate-limit migration 16 to be present');
  assert(MIGRATIONS.some((migration) => migration.version === 17 && migration.name === '017_enforce_global_user_email_identity'), 'Global email identity migration 17 present', 'Expected global email identity migration 17 to be present');
  assert(MIGRATIONS.some((migration) => migration.version === 18 && migration.name === '018_create_workflow_automation_runtime'), 'Workflow automation migration 18 present', 'Expected workflow automation migration 18 to be present');
  assert(MIGRATIONS.some((migration) => migration.version === 19 && migration.name === '019_production_auth_account_management'), 'Production auth migration 19 present', 'Expected production auth migration 19 to be present');
  assert(MIGRATIONS.some((migration) => migration.version === 20 && migration.name === '020_create_reporting_analytics_layer'), 'Reporting analytics migration 20 present', 'Expected reporting analytics migration 20 to be present');
  assert(MIGRATIONS.some((migration) => migration.version === 22 && migration.name === '022_create_workflow_communication_suppression'), 'Communication suppression migration 22 present', 'Expected communication suppression migration 22 to be present');
  assert(MIGRATIONS.some((migration) => migration.version === 23 && migration.name === '023_create_workflow_communication_deliveries'), 'Workflow communication outbox migration 23 present', 'Expected workflow communication outbox migration 23 to be present');
  assert(MIGRATIONS.every((migration, index) => index === 0 || migration.version > MIGRATIONS[index - 1].version), 'Migration definitions are strictly ordered by version');
  
  const migrationNames = MIGRATIONS.map(m => m.name);
  assert(
    migrationNames.includes('001_create_core_platform_schema') &&
    migrationNames.includes('002_create_property_and_crm_schema') &&
    migrationNames.includes('003_create_dialer_production_schema') &&
    migrationNames.includes('004_create_multi_agent_system_schema'),
    'All core schema migrations present and properly ordered'
  );

  const dialerSql = MIGRATIONS.find(m => m.version === 3)?.sql || '';
  assert(dialerSql.includes('CREATE TABLE IF NOT EXISTS campaign'), 'Campaign table defined in migration 3');
  assert(dialerSql.includes('CREATE TABLE IF NOT EXISTS campaign_contact'), 'Campaign contact table defined');
  assert(dialerSql.includes('CREATE TABLE IF NOT EXISTS dialing_session'), 'Dialing session table defined');
  assert(dialerSql.includes('CREATE TABLE IF NOT EXISTS call'), 'Call table defined');
  assert(dialerSql.includes('CREATE TABLE IF NOT EXISTS call_event'), 'Call event table defined');
  assert(dialerSql.includes('CREATE TABLE IF NOT EXISTS call_note'), 'Call note table defined');
  assert(dialerSql.includes('CREATE TABLE IF NOT EXISTS suppression_record'), 'Suppression record table defined');
  assert(dialerSql.includes('CREATE TABLE IF NOT EXISTS processed_events'), 'Processed events table defined');

  // Test Group 2: Tenant Isolation & Foreign Key Integrity
  console.log('\n[Group 2: Tenant Isolation & Foreign Key Integrity]');
  const tenantCacheA = buildPropertySearchCachePayload({ address: '123 MAIN ST', city: 'Costa Mesa', organizationId: 'org-a' });
  const tenantCacheB = buildPropertySearchCachePayload({ address: '123 MAIN ST', city: 'Costa Mesa', organizationId: 'org-b' });
  assert(tenantCacheA.organizationId === 'org-a', 'Property search cache payload preserves tenant A');
  assert(tenantCacheB.organizationId === 'org-b', 'Property search cache payload preserves tenant B');
  assert(JSON.stringify(tenantCacheA) !== JSON.stringify(tenantCacheB), 'Property search cache payloads are isolated by organization');
  assert(dialerSql.includes('organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id)'), 'Strict multi-tenant organization isolation enforced in dialer tables');
  assert(dialerSql.includes('CONSTRAINT uq_suppression_org_phone UNIQUE(organization_id, phone_number)'), 'Suppression record scoped per organization');
  assert(dialerSql.includes('CONSTRAINT uq_campaign_contact_phone UNIQUE(campaign_id, phone_number)'), 'Contact deduplication per campaign');

  // Test Group 3: Telephony Call FSM Class
  console.log('\n[Group 3: Telephony Call FSM & State Machine]');
  const fsm = new CallStateMachine('queued');
  assert(fsm.currentStatus === 'queued', 'FSM initializes in queued state');

  const step1 = fsm.transition('initiated');
  assert(step1.success && fsm.currentStatus === 'initiated', 'FSM transition queued -> initiated');

  const step2 = fsm.transition('ringing');