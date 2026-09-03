import assert from 'node:assert/strict';
import { buildCampaignEligibilityQuery } from '../services/campaignEligibilityService';

const result = buildCampaignEligibilityQuery('org_test', 'camp_test', { retryLimit: 4 });

assert.equal(result.values[0], 'org_test');
assert.equal(result.values[1], 'camp_test');
assert.equal(result.values[2], 4);
assert.match(result.text, /FOR UPDATE SKIP LOCKED/);
assert.match(result.text, /cc\.dial_status = 'queued'/);
assert.match(result.text, /cc\.attempts < \$3/);
assert.match(result.text, /c\.status = 'active'/);
assert.match(result.text, /CURRENT_TIME AT TIME ZONE c\.timezone/);
assert.match(result.text, /c\.calling_hours_start/);
assert.match(result.text, /c\.calling_hours_end/);
assert.match(result.text, /regexp_replace\(sr\.phone_number/);
assert.match(result.text, /regexp_replace\(cc\.phone_number/);
assert.match(result.text, /l\.dnc_compliant IS NULL OR l\.dnc_compliant = TRUE/);
assert.match(result.text, /ORDER BY COALESCE\(l\.lead_score, 0\) DESC/);
assert.match(result.text, /cc\.organization_id = \$1/);

assert.throws(
  () => buildCampaignEligibilityQuery('', 'camp_test'),
  /Organization ID is required/
);
assert.throws(
  () => buildCampaignEligibilityQuery('org_test', '   '),
  /Campaign ID is required/
);

console.log('campaign eligibility tests passed');
