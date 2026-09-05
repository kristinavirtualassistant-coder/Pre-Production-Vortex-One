import assert from 'node:assert/strict';
import { CampaignManager } from '../dialer/campaignManager';
import { inMemoryStore, setPgPoolForTests } from '../db/db';

const throwingPool = {
  query: async () => {
    throw new Error('simulated PostgreSQL outage');
  },
};

function resetMemory() {
  inMemoryStore.campaigns = [];
  inMemoryStore.campaignContacts = [];
}

resetMemory();
setPgPoolForTests(throwingPool as any);

const orgId = 'org_phase1';
const campaignId = 'camp_phase1';
inMemoryStore.campaigns.push({
  id: campaignId,
  organization_id: orgId,
  name: 'Phase 1 test campaign',
  description: '',
  status: 'draft',
  target_market: 'CA',
  telephony_provider: 'ringcentral',
  total_contacts: 0,
  dialed_count: 0,
  connected_count: 0,
  converted_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as any);

await assert.rejects(
  CampaignManager.createCampaign({ organizationId: orgId, name: 'DB outage create' }),
  /PostgreSQL is required for authoritative campaign state/
);
assert.equal(inMemoryStore.campaigns.length, 1, 'createCampaign must not mutate memory when PostgreSQL fails');

await assert.rejects(
  CampaignManager.startCampaign(orgId, campaignId, 'agent_phase1'),
  /PostgreSQL is required for authoritative campaign state/
);
assert.equal(inMemoryStore.campaigns[0].status, 'draft', 'startCampaign must not mutate memory when PostgreSQL fails');

await assert.rejects(
  CampaignManager.pauseCampaign(orgId, campaignId),
  /PostgreSQL is required for authoritative campaign state/
);
assert.equal(inMemoryStore.campaigns[0].status, 'draft', 'pauseCampaign must not mutate memory when PostgreSQL fails');

await assert.rejects(
  CampaignManager.stopCampaign(orgId, campaignId),
  /PostgreSQL is required for authoritative campaign state/
);
assert.equal(inMemoryStore.campaigns[0].status, 'draft', 'stopCampaign must not mutate memory when PostgreSQL fails');

await assert.rejects(
  CampaignManager.addContacts(orgId, campaignId, [{ contactName: 'Owner', phoneNumber: '+15625550123' }]),
  /PostgreSQL is required for authoritative campaign state/
);
assert.equal(inMemoryStore.campaignContacts.length, 0, 'addContacts must not mutate memory when PostgreSQL fails');

const staleCampaignId = 'camp_stale_memory_only';
inMemoryStore.campaigns.push({ ...inMemoryStore.campaigns[0], id: staleCampaignId, status: 'active' } as any);
inMemoryStore.campaignContacts.push({
  id: 'contact_stale',
  organization_id: orgId,
  campaign_id: staleCampaignId,
  contact_name: 'Stale owner',
  phone_number: '+15625550124',
  dial_status: 'queued',
  attempts: 0,
  priority: 1,
  created_at: new Date().toISOString(),
} as any);

await assert.rejects(
  CampaignManager.dialNextContact({ organizationId: orgId, campaignId: staleCampaignId }),
  /simulated PostgreSQL outage/
);
assert.equal(inMemoryStore.campaignContacts[0].dial_status, 'queued', 'dialNextContact must not claim stale in-memory contacts');


const successfulQueries: string[] = [];
const fakeClient = {
  query: async (sql: string) => {
    successfulQueries.push(sql);
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rowCount: 0, rows: [] };
    if (sql.includes('UPDATE campaign') || sql.includes('INSERT INTO dialing_session')) return { rowCount: 1, rows: [] };
    if (sql.includes('INSERT INTO campaign_contact')) return { rowCount: 1, rows: [] };
    return { rowCount: 1, rows: [] };
  },
  release: () => undefined,
};
const successfulPool = {
  query: async (sql: string) => {
    successfulQueries.push(sql);
    return { rowCount: 1, rows: [] };
  },
  connect: async () => fakeClient,
};

setPgPoolForTests(successfulPool as any);
resetMemory();
const successfulCampaign = await CampaignManager.createCampaign({ organizationId: orgId, name: 'DB success campaign' });
assert.equal(inMemoryStore.campaigns.length, 1, 'successful create mirrors the committed campaign in memory');
const successfulStart = await CampaignManager.startCampaign(orgId, successfulCampaign.id, 'agent_phase1');
assert.equal(successfulStart.session.status, 'active');
await CampaignManager.addContacts(orgId, successfulCampaign.id, [{ contactName: 'Owner', phoneNumber: '+15625550125' }]);
assert.equal(inMemoryStore.campaignContacts.length, 1, 'successful addContacts mirrors committed contacts in memory');
await CampaignManager.pauseCampaign(orgId, successfulCampaign.id);
assert.equal(inMemoryStore.campaigns[0].status, 'paused');
await CampaignManager.stopCampaign(orgId, successfulCampaign.id);
assert.equal(inMemoryStore.campaigns[0].status, 'completed');
assert(successfulQueries.includes('BEGIN') && successfulQueries.includes('COMMIT'), 'multi-step campaign mutations use PostgreSQL transactions');

setPgPoolForTests(null);

console.log('postgres authoritative state tests passed');
