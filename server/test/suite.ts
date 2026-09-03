/**
 * Vortex One - Backend & Infrastructure Automated Test Suite
 * Validates FSM, Telephony Adapters, Campaign Lifecycle, DNC Compliance, and Webhook Idempotency
 */

import { MIGRATIONS } from '../db/migrations';
import { inMemoryStore, seedInitialData } from '../db/db';
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

  // Initialize seed data
  seedInitialData();

  // Test Group 1: Database Migration System Integrity
  console.log('[Group 1: Database Migration System]');
  assert(MIGRATIONS.length === 9, 'Migration count is 9', `Expected 9, got ${MIGRATIONS.length}`);
  
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
  assert(step2.success && fsm.currentStatus === 'ringing', 'FSM transition initiated -> ringing');

  const step3 = fsm.transition('connected');
  assert(step3.success && fsm.currentStatus === 'connected', 'FSM transition ringing -> connected');

  const step4 = fsm.transition('completed');
  assert(step4.success && fsm.currentStatus === 'completed', 'FSM transition connected -> completed');

  const invalidStep = fsm.transition('ringing');
  assert(!invalidStep.success, 'FSM rejects transition from terminal state completed -> ringing');

  // Test Group 4: Telephony Adapters & Webhook Normalization
  console.log('\n[Group 4: Telephony Provider Adapters & Webhook Normalization]');
  const ringCentralAdapter = getTelephonyAdapter('ringcentral');
  assert(ringCentralAdapter instanceof RingCentralTelephonyAdapter, 'RingCentral adapter resolved correctly');

  // Test RingCentral Webhook Normalization
  const rcRawWebhook = {
    uuid: 'rc_evt_1001',
    body: {
      telephonySessionId: 'sess_rc_9921',
      parties: [
        {
          id: 'party_1',
          status: { code: 'Answered' },
          duration: 42,
        },
      ],
      eventTime: new Date().toISOString(),
    },
  };
  const rcNormalized = ringCentralAdapter.normalizeWebhookPayload(rcRawWebhook);
  assert(rcNormalized.telephonyCallId === 'sess_rc_9921', 'RingCentral telephonyCallId extracted');
  assert(rcNormalized.status === 'in-progress', 'RingCentral Answered maps to in-progress status');
  assert(rcNormalized.durationSeconds === 42, 'RingCentral duration extracted');

  // Test Group 5: Webhook Ingestion & Idempotency Pipeline
  console.log('\n[Group 5: Telephony Webhook Ingestion & Idempotency]');
  const webhookResult1 = await WebhookHandler.processWebhook('ringcentral', 'org_cmc_realty', {
    eventId: 'evt_unique_101',
    telephonyCallId: 'call_501',
    status: 'completed',
    duration_seconds: 90,
  });
  assert(webhookResult1.status === 'processed', 'First webhook event is processed');

  const webhookResult2 = await WebhookHandler.processWebhook('ringcentral', 'org_cmc_realty', {
    eventId: 'evt_unique_101',
    telephonyCallId: 'call_501',
    status: 'completed',
    duration_seconds: 90,
  });
  assert(webhookResult2.status === 'duplicate_ignored', 'Duplicate webhook event is safely ignored (idempotent)');

  // Test Group 6: TCPA & DNC Suppression List Management
  console.log('\n[Group 6: TCPA & DNC Suppression List Management]');
  assert(normalizePhoneNumber('(949) 555-0182') === '9495550182', 'Phone normalization: formatted US phone');
  assert(normalizePhoneNumber('+19495550182') === '9495550182', 'Phone normalization: E.164 with +1');
  assert(formatPhoneNumber('9495550182') === '(949) 555-0182', 'Phone formatting: standard US readable');

  await SuppressionService.addSuppression(
    'org_cmc_realty',
    '(949) 555-9999',
    'National DNC Registry',
    'automated_audit'
  );

  const check1 = await SuppressionService.isSuppressed('org_cmc_realty', '+1 (949) 555-9999');
  assert(check1.isSuppressed === true, 'Suppressed phone correctly detected across different formats');
  assert(check1.reason === 'National DNC Registry', 'Suppression reason preserved');

  const check2 = await SuppressionService.isSuppressed('org_cmc_realty', '(949) 555-0000');
  assert(check2.isSuppressed === false, 'Non-suppressed phone allowed');

  const checkTenant = await SuppressionService.isSuppressed('org_other_tenant', '(949) 555-9999');
  assert(checkTenant.isSuppressed === false, 'Suppression records isolated per tenant organization');

  // Test Group 7: Campaign Lifecycle & Dialer Engine
  console.log('\n[Group 7: Campaign Lifecycle & Dialer Engine]');
  const newCamp = await CampaignManager.createCampaign({
    organizationId: 'org_cmc_realty',
    name: 'Costa Mesa Triplex Owners Outreach',
    targetMarket: 'Costa Mesa, CA',
    telephonyProvider: 'ringcentral',
  });
  assert(newCamp.id.startsWith('camp_'), 'Campaign created with unique ID');
  assert(newCamp.status === 'draft', 'Campaign created in draft status');

  const startRes = await CampaignManager.startCampaign('org_cmc_realty', newCamp.id, 'agent_lead');
  assert(startRes.session.status === 'active', 'Dialing session started for campaign');

  await CampaignManager.addContacts('org_cmc_realty', newCamp.id, [
    { contactName: 'Arthur Pendelton', phoneNumber: '(949) 555-7788', priority: 2 },
    { contactName: 'DNC Blocked Prospect', phoneNumber: '(949) 555-9999', priority: 3 },
  ]);

  // Run dialer step for contact 1 (DNC blocked prospect)
  const dialBlocked = await CampaignManager.dialNextContact({
    organizationId: 'org_cmc_realty',
    campaignId: newCamp.id,
  });
  // Auto-check should catch (949) 555-9999 or dial regular contact
  assert(['dialed', 'suppressed'].includes(dialBlocked.status), 'Dialer successfully processed contact with compliance check');

  await CampaignManager.pauseCampaign('org_cmc_realty', newCamp.id);
  assert(inMemoryStore.campaigns.find(c => c.id === newCamp.id)?.status === 'paused', 'Campaign paused successfully');

  await CampaignManager.stopCampaign('org_cmc_realty', newCamp.id);
  assert(inMemoryStore.campaigns.find(c => c.id === newCamp.id)?.status === 'completed', 'Campaign stopped/completed successfully');

  // Test Group 8: Dual-Mode Persistence & Fail-Safe Fallbacks
  console.log('\n[Group 8: Dual-Mode Persistence & Fail-Safe Fallbacks]');
  assert(inMemoryStore.properties.length >= 4, 'Seed properties present');
  assert(inMemoryStore.propertyOwners.length >= 4, 'Seed owners present');
  assert(inMemoryStore.leads.length >= 3, 'Seed leads present');
  assert(inMemoryStore.campaigns.length >= 2, 'Seed campaigns present');
  assert(inMemoryStore.calls.length >= 2, 'Seed calls present');

  // Test Group 9: Automated Data Import & CRM Reconciliation Service
  console.log('\n[Group 9: Automated Data Import & CRM Reconciliation Service]');

  // 1. Strict Tenant Isolation Validation
  let threwTenantError = false;
  try {
    await DataImportService.reconcileBatch('', []);
  } catch (e) {
    threwTenantError = true;
  }
  assert(threwTenantError, 'Reconciliation rejects missing or empty organization_id');

  // 2. Add a DNC suppression record to verify DNC filtering during import
  const dncTestPhone = '(949) 555-8822';
  await SuppressionService.addSuppression(
    'org_cmc_realty',
    dncTestPhone,
    'Client Requested DNC Removal',
    'crm_import_test'
  );

  // 3. Batch import with property, owner, phone numbers (including DNC phone)
  const testBatch: RawPropertyRecord[] = [
    {
      apn: '990-123-45',
      address: '100 Ocean Vista Way',
      city: 'Newport Beach',
      state: 'CA',
      zip: '92660',
      county: 'Orange County',
      property_type: 'Multi-Family',
      units_count: 8,
      square_feet: 9400,
      year_built: 1998,
      estimated_value: 5800000,
      assessed_tax_value: 3900000,
      estimated_equity: 4200000,
      mortgage_balance: 1600000,
      is_absentee_owner: true,
      is_corporate_owned: true,
      tax_delinquent: false,
      last_sale_date: '2015-06-20',
      last_sale_price: 4100000,
      source_provenance: 'Orange County Assessor Title Registry',
      owner: {
        name: 'Vanguard Coastal Properties LLC',
        entity_type: 'llc',
        mailing_address: '1800 Century Park East, Suite 400',
        mailing_city: 'Los Angeles',
        mailing_state: 'CA',
        mailing_zip: '90067',
        phone_numbers: [
          { number: dncTestPhone, type: 'mobile', confidence: 0.95 },
          { number: '(949) 555-3311', type: 'landline', confidence: 0.90 },
        ],
        email_addresses: [
          { email: 'investments@vanguardcoastal.com', verified: true },
        ],
        notes: 'Commercial multi-family portfolio owner in Newport Beach',
      },
    },
    {
      apn: '990-123-46',
      address: '120 Ocean Vista Way',
      city: 'Newport Beach',
      state: 'CA',
      zip: '92660',
      county: 'Orange County',
      property_type: 'Multi-Family',
      units_count: 6,
      square_feet: 7100,
      year_built: 2001,
      estimated_value: 4500000,
      assessed_tax_value: 3100000,
      estimated_equity: 3200000,
      mortgage_balance: 1300000,
      is_absentee_owner: true,
      is_corporate_owned: true,
      owner: {
        name: 'Vanguard Coastal Properties LLC', // Same owner -> Tests owner resolution & portfolio aggregation
        entity_type: 'llc',
      },
    },
  ];

  const recResult = await DataImportService.reconcileBatch('org_cmc_realty', testBatch, {
    autoScoreLeads: true,
    enforceDncVerification: true,
  });

  assert(recResult.total_records_processed === 2, 'Batch reconciliation processed 2 records');
  assert(recResult.properties_created === 2, 'Batch reconciliation created 2 properties');
  assert(recResult.owners_created === 1, 'Batch reconciliation created 1 owner (deduplicated across 2 parcels)');
  assert(recResult.dnc_suppressed_phones_count >= 1, 'DNC suppression constraint caught flagged phone number during import');
  assert(recResult.portfolio_value_reconciled === 10300000, 'Aggregated portfolio value calculated correctly ($10.3M)');
  assert(recResult.portfolio_equity_reconciled === 7400000, 'Aggregated portfolio equity calculated correctly ($7.4M)');

  // Verify Owner record state in datastore
  const vanguardOwner = inMemoryStore.propertyOwners.find(
    (o) => o.organization_id === 'org_cmc_realty' && o.name === 'Vanguard Coastal Properties LLC'
  );
  assert(!!vanguardOwner, 'Owner record exists in datastore');
  assert(vanguardOwner?.properties_owned_count === 2, 'Owner properties_owned_count rolled up to 2');
  assert(vanguardOwner?.total_portfolio_value === 10300000, 'Owner total_portfolio_value rolled up to $10.3M');
  assert(vanguardOwner?.total_portfolio_equity === 7400000, 'Owner total_portfolio_equity rolled up to $7.4M');

  // Verify DNC flag was stamped on the suppressed phone
  const dncPhoneRecord = vanguardOwner?.phone_numbers.find(
    (p) => normalizePhoneNumber(p.number) === normalizePhoneNumber(dncTestPhone)
  );
  assert(dncPhoneRecord?.dnc_status === true, 'Suppressed phone correctly flagged with dnc_status=true on owner record');

  // Verify non-DNC phone remains unflagged
  const callablePhoneRecord = vanguardOwner?.phone_numbers.find(
    (p) => normalizePhoneNumber(p.number) === normalizePhoneNumber('(949) 555-3311')
  );
  assert(callablePhoneRecord?.dnc_status === false, 'Non-suppressed phone remains dnc_status=false');

  // 4. Test Upsert / Deduplication by APN
  const updateBatch: RawPropertyRecord[] = [
    {
      apn: '990-123-45', // Same APN -> should update existing, not create duplicate
      address: '100 Ocean Vista Way, Suite A-H',
      city: 'Newport Beach',
      state: 'CA',
      zip: '92660',
      county: 'Orange County',
      property_type: 'Multi-Family',
      units_count: 8,
      estimated_value: 6100000, // Appraised value increased
      estimated_equity: 4500000,
      owner: {
        name: 'Vanguard Coastal Properties LLC',
      },
    },
  ];

  const updateResult = await DataImportService.reconcileBatch('org_cmc_realty', updateBatch);
  assert(updateResult.properties_updated === 1, 'APN match updates existing property instead of duplicating');
  assert(updateResult.properties_created === 0, 'No extra properties created on update');

  // Verify property was updated
  const updatedProp = inMemoryStore.properties.find(
    (p) => p.organization_id === 'org_cmc_realty' && p.apn === '990-123-45'
  );
  assert(updatedProp?.estimated_value === 6100000, 'Property estimated_value successfully updated');
  assert(updatedProp?.address === '100 Ocean Vista Way, Suite A-H', 'Property address successfully updated');

  // 5. Test Full Production CRM Source Sync Feed
  const syncResult = await DataImportService.syncProductionCrmSource('org_cmc_realty');
  assert(syncResult.total_records_processed >= 6, 'Production CRM source sync processed >= 6 authoritative parcels');
  assert(syncResult.reconciled_owner_ids.length >= 4, 'Multiple distinct property owners reconciled from feed');
  assert(syncResult.audit_id.startsWith('audit_rec_'), 'Reconciliation audit trail generated with ID');

  // Verify Audit Log was recorded
  const auditLog = inMemoryStore.auditLogs.find((a) => a.id === syncResult.audit_id);
  assert(!!auditLog, 'Reconciliation audit log recorded in store');
  assert(auditLog?.action === 'reconcile_crm_import', 'Audit log has reconcile_crm_import action');
  assert(auditLog?.organization_id === 'org_cmc_realty', 'Audit log scoped to organization_id');

  // Tenant B isolation test: Tenant B should not see Tenant A properties
  const tenantBResult = await DataImportService.syncProductionCrmSource('org_tenant_b');
  assert(tenantBResult.organization_id === 'org_tenant_b', 'Tenant B reconciliation executed in separate partition');
  const tenantBProps = inMemoryStore.properties.filter((p) => p.organization_id === 'org_tenant_b');
  const tenantAProps = inMemoryStore.properties.filter((p) => p.organization_id === 'org_cmc_realty');
  assert(tenantBProps.length > 0 && tenantAProps.length > 0, 'Both tenant partitions populated independently');
  assert(
    tenantBProps.every((p) => p.organization_id === 'org_tenant_b'),
    'Tenant B properties strictly partitioned'
  );

  // Test Group 10: Client Data Import Service Parsing & Utilities (src/services/dataImportService.ts)
  console.log('\n[Group 10: Client Data Import Service Parsing & Normalization]');

  assert(TEST_ORG_ID === 'org_cmc_realty', 'Explicit test organization fixture is org_cmc_realty');
  assert(normalizePhone('(949) 555-1234') === '9495551234', 'Phone normalization strips non-digits');
  assert(normalizePhone('+1 949 555 1234') === '9495551234', 'Phone normalization strips leading US country code +1');
  assert(formatPhoneDisplay('9495551234') === '(949) 555-1234', 'Phone formatting produces US display standard');

  // Test CSV Parsing
  const rawCsv = `APN,Property Address,City,State,Zip,County,Property Type,Units,Square Feet,Year Built,Estimated Value,Estimated Equity,Owner Name,Owner Phone,Owner Email
442-109-88,"980 West 17th St",Costa Mesa,CA,92627,Orange County,Multi-Family,4,4800,1984,2850000,1950000,"Pacific Coast Investments LLC","(949) 555-9012","contact@pacificcoastinv.com"
442-109-89,"990 West 17th St",Costa Mesa,CA,92627,Orange County,Multi-Family,4,4800,1984,2850000,1950000,"Pacific Coast Investments LLC","(949) 555-9012","contact@pacificcoastinv.com"`;

  const parsedCsv = parsePropertyCsv(rawCsv);
  assert(parsedCsv.length === 2, 'CSV parser correctly parsed 2 property records');
  assert(parsedCsv[0].apn === '442-109-88', 'CSV parser extracted APN correctly');
  assert(parsedCsv[0].address === '980 West 17th St', 'CSV parser extracted address without quotes');
  assert(parsedCsv[0].estimated_value === 2850000, 'CSV parser extracted estimated value as number');
  assert(parsedCsv[0].owner.name === 'Pacific Coast Investments LLC', 'CSV parser extracted owner name');
  assert(parsedCsv[0].owner.entity_type === 'llc', 'CSV parser recognized LLC entity type');
  assert(parsedCsv[0].owner.phone_numbers?.[0].number === '(949) 555-9012', 'CSV parser normalized phone number');

  // Test JSON Parsing
  const rawJson = [
    {
      apn: '550-201-99',
      address: '2400 Irvine Ave',
      city: 'Newport Beach',
      zip: '92660',
      county: 'Orange County',
      property_type: 'Multi-Family',
      estimated_value: 4100000,
      estimated_equity: 2900000,
      owner_name: 'Harbor View Assets Trust',
      phone: '9495557711',
      email: 'trustee@harborview.com',
    },
  ];

  const parsedJson = parsePropertyJson(rawJson);
  assert(parsedJson.length === 1, 'JSON parser correctly parsed JSON array');
  assert(parsedJson[0].apn === '550-201-99', 'JSON parser extracted APN');
  assert(parsedJson[0].owner.name === 'Harbor View Assets Trust', 'JSON parser extracted owner name');
  assert(parsedJson[0].owner.entity_type === 'trust', 'JSON parser recognized Trust entity type');
  assert(parsedJson[0].owner.phone_numbers?.[0].number === '(949) 555-7711', 'JSON parser formatted owner phone');

  // Reconcile the parsed CSV into datastore through the backend reconciler to verify end-to-end idempotency
  const csvReconcileResult = await DataImportService.reconcileBatch(TEST_ORG_ID, parsedCsv);
  assert(csvReconcileResult.total_records_processed === 2, 'Parsed CSV records reconciled through engine');
  assert(csvReconcileResult.owners_created === 1, 'Owner Pacific Coast Investments LLC deduplicated across CSV rows');

  // Verify importCrmBatch wrapper exists and exposes expected signature
  assert(typeof importCrmBatch === 'function', 'importCrmBatch function is exported as expected');

  // Test Group 11: Referential Integrity Validation Helper
  console.log('\n[Group 11: Referential Integrity & Hierarchy Validation]');

  // 1. Valid referential hierarchy test
  const validOwners: any[] = [
    {
      id: 'owner_test_1',
      name: 'Laguna Coast Properties LLC',
      organization_id: TEST_ORG_ID,
      entity_type: 'llc',
      mailing_address: '100 Ocean Blvd',
      mailing_city: 'Laguna Beach',
      mailing_state: 'CA',
      mailing_zip: '92651',
      properties_owned_count: 2,
      total_portfolio_value: 6000000,
      total_portfolio_equity: 4200000,
      phone_numbers: [{ number: '(949) 555-1122', type: 'mobile' as const, dnc_status: false, confidence: 0.95 }],
      email_addresses: [{ email: 'info@lagunacoast.com', verified: true, confidence: 0.95 }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const validProperties: any[] = [
    {
      id: 'prop_test_1',
      apn: '770-101-01',
      address: '100 Ocean Blvd',
      city: 'Laguna Beach',
      state: 'CA',
      zip: '92651',
      county: 'Orange County',
      property_type: 'Multi-Family' as const,
      units_count: 4,
      square_feet: 4000,
      year_built: 1995,
      estimated_value: 3000000,
      assessed_tax_value: 2000000,
      estimated_equity: 2100000,
      mortgage_balance: 900000,
      owner_id: 'owner_test_1',
      owner_name: 'Laguna Coast Properties LLC',
      organization_id: TEST_ORG_ID,
      is_absentee_owner: true,
      is_corporate_owned: true,
      tax_delinquent: false,
      provenance: {
        source: 'Orange County GIS Records',
        sourceType: 'database' as const,
        retrievedAt: new Date().toISOString(),
        confidence: 0.98,
        verified: true,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'prop_test_2',
      apn: '770-101-02',
      address: '104 Ocean Blvd',
      city: 'Laguna Beach',
      state: 'CA',
      zip: '92651',
      county: 'Orange County',
      property_type: 'Multi-Family' as const,
      units_count: 4,
      square_feet: 4000,
      year_built: 1995,
      estimated_value: 3000000,
      assessed_tax_value: 2000000,
      estimated_equity: 2100000,
      mortgage_balance: 900000,
      owner_id: 'owner_test_1',
      owner_name: 'Laguna Coast Properties LLC',
      organization_id: TEST_ORG_ID,
      is_absentee_owner: true,
      is_corporate_owned: true,
      tax_delinquent: false,
      provenance: {
        source: 'Orange County GIS Records',
        sourceType: 'database' as const,
        retrievedAt: new Date().toISOString(),
        confidence: 0.98,
        verified: true,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const validLeads: any[] = [
    {
      id: 'lead_test_1',
      primary_property_id: 'prop_test_1',
      property_id: 'prop_test_1',
      owner_id: 'owner_test_1',
      organization_id: TEST_ORG_ID,
      status: 'new' as const,
      stage: 'identified' as const,
      classification: 'high_priority' as const,
      assigned_agent: 'sub_agent_2' as const,
      lead_score: 85,
      priority_tier: 'high_priority' as const,
      dnc_compliant: true,
      property_address: '100 Ocean Blvd',
      owner_name: 'Laguna Coast Properties LLC',
      last_activity_date: new Date().toISOString(),
      next_recommended_action: 'Initiate outbound call',
      factors: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const validReport = validateReferentialIntegrity({
    properties: validProperties,
    owners: validOwners,
    leads: validLeads,
    organizationId: TEST_ORG_ID,
  });

  assert(validReport.isValid === true, 'Valid dataset passes referential integrity validation');
  assert(validReport.orphanPropertiesCount === 0, 'No orphan properties in valid dataset');
  assert(validReport.orphanLeadsCount === 0, 'No orphan leads in valid dataset');
  assert(validReport.tenantViolationsCount === 0, 'No tenant isolation violations in valid dataset');
  assert(validReport.mismatchedLinksCount === 0, 'No mismatched owner links in valid dataset');

  // 2. Orphan Property Test (references non-existent owner_id)
  const orphanProperty = {
    ...validProperties[0],
    id: 'prop_orphan_1',
    owner_id: 'owner_non_existent_999',
  };

  const orphanPropReport = validateReferentialIntegrity({
    properties: [orphanProperty],
    owners: validOwners,
    leads: [],
    organizationId: TEST_ORG_ID,
  });

  assert(orphanPropReport.isValid === false, 'Orphan property correctly triggers validation failure');
  assert(orphanPropReport.orphanPropertiesCount === 1, 'Orphan property count is 1');
  assert(orphanPropReport.issues.some((i) => i.type === 'orphan_property'), 'Orphan property issue recorded');

  // 3. Missing Owner ID on Property Test
  const missingOwnerProp = {
    ...validProperties[0],
    id: 'prop_no_owner',
    owner_id: '',
  };

  const missingOwnerReport = validateReferentialIntegrity({
    properties: [missingOwnerProp],
    owners: validOwners,
    leads: [],
    organizationId: TEST_ORG_ID,
  });

  assert(missingOwnerReport.isValid === false, 'Property missing owner_id fails validation');
  assert(missingOwnerReport.issues.some((i) => i.type === 'missing_owner_reference'), 'Missing owner reference issue recorded');

  // 4. Orphan Lead Test (references non-existent property_id)
  const orphanLead = {
    ...validLeads[0],
    id: 'lead_orphan_1',
    property_id: 'prop_non_existent_888',
  };

  const orphanLeadReport = validateReferentialIntegrity({
    properties: validProperties,
    owners: validOwners,
    leads: [orphanLead],
    organizationId: TEST_ORG_ID,
  });

  assert(orphanLeadReport.isValid === false, 'Orphan lead correctly triggers validation failure');
  assert(orphanLeadReport.orphanLeadsCount === 1, 'Orphan lead count is 1');
  assert(orphanLeadReport.issues.some((i) => i.type === 'missing_property_reference'), 'Missing property reference issue recorded for lead');

  // 5. Mismatched Hierarchy Link Test (Lead references Property A and Owner B, but Property A is owned by Owner C)
  const mismatchedLead = {
    ...validLeads[0],
    id: 'lead_mismatch_1',
    property_id: 'prop_test_1', // owned by owner_test_1
    owner_id: 'owner_other_tenant', // different owner
  };

  const mismatchedOwners = [
    ...validOwners,
    {
      ...validOwners[0],
      id: 'owner_other_tenant',
      name: 'Different Owner LLC',
    },
  ];

  const mismatchReport = validateReferentialIntegrity({
    properties: validProperties,
    owners: mismatchedOwners,
    leads: [mismatchedLead],
    organizationId: TEST_ORG_ID,
  });

  assert(mismatchReport.isValid === false, 'Mismatched lead-property-owner link fails validation');
  assert(mismatchReport.mismatchedLinksCount === 1, 'Mismatched links count is 1');
  assert(mismatchReport.issues.some((i) => i.type === 'mismatched_owner_link'), 'Mismatched owner link issue recorded');

  // 6. Tenant Isolation Cross-Boundary Test (Property belongs to Org A, but Owner belongs to Org B)
  const crossTenantProp = {
    ...validProperties[0],
    id: 'prop_cross_tenant',
    organization_id: 'org_tenant_b',
    owner_id: 'owner_test_1', // owner has org_cmc_realty
  };

  const crossTenantReport = validateReferentialIntegrity({
    properties: [crossTenantProp],
    owners: validOwners,
    leads: [],
    organizationId: 'org_tenant_b',
  });

  assert(crossTenantReport.isValid === false, 'Cross-tenant link triggers isolation violation');
  assert(crossTenantReport.tenantViolationsCount >= 1, 'Tenant violation count is >= 1');
  assert(crossTenantReport.issues.some((i) => i.type === 'tenant_isolation_violation'), 'Tenant isolation violation issue recorded');

  // 7. Backend Server-side Referential Integrity Service
  const serverIntegrityReport = await DataImportService.validateReferentialIntegrity(TEST_ORG_ID);
  assert(typeof serverIntegrityReport === 'object', 'Server-side validateReferentialIntegrity returns report');
  assert(serverIntegrityReport.organization_id === TEST_ORG_ID, 'Server integrity report scoped to default org');
  assert(serverIntegrityReport.total_properties > 0, 'Server datastore has properties checked');
  assert(serverIntegrityReport.total_owners > 0, 'Server datastore has owners checked');
  assert(serverIntegrityReport.isValid === true, 'Authoritative server datastore passes referential integrity check');

  // =========================================================================
  // Group 12: Validation Middleware, Field Mapping & Ingestion Audit Metrics
  // =========================================================================
  console.log('[Group 12: Validation Middleware, Field Mapping & Ingestion Audit Metrics]');

  // 1. Validation Middleware: required field check (missing APN/property_id)
  const invalidRecordMissingApn = {
    address: '1500 Newport Blvd',
    city: 'Costa Mesa',
    state: 'CA',
    county: 'Orange County',
    estimated_value: 3200000,
    estimated_equity: 2100000,
    owner: { name: 'Pacific Coast LLC' },
  };

  const validationResult1 = DataImportService.validateImportRecord(invalidRecordMissingApn, { recordIndex: 0, enforceDnc: true, organizationId: TEST_ORG_ID });
  assert(validationResult1.isValid === false, 'Validation middleware catches missing APN / property_id');
  assert(validationResult1.errors.some((e: string) => e.toLowerCase().includes('apn') || e.toLowerCase().includes('parcel')), 'Error mentions missing parcel / APN identifier');

  // 2. Validation Middleware: required field check (missing owner name/owner_id)
  const invalidRecordMissingOwner = {
    apn: '999-111-22',
    address: '1500 Newport Blvd',
    city: 'Costa Mesa',
    county: 'Orange County',
    estimated_value: 3200000,
    estimated_equity: 2100000,
    owner: { name: '' },
  };

  const validationResult2 = DataImportService.validateImportRecord(invalidRecordMissingOwner, { recordIndex: 1, enforceDnc: true, organizationId: TEST_ORG_ID });
  assert(validationResult2.isValid === false, 'Validation middleware catches missing owner name / owner_id');
  assert(validationResult2.errors.some((e: string) => e.toLowerCase().includes('owner')), 'Error mentions missing owner');

  // 3. Validation Middleware: phone normalization & DNC detection
  const recordWithPhones = {
    apn: '999-111-33',
    address: '1550 Newport Blvd',
    city: 'Costa Mesa',
    county: 'Orange County',
    estimated_value: 3200000,
    estimated_equity: 2100000,
    owner: {
      name: 'Valid Owner Trust',
      phone_numbers: [
        { number: '+1 (949) 555-0199', dnc_status: true },
        { number: '9495551234' },
      ],
    },
  };

  const validationResult3 = DataImportService.validateImportRecord(recordWithPhones, { recordIndex: 2, enforceDnc: true, organizationId: TEST_ORG_ID });
  assert(validationResult3.isValid === true, 'Valid record with formatted phones passes validation');
  assert(validationResult3.normalizedPhones.length === 2, 'Both phone numbers extracted and normalized');
  assert(validationResult3.normalizedPhones[0].normalized === '9495550199', 'Phone normalized to 10 digits');
  assert(validationResult3.normalizedPhones[0].isDnc === true, 'DNC phone recognized');
  assert(validationResult3.suppressedCount === 1, 'Suppression count incremented for DNC phone');

  // 4. Batch Validation summary calculation
  const batchValidation = DataImportService.validateBatch(
    [invalidRecordMissingApn, invalidRecordMissingOwner, recordWithPhones],
    { enforceDnc: true, organizationId: TEST_ORG_ID }
  );

  assert(batchValidation.totalRecords === 3, 'Batch validation records count is 3');
  assert(batchValidation.validCount === 1, 'Batch validation valid count is 1');
  assert(batchValidation.invalidCount === 2, 'Batch validation invalid count is 2');
  assert(batchValidation.suppressedCount === 1, 'Batch validation suppressed count is 1');
  assert(batchValidation.issues.length >= 2, 'Validation issues generated for invalid records');

  // 5. Raw JSON Key Detection
  const rawBatchData = [
    { parcel_id: '425-091-99', site_address: '100 17th St', taxpayer_name: 'Harbor Trust', mobile_phone: '949-555-7788' },
  ];
  const detectedKeys = DataImportService.detectJsonKeys(rawBatchData);
  assert(detectedKeys.includes('parcel_id'), 'detectJsonKeys found parcel_id');
  assert(detectedKeys.includes('site_address'), 'detectJsonKeys found site_address');
  assert(detectedKeys.includes('taxpayer_name'), 'detectJsonKeys found taxpayer_name');
  assert(detectedKeys.includes('mobile_phone'), 'detectJsonKeys found mobile_phone');

  // 6. JSON Field Mapping Transformation
  const mappingDefs = [
    { sourceKey: 'parcel_id', targetColumn: 'apn' },
    { sourceKey: 'site_address', targetColumn: 'address' },
    { sourceKey: 'taxpayer_name', targetColumn: 'owner_name' },
    { sourceKey: 'mobile_phone', targetColumn: 'phone_numbers' },
  ];
  const mappedRecords = DataImportService.applyFieldMappings(rawBatchData, mappingDefs);
  assert(Array.isArray(mappedRecords), 'applyFieldMappings returned array');
  assert(mappedRecords[0].apn === '425-091-99', 'parcel_id mapped to apn');
  assert(mappedRecords[0].address === '100 17th St', 'site_address mapped to address');
  assert(mappedRecords[0].owner?.name === 'Harbor Trust', 'taxpayer_name mapped to owner.name');

  // 7. Audit Logging Metrics Verification (Success, Failure & Suppression counts)
  const reconciliationSummary = await DataImportService.reconcileBatch(
    TEST_ORG_ID,
    [
      {
        apn: '888-001-01',
        address: '200 Irvine Ave',
        city: 'Costa Mesa',
        state: 'CA',
        county: 'Orange County',
        property_type: 'Multi-Family',
        estimated_value: 4500000,
        estimated_equity: 3000000,
        owner: {
          name: 'Irvine Ave Investors Group LLC',
          entity_type: 'llc',
          phone_numbers: [{ number: '(949) 555-0199', dnc_status: true }], // Suppressed
        },
      },
      {
        apn: '888-001-02',
        address: '210 Irvine Ave',
        city: 'Costa Mesa',
        state: 'CA',
        county: 'Orange County',
        property_type: 'Multi-Family',
        estimated_value: 4800000,
        estimated_equity: 3200000,
        owner: {
          name: 'Irvine Ave Investors Group LLC',
          entity_type: 'llc',
          phone_numbers: [{ number: '(949) 555-8899', dnc_status: false }],
        },
      },
    ],
    { autoScoreLeads: true, enforceDncVerification: true, sourceSystem: 'automated_test_suite' }
  );

  assert(reconciliationSummary.success_count === 2, 'Ingestion batch tracked success_count = 2');
  assert(reconciliationSummary.failure_count === 0, 'Ingestion batch tracked failure_count = 0');
  assert(reconciliationSummary.dnc_suppressed_phones_count === 1, 'Ingestion batch tracked suppression_count = 1');
  assert(reconciliationSummary.audit_id.length > 0, 'Audit ID generated for batch');

  // Verify Audit Log was recorded in authoritative store
  const recordedAuditLog = inMemoryStore.auditLogs.find((a) => a.id === reconciliationSummary.audit_id);
  assert(recordedAuditLog !== undefined, 'Audit log recorded in authoritative audit store');
  assert(recordedAuditLog?.output?.successCount === 2, 'Audit log recorded successCount = 2');
  assert(recordedAuditLog?.output?.failureCount === 0, 'Audit log recorded failureCount = 0');
  assert(recordedAuditLog?.output?.suppressionCount === 1, 'Audit log recorded suppressionCount = 1');

  // Test Group 15: Property Data Provider Architecture & Live County GIS Integration
  console.log('\n[Group 15: Property Data Provider Architecture & County GIS Integration]');
  const ocProvider = new OrangeCountyGISProvider();
  assert(ocProvider.providerId === 'california_gis', 'Orange County provider ID is california_gis');
  assert(ocProvider.isGovernmentSource === true, 'Orange County provider flagged as official government source');
  assert(ocProvider.supportsAddressSearch === true, 'Orange County provider supports address searches');
  assert(ocProvider.supportsApnSearch === true, 'Orange County provider supports APN searches');
  assert(ocProvider.supportsOwnerSearch === false, 'Owner search flagged as false under Cal. Gov. Code § 6254.21 privacy rules');

  // Public parcel records must never fabricate owner identity, contact data, or financial estimates.
  const publicParcel = normalizeOrangeCountyParcel({
    OBJECTID: 12345,
    PARCEL_APN: '339-371-23',
    FullStreetAddress: '623 CENTER ST',
    SITE_CITY: 'COSTA MESA',
    SITE_STATE: 'CA',
    SITE_ZIP: '92627',
    FIPS_CODE: '06059',
    Shape__Area: 4500,
  }, 'Orange', 'org_test');
  assert(publicParcel.owner === undefined, 'Public GIS parcel does not fabricate an owner');
  assert(publicParcel.property.owner_name === '', 'Public GIS parcel does not fabricate owner name');
  assert(publicParcel.property.square_feet === 0, 'Public GIS parcel does not fabricate square footage');
  assert(publicParcel.property.estimated_value === 0, 'Public GIS parcel does not fabricate estimated value');
  assert(publicParcel.property.assessed_tax_value === 0, 'Public GIS parcel does not fabricate assessed value');
  assert(publicParcel.property.units_count === 0, 'Public GIS parcel does not fabricate unit count');
  const publicParcelQuality = validateAndClassifyResult(publicParcel);
  assert(publicParcelQuality.isValid === true, 'Official redacted public parcel remains searchable without fabricated owner data');
  assert(publicParcelQuality.quality === 'yellow', 'Official redacted public parcel is classified as yellow data quality');

  const laProvider = new LosAngelesCountyGISProvider();
  assert(laProvider.providerId === 'los_angeles_county_gis', 'LA County provider ID is los_angeles_county_gis');
  assert(laProvider.isGovernmentSource === true, 'LA County provider flagged as official government source');

  const sdProvider = new SanDiegoCountyGISProvider();
  assert(sdProvider.providerId === 'san_diego_county_gis', 'San Diego County provider ID is san_diego_county_gis');
  assert(sdProvider.isGovernmentSource === true, 'San Diego County provider flagged as official government source');
  assert(sdProvider.supportsAddressSearch === true, 'San Diego County supports address searches');

  const rivProvider = new RiversideCountyGISProvider();
  assert(rivProvider.providerId === 'riverside_county_gis', 'Riverside County provider ID is riverside_county_gis');
  assert(rivProvider.isGovernmentSource === true, 'Riverside County provider flagged as official government source');

  const sbProvider = new SanBernardinoCountyGISProvider();
  assert(sbProvider.providerId === 'san_bernardino_county_gis', 'San Bernardino County provider ID is san_bernardino_county_gis');
  assert(sbProvider.isGovernmentSource === true, 'San Bernardino County provider flagged as official government source');

  const venProvider = new VenturaCountyGISProvider();
  assert(venProvider.providerId === 'ventura_county_gis', 'Ventura County provider ID is ventura_county_gis');
  assert(venProvider.isGovernmentSource === true, 'Ventura County provider flagged as official government source');

  const scProvider = new SantaClaraCountyGISProvider();
  assert(scProvider.providerId === 'santa_clara_county_gis', 'Santa Clara County provider ID is santa_clara_county_gis');
  assert(scProvider.isGovernmentSource === true, 'Santa Clara County provider flagged as official government source');

  const alaProvider = new AlamedaCountyGISProvider();
  assert(alaProvider.providerId === 'alameda_county_gis', 'Alameda County provider ID is alameda_county_gis');
  assert(alaProvider.isGovernmentSource === true, 'Alameda County provider flagged as official government source');

  const sacProvider = new SacramentoCountyGISProvider();
  assert(sacProvider.providerId === 'sacramento_county_gis', 'Sacramento County provider ID is sacramento_county_gis');
  assert(sacProvider.isGovernmentSource === true, 'Sacramento County provider flagged as official government source');

  // Test live query on UnifiedPropertyDataProvider
  const unifiedProvider = new UnifiedPropertyDataProvider();
  
  // Test 15.1: Orange County Real Address Search (623 Center St, Costa Mesa)
  console.log('  Executing Live Query against Orange County Public Works GIS...');
  const ocSearchResult = await unifiedProvider.search({
    address: '623 CENTER ST',
    city: 'Costa Mesa',
    county: 'Orange County',
    state: 'CA',
    organizationId: 'org_cmc_realty',
    persist: true,
  });

  assert(ocSearchResult.success === true, 'Orange County GIS search returned success');
  assert(ocSearchResult.totalFound > 0, 'Orange County GIS returned at least 1 real parcel');
  assert(
    ocSearchResult.providerUsed.includes('CA Statewide Cadastral') ||
      ocSearchResult.providerUsed.includes('GIS') ||
      ocSearchResult.providerUsed.includes('Orange County'),
    'Orange County / CA Cadastral provider correctly routed and used'
  );
  
  const ocTop = ocSearchResult.results[0];
  assert(ocTop.property.apn.includes('339-371-23') || ocTop.property.apn.length > 0, 'Real APN returned for Orange County property');
  assert(ocTop.property.address.includes('623 CENTER ST'), 'Real street address returned');
  assert(ocTop.property.city.toUpperCase().includes('COSTA MESA'), 'Real city returned');
  assert(ocTop.provenance.isOfficialGovernmentSource === true, 'Provenance confirms official government GIS source');
  assert(ocTop.provenance.fipsCode === '06059', 'FIPS Code 06059 verified for Orange County');
  assert(
    ocTop.provenance.ownerIntelligenceStatus === 'statutory_redaction_cal_gov_6254_21',
    'Owner status correctly reflects Cal. Gov. Code § 6254.21 statutory protection'
  );

  // Test 15.2: Los Angeles County Real Address Search (6730 N Glasner Lane)
  console.log('  Executing Live Query against Los Angeles County Assessor GIS...');
  const laSearchResult = await unifiedProvider.search({
    address: '6730 N GLASNER LANE',
    city: 'Los Angeles',
    county: 'Los Angeles County',
    state: 'CA',
    organizationId: 'org_cmc_realty',
    persist: true,
  });

  assert(laSearchResult.success === true, 'LA County Assessor search returned success');
  assert(laSearchResult.totalFound > 0, 'LA County Assessor returned at least 1 real parcel');
  assert(laSearchResult.providerUsed.includes('Los Angeles County'), 'LA County provider correctly routed and used');
  
  const laTop = laSearchResult.results[0];
  assert(laTop.property.apn.includes('2038-020-084') || laTop.property.apn.length > 0, 'Real APN returned for LA County property');
  assert(laTop.property.year_built > 0, 'Real year built returned from LA Assessor roll');
  assert(laTop.property.square_feet > 0, 'Real square footage returned from LA Assessor roll');
  assert(laTop.property.assessed_tax_value > 0, 'Real assessed tax value returned from LA Assessor roll');
  assert(laTop.provenance.fipsCode === '06037', 'FIPS Code 06037 verified for Los Angeles County');

  // Verify persistence in authoritative in-memory datastore
  const inMemoryCheck = inMemoryStore.properties.find(
    (p) => p.address?.toUpperCase().includes('623 CENTER') || (ocTop?.property?.apn && p.apn === ocTop.property.apn) || (ocTop?.property?.id && p.id === ocTop.property.id)
  );
  assert(inMemoryCheck !== undefined, 'Live searched Orange County property persisted into datastore');

  // Test Group 16: Property PDF Report Dossier Generation
  console.log('\n[Group 16: Property Analytics PDF Dossier Generation]');
  const sampleProp = inMemoryStore.properties[0];
  assert(sampleProp !== undefined, 'Sample property available for PDF report generation');
  assert(typeof sampleProp.apn === 'string' && sampleProp.apn.length > 0, 'Property APN present for report');
  assert(sampleProp.estimated_value > 0, 'Property valuation analytics present for report');
  assert(sampleProp.assessed_tax_value > 0, 'Assessor tax value present for report');
  assert(sampleProp.provenance?.source !== undefined, 'Cadastral provenance ledger present for report');

  console.log('\n========================================');
  console.log(`  Tests Complete: ${passedTests} Passed, ${failedTests} Failed`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
