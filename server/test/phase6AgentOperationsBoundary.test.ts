import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');

for (const route of ["app.get('/api/tasks'", "app.post('/api/tasks'", "app.get('/api/workflows'", "app.get('/api/workflows/:id'", "app.post('/api/workflows'", "app.put('/api/workflows/:id'", "app.delete('/api/workflows/:id'", "app.get('/api/approvals'", "app.post('/api/approvals/:id/decide'"]) {
  assert.ok(source.includes(route), `Phase 6 route remains present: ${route}`);
}

function extractRouteBlock(routeStart: string, nextMarkers: string[]): string {
  const start = source.indexOf(routeStart);
  assert.ok(start >= 0, `Route remains present: ${routeStart}`);
  const ends = nextMarkers
    .map((marker) => source.indexOf(marker, start + routeStart.length))
    .filter((index) => index > start);
  const end = ends.length > 0 ? Math.min(...ends) : source.length;
  return source.slice(start, end);
}

const taskListBlock = extractRouteBlock("  app.get('/api/tasks',", ["  app.post('/api/tasks',"]);
const taskCreateBlock = extractRouteBlock("  app.post('/api/tasks',", ["  app.get('/api/workflows',"]);
const workflowListBlock = extractRouteBlock("  app.get('/api/workflows',", ["  app.get('/api/workflows/:id',"]);
const workflowGetBlock = extractRouteBlock("  app.get('/api/workflows/:id',", ["  app.post('/api/workflows',"]);
const workflowCreateBlock = extractRouteBlock("  app.post('/api/workflows',", ["  app.put('/api/workflows/:id',"]);
const workflowUpdateBlock = extractRouteBlock("  app.put('/api/workflows/:id',", ["  app.delete('/api/workflows/:id',"]);
const workflowDeleteBlock = extractRouteBlock("  app.delete('/api/workflows/:id',", ["  app.get('/api/runs',"]);

const operationsBlock = [
  taskListBlock,
  taskCreateBlock,
  workflowListBlock,
  workflowGetBlock,
  workflowCreateBlock,
  workflowUpdateBlock,
  workflowDeleteBlock,
].join('\n');

assert.equal(operationsBlock.includes('inMemoryStore.tasks'), false, 'Task APIs have no in-memory task fallback');
assert.equal(operationsBlock.includes('inMemoryStore.workflows'), false, 'Workflow APIs have no in-memory workflow fallback');
assert.match(operationsBlock, /PostgreSQL is required for authoritative task state/);
assert.match(operationsBlock, /PostgreSQL is required for authoritative workflow state/);

const approvalStart = source.indexOf('  // Human Approval Center APIs — PostgreSQL authoritative');
assert.ok(approvalStart >= 0, 'Authoritative approval section marker remains present');
const approvalEnd = source.indexOf('  // Observability & Audit Logs', approvalStart);
const approvalBlock = source.slice(approvalStart, approvalEnd > approvalStart ? approvalEnd : source.length);
assert.equal(approvalBlock.includes('inMemoryStore.approvals'), false, 'Approval API block has no in-memory approval fallback');
assert.match(approvalBlock, /PostgreSQL is required for authoritative approval state/);

assert.match(source, /await getWorkflow\(pool, orgId, workflow_id\)/, 'Workflow execution resolves definition from PostgreSQL');
assert.match(source, /await createApproval\(pool, orgId, approvalReq\)/, 'Workflow approvals persist to PostgreSQL');
assert.match(source, /await updateTaskResult\(pool, orgId, executedTask\)/, 'Workflow tasks persist to PostgreSQL');


const rbacExpectations: Array<[string, string]> = [
  ["app.post('/api/tasks'", "requireRole(['admin', 'executive', 'manager'])"],
  ["app.post('/api/workflows'", "requireRole(['admin', 'executive', 'manager'])"],
  ["app.put('/api/workflows/:id'", "requireRole(['admin', 'executive', 'manager'])"],
  ["app.delete('/api/workflows/:id'", "requireRole(['admin', 'executive'])"],
];
for (const [route, middleware] of rbacExpectations) {
  const routeIndex = source.indexOf(route);
  assert.ok(routeIndex >= 0, `RBAC route remains present: ${route}`);
  const routeLineEnd = source.indexOf("\n", routeIndex);
  const routeDeclaration = source.slice(routeIndex, routeLineEnd > routeIndex ? routeLineEnd : source.length);
  assert.ok(routeDeclaration.includes(middleware), `RBAC enforced on ${route}`);
}
