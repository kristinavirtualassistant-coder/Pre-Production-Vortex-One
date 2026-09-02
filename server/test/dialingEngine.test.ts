import assert from 'node:assert/strict';
import { startDialingEngine } from '../dialer/dialingEngine';
import { CampaignManager } from '../dialer/campaignManager';

const original = CampaignManager.dialNextContact;
let calls = 0;
(CampaignManager as any).dialNextContact = async () => { calls += 1; return { status: 'queue_empty' }; };
const result = await startDialingEngine({ organizationId: 'org_test', campaignId: 'camp_test', concurrency: 7 });
assert.equal(result.concurrency, 7);
assert.equal(calls, 7);
(CampaignManager as any).dialNextContact = original;
console.log('dialing engine tests passed');
