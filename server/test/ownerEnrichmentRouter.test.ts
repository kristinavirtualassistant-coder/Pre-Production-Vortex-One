import assert from 'node:assert/strict';
import fs from 'node:fs';

const router = fs.readFileSync(new URL('../routes/ownerEnrichment.ts', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');

assert.ok(router.includes("router.get('/:id'"), 'Owner profile route exists');
assert.ok(router.includes("router.post('/:id/enrich'"), 'Owner enrichment route exists');
assert.ok(router.includes("requireOrganizationId(req.dbUser?.organization_id)"), 'Owner router derives tenant from authenticated user');
assert.ok(router.includes("organization_id=$1"), 'Owner list is tenant-scoped');
assert.ok(server.includes("createOwnerEnrichmentRouter"), 'Server imports Owner 360 router');
assert.ok(server.includes("app.use('/api/owner-enrichment', createOwnerEnrichmentRouter())"), 'Server mounts Owner 360 router');
assert.ok(server.length > 100000, 'Server entrypoint is not truncated');

console.log('Owner 360 route integrity tests passed');
