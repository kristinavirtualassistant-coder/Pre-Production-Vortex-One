import assert from 'node:assert/strict';
import { CampaignManager } from '../dialer/campaignManager';
import { inMemoryStore } from '../db/db';

const campaignId = `test_empty_campaign_${Date.now()}`;
inMemoryStore.campaigns.unshift({
  id: campaignId, organization_id: 'org_test', name: 'Empty', description: '', status: 'active',
  target_market: 'CA', telephony_provider: 'ringcentral', total_contacts: 0, dialed_count: 0,
  connected_count: 0, converted_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
});
const result = await CampaignManager.dialNextContact({ organizationId: 'org_test', campaignId });
assert.equal(result.status, 'queue_empty');
assert.equal(result.contact, undefined);
console.log('no synthetic dialer contact test passed');
