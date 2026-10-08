import assert from 'node:assert/strict';
import fs from 'node:fs';

const context = fs.readFileSync(new URL('../db/tenantContext.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../db/migrations.ts', import.meta.url), 'utf8');
const rls = fs.readFileSync(new URL('../db/tenantRls.ts', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');

// The per-request tenant context is transaction-local.
assert.match(context, /set_config\(\$1, \$2, true\)/, 'tenant context must be transaction-local');
assert.match(context, /client\.query\('BEGIN'\)/, 'tenant context must begin a transaction');
assert.match(context, /client\.query\('COMMIT'\)/, 'tenant context must commit the transaction');
assert.match(context, /client\.query\('ROLLBACK'\)/, 'tenant context must rollback failures');

// One GUC name everywhere (it used to differ between tenantContext.ts and the RLS documentation).
assert.match(context, /TENANT_GUC = 'vortex_one\.organization_id'/, 'tenant GUC has a single canonical name');
assert.ok(!/['"]vortex\.organization_id['"]/.test(server + context), 'no code sets a divergent tenant GUC name');
assert.match(rls, /vortex_one\.organization_id/, 'RLS activation documentation names the same GUC');

// DECISION (docs/tenant-isolation.md): row-level security is NOT enabled by the migration chain. Tenant isolation is
// enforced at the application layer (organization-scoped SQL + ownership checks, covered by the HTTP cross-tenant
// suite). Enabling RLS is an explicit, separate deployment step (enableTenantRls) that must not run before every
// pool.connect() path carries the tenant GUC and the runtime role is a non-owner.
assert.ok(!/ENABLE ROW LEVEL SECURITY/.test(migration), 'migrations must not silently enable RLS');
assert.match(rls, /export async function enableTenantRls/, 'RLS activation must be explicit');
assert.match(rls, /FORCE ROW LEVEL SECURITY/, 'RLS activation must force policy enforcement');
assert.ok(!migration.includes('ALTER TABLE public_ca_parcels ENABLE ROW LEVEL SECURITY'), 'global parcel intelligence must remain outside tenant RLS');

console.log('Tenant RLS context tests passed.');
