import assert from 'node:assert/strict';
import { buildCampaignEligibilityQuery } from '../services/campaignEligibilityService';

const built = buildCampaignEligibilityQuery('org_test', 'camp_test', { retryLimit: 3 });
assert.match(built.text, /cc\.organization_id = \$1/);
assert.match(built.text, /cc\.campaign_id = \$2/);
assert.match(built.text, /cc\.dial_status = 'queued'/);
assert.match(built.text, /cc\.attempts < \$3/);
assert.match(built.text, /suppression_record/);
assert.match(built.text, /FOR UPDATE SKIP LOCKED/);
assert.deepEqual(built.values, ['org_test', 'camp_test', 3]);
assert.throws(() => buildCampaignEligibilityQuery('', 'camp_test'), /Organization ID is required/);
console.log('campaign eligibility tests passed');
