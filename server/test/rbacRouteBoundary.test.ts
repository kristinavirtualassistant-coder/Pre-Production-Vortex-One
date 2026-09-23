import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');

const mutationLines = source
  .split('\n')
  .filter((line) => /app\.(post|put|patch|delete)\('/.test(line));

const explicitlyUnprotected = new Set([
  "app.post('/internal/scheduler/property-refresh'",
  "app.post('/api/runs/:id/abort'",
  "app.post('/api/property-search'",
  "app.post('/api/telephony/webhook/:provider'",
  "app.post('/api/tts'",
  "app.post('/api/ai/analyze-call'",
]);

for (const line of mutationLines) {
  const routeStart = line.match(/app\.(post|put|patch|delete)\('[^']+'/)?.[0];
  assert.ok(routeStart, `Mutation route is parseable: ${line.trim()}`);
  if (explicitlyUnprotected.has(routeStart)) continue;
  assert.match(line, /requireRole\(\[/, `Privileged mutation route is protected by RBAC: ${routeStart}`);
}

const rbacExpectations: Array<[string, string]> = [
  ["app.delete('/api/integrations/:provider'", "requireRole(['admin', 'executive'])"],
  ["app.post('/api/settings/smart-forwarding'", "requireRole(['admin', 'executive'])"],
  ["app.post('/api/audit/log'", "requireRole(['admin', 'executive'])"],
  ["app.post('/api/webhooks'", "requireRole(['admin', 'executive'])"],
  ["app.put('/api/webhooks/:id'", "requireRole(['admin', 'executive'])"],
  ["app.delete('/api/webhooks/:id'", "requireRole(['admin', 'executive'])"],
  ["app.post('/api/import/sync-production'", "requireRole(['admin', 'executive'])"],
  ["app.delete('/api/leads/:id'", "requireRole(['admin', 'executive', 'manager'])"],
  ["app.post('/api/campaigns'", "requireRole(['admin', 'executive', 'manager'])"],
  ["app.post('/api/campaigns/:id/start'", "requireRole(['admin', 'executive', 'manager'])"],
  ["app.post('/api/suppression'", "requireRole(['admin', 'executive', 'manager'])"],
  ["app.post('/api/approvals/:id/decide'", "requireRole(['admin', 'executive', 'manager'])"],
  ["app.post('/api/outreach-templates'", "requireRole(['admin', 'executive', 'manager'])"],
  ["app.post('/api/dial-batch'", "requireRole(['admin', 'executive', 'manager', 'agent'])"],
];

for (const [route, middleware] of rbacExpectations) {
  const routeIndex = source.indexOf(route);
  assert.ok(routeIndex >= 0, `RBAC route remains present: ${route}`);
  const lineEnd = source.indexOf('\n', routeIndex);
  const declaration = source.slice(routeIndex, lineEnd > routeIndex ? lineEnd : source.length);
  assert.ok(declaration.includes(middleware), `Expected RBAC policy on ${route}`);
}
