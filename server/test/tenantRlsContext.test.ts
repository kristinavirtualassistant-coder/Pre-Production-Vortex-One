import assert from 'node:assert/strict';
import fs from 'node:fs';

const context = fs.readFileSync(new URL('../db/tenantContext.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../db/migrations.ts', import.meta.url), 'utf8');
const rls = fs.readFileSync(new URL('../db/tenantRls.ts', import.meta.url), 'utf8');

assert.match(context, /set_config\\(\\$1, \\$2, true\\)/, 'tenant context must be transaction-local');
assert.match(context, /await client\\.query\\('BEGIN'\\)/, 'tenant context must begin a transaction');
assert.match(context, /await client\\.query\\('COMMIT'\\)/, 'tenant context must commit the transaction');
assert.match(context, /await client\\.query\\('ROLLBACK'\\)/, 'tenant context must rollback failures');

assert.match(migration, /current_setting\\('vortex_one\\.organization_id', true\\)/, 'RLS policies must use the tenant GUC');
assert.match(migration, /CREATE POLICY vortex_one_tenant_isolation/, 'tenant isolation policy must exist');
assert.ok(!migration.includes('ALTER TABLE public_ca_parcels ENABLE ROW LEVEL SECURITY'), 'global parcel intelligence must remain outside tenant RLS');

assert.match(rls, /export async function enableTenantRls/, 'RLS activation must be explicit');
assert.match(rls, /FORCE ROW LEVEL SECURITY/, 'RLS activation must force policy enforcement');

console.log('Tenant RLS context tests passed.');