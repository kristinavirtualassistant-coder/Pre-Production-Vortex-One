import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
const migrations = fs.readFileSync(new URL('../db/migrations.ts', import.meta.url), 'utf8');
const gemini = fs.readFileSync(new URL('../gemini.ts', import.meta.url), 'utf8');

function mustContain(source: string, text: string, label: string) {
  assert.ok(source.includes(text), label);
}

function mustNotContain(source: string, text: string, label: string) {
  assert.ok(!source.includes(text), label);
}

// Shared/global cache surfaces cannot be tenant-administered in production.
mustContain(server, "Global cache administration is disabled in production.", 'global cache management is fail-closed in production');
mustContain(server, "Global agent registry mutation is disabled in production.", 'global agent mutation is fail-closed in production');

// Telephony webhook tenant identity must be derived from the durable call record,
// not selected by organizationId supplied in an unauthenticated webhook body.
mustContain(server, "SELECT DISTINCT organization_id FROM call WHERE telephony_session_id = $1 OR telephony_call_id = $1 LIMIT 2", 'webhook tenant lookup is database-derived');
mustContain(server, "Provider call identity is ambiguous across organizations", 'ambiguous provider identity is rejected');
mustNotContain(server, "(req.body?.organizationId as string) || (req.body?.organization_id as string)", 'webhook no longer trusts body organization');

 // Live public property intelligence is read-only unless a caller explicitly requests CRM persistence.
mustContain(server, "persist: persist === 'true'", 'live property search requires explicit persistence opt-in');

// Imported files remain confined to the authenticated tenant directory even if metadata is malformed.
mustContain(server, "filePath.startsWith(resolvedOrgDir + path.sep)", 'download path traversal is blocked');
mustContain(server, "dataFilePath.startsWith(resolvedOrgDir + path.sep)", 'delete path traversal is blocked');

// AI output is not shared through the process-global cache.
mustContain(gemini, "{ skipCache: true, forceRefresh: options.forceRefresh }", 'Gemini text cache is disabled');
mustContain(gemini, "{ skipCache: true }", 'Gemini TTS cache is disabled');

// Database-level audit history is append-only.
mustContain(migrations, "prevent_audit_log_mutation", 'audit immutability trigger exists');
mustContain(migrations, "BEFORE UPDATE OR DELETE ON audit_logs", 'audit immutability trigger blocks mutation');
mustContain(migrations, "CREATE TABLE IF NOT EXISTS public_ca_parcels", 'global CA parcel table exists');
mustNotContain(migrations.slice(migrations.indexOf("CREATE TABLE IF NOT EXISTS public_ca_parcels"), migrations.indexOf("CREATE TABLE IF NOT EXISTS public_ca_parcels") + 5000), "organization_id", 'global parcel table has no tenant organization_id');

console.log('Multi-tenant security boundary tests passed.');
