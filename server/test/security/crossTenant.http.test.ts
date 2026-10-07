/**
 * Cross-tenant isolation over real HTTP, in production mode, as a least-privileged database role.
 * Tenant A creates records. Tenant B (a full admin of ITS OWN organization) attempts to read, modify, delete,
 * download and execute them. Every attempt must be refused (403/404), reveal nothing about the record, and
 * leave tenant A's data untouched.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { api, cleanupTestTenants, createTestTenant, pass, requirePool, startTestApp } from './httpHarness';

const MARKER = `A-SECRET-${randomUUID().slice(0, 8)}`;
const app = await startTestApp();
const pool = requirePool();
const A = await createTestTenant(app, 'ctA', 'admin');
const B = await createTestTenant(app, 'ctB', 'admin');
const orgs = [A.organizationId, B.organizationId];

const ids = { campaign: '', workflow: '', webhook: '', lead: '', owner: '', property: '', call: '', session: '' };

// 410 = the legacy route is retired in production for everyone (no tenant data is reachable through it).
function refused(status: number) { return status === 403 || status === 404 || status === 410; }

async function probe(name: string, method: string, path: string, body?: unknown) {
  const result = await api(app, method, path, B, body);
  assert.ok(refused(result.status), `${name}: expected 403/404 for cross-tenant access, got ${result.status} ${result.text.slice(0, 200)}`);
  assert.ok(!result.text.includes(MARKER), `${name}: response leaked tenant A data`);
  pass(`${name} -> ${result.status}`);
}

try {
  // ---- Tenant A fixtures (created through the real API where one exists) ----
  const campaign = await api(app, 'POST', '/api/campaigns', A, { name: `${MARKER} campaign` });
  assert.equal(campaign.status, 201, campaign.text);
  ids.campaign = campaign.json.id;

  const workflow = await api(app, 'POST', '/api/workflows', A, { name: `${MARKER} workflow`, steps: [] });
  assert.ok([200, 201].includes(workflow.status), workflow.text);
  ids.workflow = workflow.json.workflow_id ?? workflow.json.id;

  const webhook = await api(app, 'POST', '/api/webhooks', A, { url: 'https://93.184.216.34/hook', events: ['lead.enriched'], description: MARKER });
  assert.equal(webhook.status, 201, webhook.text);
  ids.webhook = webhook.json.id;

  ids.owner = `owner_${MARKER}`;
  await pool.query("INSERT INTO property_owners (id, organization_id, name) VALUES ($1,$2,$3)", [ids.owner, A.organizationId, `${MARKER} owner`]);
  ids.lead = `lead_${MARKER}`;
  await pool.query("INSERT INTO leads (id, organization_id, owner_id, lead_score, stage) VALUES ($1,$2,$3,50,'identified')", [ids.lead, A.organizationId, ids.owner]);
  ids.call = `call_${MARKER}`;
  await pool.query("INSERT INTO call (id, organization_id, telephony_call_id, contact_name, phone_number, status) VALUES ($1,$2,$3,$4,'+13105550142','completed')", [ids.call, A.organizationId, `tel_${MARKER}`, `${MARKER} contact`]);
  ids.session = `sess_${MARKER}`;
  await pool.query("INSERT INTO dialing_session (id, organization_id, campaign_id, agent_user_id, status, started_at, calls_placed, contacts_reached) VALUES ($1,$2,$3,$4,'active',NOW(),0,0)", [ids.session, A.organizationId, ids.campaign, A.userId]);

  // Guard against vacuous tests: every fixture must really exist, owned by tenant A, before B probes it.
  for (const [table, id] of [['campaign', ids.campaign], ['workflows', ids.workflow], ['webhook_endpoints', ids.webhook], ['leads', ids.lead], ['property_owners', ids.owner], ['call', ids.call], ['dialing_session', ids.session]] as const) {
    assert.ok(id, `fixture id for ${table} must be defined`);
    const owned = await pool.query(`SELECT organization_id FROM ${table} WHERE id = $1`, [id]);
    assert.equal(owned.rows[0]?.organization_id, A.organizationId, `fixture ${table}/${id} must exist and belong to tenant A`);
  }
  pass('all tenant A fixtures exist and are owned by tenant A before any cross-tenant probe');

  console.log('\n--- Security: tenant B cannot LIST tenant A data ---');
  for (const path of ['/api/campaigns', '/api/leads', '/api/workflows', '/api/webhooks', '/api/calls', '/api/owners', '/api/tasks', '/api/approvals', '/api/audit']) {
    const result = await api(app, 'GET', path, B);
    assert.ok(result.status === 200 || refused(result.status), `${path} returned ${result.status}`);
    assert.ok(!result.text.includes(MARKER), `${path} leaked tenant A data to tenant B`);
  }
  pass('list endpoints return nothing belonging to tenant A');

  console.log('\n--- Security: campaigns (read / modify / execute) ---');
  await probe('GET campaign contacts', 'GET', `/api/campaigns/${ids.campaign}/contacts`);
  await probe('POST campaign schedule', 'POST', `/api/campaigns/${ids.campaign}/schedule`, { scheduled_at: new Date(Date.now() + 3600_000).toISOString() });
  await probe('POST campaign cancel-schedule', 'POST', `/api/campaigns/${ids.campaign}/cancel-schedule`, {});
  await probe('POST campaign start (execute)', 'POST', `/api/campaigns/${ids.campaign}/start`, {});
  await probe('POST campaign pause', 'POST', `/api/campaigns/${ids.campaign}/pause`, {});
  await probe('POST campaign stop', 'POST', `/api/campaigns/${ids.campaign}/stop`, {});
  await probe('POST campaign add contacts', 'POST', `/api/campaigns/${ids.campaign}/contacts`, { contacts: [{ contactName: 'x', phoneNumber: '+13105550143' }] });
  await probe('POST campaign dial-next (execute)', 'POST', `/api/campaigns/${ids.campaign}/dial-next`, {});
  await probe('POST campaign dial-batch (execute)', 'POST', `/api/campaigns/${ids.campaign}/dial-batch`, {});
  await probe('POST campaign shuffle', 'POST', `/api/campaigns/${ids.campaign}/shuffle`, {});
  await probe('POST /api/dial-batch against A campaign', 'POST', '/api/dial-batch', { campaignId: ids.campaign, leads: [{ phoneNumber: '+13105550144' }] });

  // B's own campaign + A's dialing session id must not touch A's session counters.
  const ownCampaign = await api(app, 'POST', '/api/campaigns', B, { name: 'B own campaign' });
  assert.equal(ownCampaign.status, 201);
  await api(app, 'POST', `/api/campaigns/${ownCampaign.json.id}/contacts`, B, { contacts: [{ contactName: 'b', phoneNumber: '+13105550145' }] });
  const foreignSession = await api(app, 'POST', `/api/campaigns/${ownCampaign.json.id}/dial-next`, B, { session_id: ids.session });
  assert.ok(refused(foreignSession.status) || foreignSession.status === 400, `foreign dialing session id must be refused, got ${foreignSession.status}`);
  const session = (await pool.query('SELECT calls_placed, contacts_reached FROM dialing_session WHERE id=$1', [ids.session])).rows[0];
  assert.deepEqual([Number(session.calls_placed), Number(session.contacts_reached)], [0, 0], "tenant A's dialing session counters must be untouched");
  pass("a foreign dialing session id cannot be used to modify tenant A's session counters");

  const state = (await pool.query('SELECT status FROM campaign WHERE id=$1', [ids.campaign])).rows[0];
  assert.equal(state.status, 'draft');
  const seeded = await pool.query('SELECT 1 FROM campaign_contact WHERE campaign_id=$1', [ids.campaign]);
  assert.equal(seeded.rowCount, 0, "tenant B must not be able to pre-seed contacts into tenant A's campaign");
  pass("tenant A's campaign is unchanged (still draft, no foreign contacts)");

  console.log('\n--- Security: workflows ---');
  await probe('GET workflow', 'GET', `/api/workflows/${ids.workflow}`);
  await probe('PUT workflow', 'PUT', `/api/workflows/${ids.workflow}`, { name: 'hijacked' });
  await probe('DELETE workflow', 'DELETE', `/api/workflows/${ids.workflow}`);
  await probe('POST workflow version', 'POST', `/api/workflows/${ids.workflow}/versions`, {});
  await probe('GET workflow versions', 'GET', `/api/workflows/${ids.workflow}/versions`);
  await probe('POST workflow schedule', 'POST', `/api/workflows/${ids.workflow}/schedules`, { schedule_type: 'interval', interval_seconds: 3600 });
  await probe('GET workflow schedules', 'GET', `/api/workflows/${ids.workflow}/schedules`);
  // B supplying A's workflow_id on create/upsert must not overwrite or reveal A's workflow.
  const upsertAttack = await api(app, 'POST', '/api/workflows', B, { workflow_id: ids.workflow, name: 'hijacked-by-B', steps: [] });
  assert.ok(!upsertAttack.text.includes(MARKER), 'upsert with a foreign workflow_id must not reveal tenant A data');
  const wf = (await pool.query('SELECT name, organization_id FROM workflows WHERE id=$1', [ids.workflow])).rows[0];
  assert.ok(wf, `tenant A's workflow must still exist (id=${ids.workflow})`);
  assert.equal(wf.organization_id, A.organizationId);
  assert.ok(String(wf.name).includes(MARKER), `tenant A's workflow name must be unchanged (got ${JSON.stringify(wf)})`);
  pass("tenant A's workflow still exists, unmodified");

  console.log('\n--- Security: webhook endpoints and deliveries ---');
  await probe('PUT webhook endpoint', 'PUT', `/api/webhooks/${ids.webhook}`, { url: 'https://93.184.216.35/evil', events: ['lead.enriched'] });
  await probe('DELETE webhook endpoint', 'DELETE', `/api/webhooks/${ids.webhook}`);
  await probe('POST webhook test (execute)', 'POST', `/api/webhooks/${ids.webhook}/test`, {});
  await probe('GET webhook deliveries', 'GET', `/api/webhooks/${ids.webhook}/deliveries`);
  const endpoint = (await pool.query('SELECT url FROM webhook_endpoints WHERE id=$1', [ids.webhook])).rows[0];
  assert.equal(endpoint?.url, 'https://93.184.216.34/hook');
  pass("tenant A's webhook endpoint is unchanged");

  console.log('\n--- Security: leads, owners, enrichment ---');
  await probe('PATCH lead', 'PATCH', `/api/leads/${ids.lead}`, { stage: 'won' });
  await probe('DELETE lead', 'DELETE', `/api/leads/${ids.lead}`);
  await probe('POST lead batch-delete', 'POST', '/api/leads/batch-delete', { leadIds: [ids.lead] });
  await probe('GET owner profile', 'GET', `/api/owner-enrichment/${ids.owner}`);
  await probe('POST owner enrichment (execute)', 'POST', `/api/owner-enrichment/${ids.owner}/enrich`, {});
  const lead = (await pool.query('SELECT stage FROM leads WHERE id=$1', [ids.lead])).rows[0];
  assert.equal(lead?.stage, 'identified');
  pass("tenant A's lead still exists with its original stage");

  console.log('\n--- Security: calls and recordings ---');
  await probe('GET call events', 'GET', `/api/calls/${ids.call}/events`);
  await probe('PATCH call', 'PATCH', `/api/calls/${ids.call}`, { disposition: 'interested' });
  await probe('POST call note', 'POST', `/api/calls/${ids.call}/notes`, { note: 'hijack' });
  await probe('POST call end', 'POST', `/api/calls/${ids.call}/end`, {});
  await probe('POST call disposition', 'POST', `/api/calls/${ids.call}/disposition`, { disposition: 'interested' });
  await probe('POST call drop-voicemail (execute)', 'POST', `/api/calls/${ids.call}/drop-voicemail`, {});
  await probe('POST call suggest-task', 'POST', `/api/calls/${ids.call}/suggest-task`, {});
  const call = (await pool.query('SELECT status, disposition FROM call WHERE id=$1', [ids.call])).rows[0];
  assert.equal(call.status, 'completed');
  assert.ok(!call.disposition || call.disposition !== 'interested');
  pass("tenant A's call record is unchanged");

  console.log('\n--- Security: SMS sender ownership ---');
  const sms = await api(app, 'POST', '/api/communications/sms/send', B, { to: '+13105550146', body: 'hi', from: '+15005550006' });
  assert.ok(refused(sms.status), `a sender number not registered to the organization must be refused, got ${sms.status}`);
  pass('SMS from a number not registered to the caller organization is refused');
} finally {
  await pool.query('DELETE FROM dialing_session WHERE organization_id = ANY($1)', [orgs]).catch(() => {});
  for (const table of ['call', 'leads', 'property_owners', 'webhook_deliveries', 'webhook_endpoints', 'workflows', 'campaign_contact', 'campaign']) {
    await pool.query(`DELETE FROM ${table} WHERE organization_id = ANY($1)`, [orgs]).catch(() => {});
  }
  await cleanupTestTenants(A, B);
  await app.close();
}
console.log('Cross-tenant HTTP security tests passed.');
