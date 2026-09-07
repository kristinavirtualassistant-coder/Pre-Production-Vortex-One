import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');

for (const route of ["app.get('/api/tasks'", "app.post('/api/tasks'", "app.get('/api/workflows'", "app.get('/api/workflows/:id'", "app.post('/api/workflows'", "app.put('/api/workflows/:id'", "app.delete('/api/workflows/:id'", "app.get('/api/approvals'", "app.post('/api/approvals/:id/decide'"]) {
  assert.ok(source.includes(route), `Phase 6 route remains present: ${route}`);
}

const start = source.indexOf("  // Tasks & Workflow APIs — PostgreSQL authoritative");
const end = source.indexOf("  // --- Workflow Runs Subscription & Polling APIs ---", start);
const operationsBlock = source.slice(start, end);
assert.equal(operationsBlock.includes('inMemoryStore.tasks'), false, 'Task API block has no in-memory task fallback');
assert.equal(operationsBlock.includes('inMemoryStore.workflows'), false, 'Workflow API block has no in-memory workflow fallback');

const approvalStart = source.indexOf('  // Human Approval Center APIs — PostgreSQL authoritative');
const approvalEnd = source.indexOf('  // Observability & Audit Logs', approvalStart);
const approvalBlock = source.slice(approvalStart, approvalEnd);
assert.equal(approvalBlock.includes('inMemoryStore.approvals'), false, 'Approval API block has no in-memory approval fallback');
assert.match(operationsBlock, /PostgreSQL is required for authoritative task state/);
assert.match(operationsBlock, /PostgreSQL is required for authoritative workflow state/);
assert.match(approvalBlock, /PostgreSQL is required for authoritative approval state/);
assert.match(source, /await getWorkflow\(pool, orgId, workflow_id\)/, 'Workflow execution resolves definition from PostgreSQL');
assert.match(source, /await createApproval\(pool, orgId, approvalReq\)/, 'Workflow approvals persist to PostgreSQL');
assert.match(source, /await updateTaskResult\(pool, orgId, executedTask\)/, 'Workflow tasks persist to PostgreSQL');
