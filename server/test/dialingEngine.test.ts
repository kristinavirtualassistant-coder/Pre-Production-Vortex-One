import assert from 'node:assert/strict';
import { startDialingEngine } from '../dialer/dialingEngine';
import { CampaignManager } from '../dialer/campaignManager';

const original = CampaignManager.dialNextContact;
let calls = 0;
let active = 0;
let maxActive = 0;
const outcomes = Array.from({ length: 8 }, () => ({ status: 'dialed' as const }));

(CampaignManager as any).dialNextContact = async () => {
  active += 1;
  maxActive = Math.max(maxActive, active);
  await new Promise((resolve) => setTimeout(resolve, 5));
  active -= 1;
  calls += 1;
  return outcomes[calls - 1] || { status: 'queue_empty' };
};

try {
  const result = await startDialingEngine({ organizationId: 'org_test', campaignId: 'camp_test', concurrency: 3 });
  assert.equal(result.concurrency, 3);
  assert.equal(calls, 11, 'workers should stop after the queue is empty is observed on each active line');
  assert.equal(maxActive, 3, 'engine must never exceed configured concurrency');
  assert.equal(result.dialed, 8);
} finally {
  (CampaignManager as any).dialNextContact = original;
}

console.log('dialing engine tests passed');
