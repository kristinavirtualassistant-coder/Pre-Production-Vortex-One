import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
const migrations = fs.readFileSync(new URL('../db/migrations.ts', import.meta.url), 'utf8');
const gemini = fs.readFileSync(new URL('../gemini.ts', import.meta.url), 'utf8');
const tools = fs.readFileSync(new URL('../tools/index.ts', import.meta.url), 'utf8');

function mustContain(source: string, text: string, label: string) {
  assert.ok(source.includes(text), label);
}
function mustNotContain(source: string, text: string, label: string) {
  assert.ok(!source.includes(text), label);
}

mustContain(server, 'Global cache administration is disabled in production.', 'global cache administration is fail-closed');
mustContain(server, 'Global agent registry mutation is disabled in production.', 'global agent mutation is fail-closed');
mustContain(server, 'SELECT DISTINCT organization_id FROM call', 'webhook tenant is database-derived');
mustContain(server, 'Provider call identity is ambiguous across organizations', 'ambiguous webhook identity is rejected');
mustNotContain(server, "(req.body?.organizationId as string) || (req.body?.organization_id as string)", 'webhook no longer trusts body organization');
mustContain(server, "persist: persist === 'true'", 'live property persistence requires explicit opt-in');
mustContain(server, 'filePath.startsWith(resolvedOrgDir + path.sep)', 'file download path traversal is blocked');
mustContain(server, 'dataFilePath.startsWith(resolvedOrgDir + path.sep)', 'file deletion path traversal is blocked');

mustContain(gemini, '{ skipCache: true, forceRefresh: options.forceRefresh }', 'Gemini text caching is disabled');
mustContain(gemini, '{ skipCache: true }', 'Gemini TTS caching is disabled');

mustContain(tools, 'agent.allowedTools.includes(toolName)', 'agent tool allow-list is enforced');
mustContain(tools, "if (toolName === 'make_call')", 'outbound call approval gate exists');
mustContain(tools, "status = 'approved'", 'outbound call requires approved status');
mustContain(tools, 'organization_id = $2', 'approval lookup is tenant-scoped');

mustContain(migrations, 'CREATE TABLE IF NOT EXISTS public_ca_parcels', 'global parcel table exists');
const parcelStart = migrations.indexOf('CREATE TABLE IF NOT EXISTS public_ca_parcels');
const parcelEnd = migrations.indexOf('      );', parcelStart);
mustNotContain(migrations.slice(parcelStart, parcelEnd), 'organization_id', 'global parcel table has no tenant organization_id');
mustContain(migrations, 'BEFORE UPDATE OR DELETE ON audit_logs', 'audit logs are append-only');

console.log('Multi-tenant security boundary tests passed.');
