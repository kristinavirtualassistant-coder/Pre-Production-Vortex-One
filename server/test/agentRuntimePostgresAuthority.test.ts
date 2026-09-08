import assert from 'node:assert/strict';
import { getAgentAnalytics, getLeadScoringInputs, scoreLead, searchOwners, updateLeadRecommendation } from '../services/agentRuntimeDataService';

const queries: Array<{ sql: string; values: unknown[] }> = [];
const fakePool = {
  async query(sql: string, values: unknown[] = []) {
    queries.push({ sql, values });
    if (sql.includes('FROM property_owners o')) {
      return { rows: [{ id: 'owner_1', organization_id: 'org_test', name: 'Owner One', entity_type: 'llc', mailing_address: '', mailing_city: '', mailing_state: 'CA', mailing_zip: '', phone_numbers: [], email_addresses: [], properties_owned_count: 3, total_portfolio_value: '2000000', total_portfolio_equity: '1500000', notes: null }] };
    }
    if (sql.includes('FROM properties p') && sql.includes('o.properties_owned_count')) {
      return { rows: [{ owner_id: 'owner_1', owner_name: 'Owner One', properties_owned_count: 3, property_id: 'prop_1', address: '1 Main St', estimated_equity: '1500000', is_absentee_owner: true }] };
    }
    if (sql.includes('UPDATE leads')) {
      return { rows: [{ id: 'lead_1', organization_id: 'org_test', owner_id: 'owner_1', primary_property_id: 'prop_1', lead_score: 85, classification: 'high_priority', factors: [], stage: 'qualified', assigned_agent: 'sub_agent_2', dnc_compliant: true, last_activity_date: new Date().toISOString(), next_recommended_action: 'Call', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] };
    }
    if (sql.includes('SELECT l.*, o.name')) {
      return { rows: [{ id: 'lead_1', organization_id: 'org_test', owner_id: 'owner_1', primary_property_id: 'prop_1', lead_score: 85, classification: 'high_priority', factors: [], stage: 'qualified', assigned_agent: 'sub_agent_2', dnc_compliant: true, last_activity_date: new Date().toISOString(), next_recommended_action: 'Call', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), owner_name: 'Owner One', property_address: '1 Main St', estimated_equity: '1500000', estimated_value: '2000000', units_count: 4, property_type: 'Multi-Family', city: 'Costa Mesa' }] };
    }
    if (sql.includes('SUM(estimated_value)')) return { rows: [{ valuation: '2000000', equity: '1500000' }] };
    if (sql.includes('COUNT(*)::int')) return { rows: [{ active: 2, high_priority: 1 }] };
    if (sql.includes('SUM(converted_count)')) return { rows: [{ converted: 1, connected: 4 }] };
    return { rows: [] };
  },
};

const owners = await searchOwners(fakePool as any, 'org_test', { name: 'Owner', minProperties: 2, limit: 10 });
assert.equal(owners.length, 1);
assert.equal(owners[0].organization_id, 'org_test');
assert.match(queries[0].sql, /o\.organization_id = \$1/);

const inputs = await getLeadScoringInputs(fakePool as any, 'org_test', 'owner_1', 'prop_1');
assert.equal(inputs.owner_id, 'owner_1');
const score = await scoreLead(fakePool as any, 'org_test', 'owner_1', 'prop_1');
assert.equal(score.lead_score, 100);
assert.equal(score.classification, 'high_priority');

const updated = await updateLeadRecommendation(fakePool as any, 'org_test', 'lead_1', 'Call');
assert.equal(updated?.id, 'lead_1');
assert.match(queries.find((q) => q.sql.includes('UPDATE leads'))!.sql, /organization_id = \$3/);

const analytics = await getAgentAnalytics(fakePool as any, 'org_test');
assert.equal(analytics.total_portfolio_equity, 1500000);
assert.equal(analytics.active_leads_count, 2);
assert.equal(analytics.campaign_conversion_rate_pct, 25);

await assert.rejects(() => searchOwners(fakePool as any, '', {}), /Organization ID is required/);
console.log('agent runtime postgres authority tests passed');
