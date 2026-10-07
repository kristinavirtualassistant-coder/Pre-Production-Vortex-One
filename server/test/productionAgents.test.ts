import assert from 'node:assert/strict';
import { PRODUCTION_AGENTS } from '../agents/productionAgents';
import { TOOLS } from '../tools';

const ids = PRODUCTION_AGENTS.map((agent) => agent.id);
assert.deepEqual(ids, [
  'production_property_research',
  'production_outbound',
  'production_lead_qualification',
  'production_follow_up',
]);

for (const agent of PRODUCTION_AGENTS) {
  assert.equal(agent.provider, 'gemini');
  assert.equal(agent.model, 'gemini-3.8-flash');
  assert.equal(agent.enabled, true);
  assert.ok(agent.systemInstructions.length > 100);
  assert.ok(agent.allowedTools.length > 0);
  for (const tool of agent.allowedTools) assert.ok(TOOLS[tool], `production agent references registered tool: ${tool}`);
}

const research = PRODUCTION_AGENTS.find((a) => a.id === 'production_property_research')!;
assert.ok(research.allowedTools.includes('run_5_step_skip_trace'));
assert.ok(research.allowedTools.includes('create_lead'));
assert.ok(research.permissions.includes('research_tools'));
assert.ok(research.permissions.includes('crm_read_write'));

const outbound = PRODUCTION_AGENTS.find((a) => a.id === 'production_outbound')!;
assert.ok(outbound.allowedTools.includes('make_call'));
assert.ok(outbound.permissions.includes('telephony_trigger'));

const qualification = PRODUCTION_AGENTS.find((a) => a.id === 'production_lead_qualification')!;
assert.ok(qualification.allowedTools.includes('score_lead'));

const followUp = PRODUCTION_AGENTS.find((a) => a.id === 'production_follow_up')!;
assert.ok(followUp.allowedTools.includes('create_crm_task'));

console.log('productionAgents.test.ts: passed');
