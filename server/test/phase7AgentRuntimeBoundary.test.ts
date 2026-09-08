import assert from 'node:assert/strict';
import fs from 'node:fs';

const tools = fs.readFileSync(new URL('../tools/index.ts', import.meta.url), 'utf8');
const subAgents = fs.readFileSync(new URL('../agents/subAgents.ts', import.meta.url), 'utf8');
const orchestrator = fs.readFileSync(new URL('../agents/orchestrator.ts', import.meta.url), 'utf8');
const suppression = fs.readFileSync(new URL('../dialer/suppressionService.ts', import.meta.url), 'utf8');

assert.equal(tools.includes('inMemoryStore'), false, 'Agent tool execution has no in-memory business-state dependency');
assert.match(tools, /searchProperties\(pool, context\.organizationId/);
assert.match(tools, /searchOwners\(pool, context\.organizationId/);
assert.match(tools, /scoreLead\(pool, context\.organizationId/);
assert.match(tools, /updateLeadRecommendation\(pool, context\.organizationId/);
assert.match(tools, /createTask\(pool, context\.organizationId/);
assert.match(tools, /PostgreSQL is required before any outbound call is initiated/);
assert.match(tools, /INSERT INTO call .*status.*initiated/);
assert.match(tools, /UPDATE call SET status = 'failed'/);

assert.equal(subAgents.includes('inMemoryStore'), false, 'Sub-agent runtime has no in-memory business-state dependency');
assert.match(subAgents, /getAgentAnalytics\(pool, context\.organizationId\)/);
assert.match(subAgents, /executeTool\('search_property'/);

assert.equal(orchestrator.includes('inMemoryStore'), false, 'Orchestrator has no in-memory task/approval/audit persistence');
assert.match(orchestrator, /PostgreSQL is required for authoritative agent orchestration/);
assert.match(orchestrator, /createTask\(pool, this\.organizationId/);
assert.match(orchestrator, /updateTaskResult\(pool, this\.organizationId/);
assert.match(orchestrator, /createApproval\(pool, this\.organizationId/);
assert.match(orchestrator, /INSERT INTO audit_logs/);

assert.equal(suppression.includes('inMemorySuppressions'), false, 'Suppression service has no in-memory fallback');
assert.match(suppression, /PostgreSQL is required for authoritative suppression checks/);
assert.match(suppression, /Authoritative suppression check failed/);
assert.match(suppression, /Authoritative suppression write failed/);
assert.match(suppression, /Authoritative suppression delete failed/);

console.log('phase 7 agent runtime boundary tests passed');
