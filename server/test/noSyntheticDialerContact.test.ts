import assert from 'node:assert/strict';
import { CampaignManager } from '../dialer/campaignManager';
import { inMemoryStore, setPgPoolForTests } from '../db/db';

const campaignId = `test_empty_campaign_${Date.now()}`;
inMemoryStore.campaigns.unshift({
  id: campaignId, organization_id: 'org_test', name: 'Empty', description: '', status: 'active',
  target_market: 'CA', telephony_provider: 'ringcentral', total_contacts: 0, dialed_count: 0,
  connected_count: 0, converted_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
});

setPgPoolForTests(null);
await assert.rejects(
  CampaignManager.dialNextContact({ organizationId: 'org_test', campaignId }),
  /PostgreSQL is required for authoritative campaign state/
);
assert.equal(inMemoryStore.campaigns.find((c) => c.id === campaignId)?.status, 'active');
console.log('no synthetic dialer contact test passed');
