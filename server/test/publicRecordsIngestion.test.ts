import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const repoRoot = new URL('../..', import.meta.url);

describe('Public records ingestion', () => {
  it('exposes the authoritative public-record ingestion service', async () => {
    const mod = await import('../services/publicRecordsIngestionService');
    assert.ok(mod.PublicRecordsIngestionService);
    assert.equal(typeof mod.PublicRecordsIngestionService.recordResults, 'function');
  });

  it('does not persist blank/synthetic owners from redacted county records', async () => {
    const source = await readFile(new URL('../services/propertyProviders/PropertyDataProvider.ts', repoRoot), 'utf8');
    assert.match(source, /if \(owner\?\.name\?\.trim\(\)\)/);
    assert.match(source, /PublicRecordsIngestionService\.recordResults/);
  });

  it('uses tenant-scoped provenance and identity matching', async () => {
    const source = await readFile(new URL('../services/publicRecordsIngestionService.ts', repoRoot), 'utf8');
    assert.match(source, /organization_id=\$1/);
    assert.match(source, /owner_identity_matches/);
    assert.match(source, /candidate_owner_id/);
    assert.match(source, /identityScore/);
    assert.match(source, /runnerUpScore/);
    assert.match(source, /owner_ownerships/);
    assert.match(source, /uq_owner_source_records_org_provider_hash/);
  });

  it('persists only explicit source relationships', async () => {
    const source = await readFile(new URL('../services/publicRecordsIngestionService.ts', repoRoot), 'utf8');
    assert.match(source, /explicitRelationships/);
    assert.match(source, /owner_relationships/);
    assert.match(source, /relationship\.relationshipType/);
  });

  it('requires migration-managed Owner 360 schema readiness', async () => {
    const source = await readFile(new URL('../services/ownerEnrichmentService.ts', repoRoot), 'utf8');
    assert.match(source, /assertSchemaReady/);
    assert.doesNotMatch(source, /CREATE TABLE IF NOT EXISTS owner_enrichment_providers/);
    assert.doesNotMatch(source, /async function ensureSchema/);
  });

  it('exposes identity matches in the Owner 360 profile', async () => {
    const source = await readFile(new URL('../services/ownerEnrichmentService.ts', repoRoot), 'utf8');
    assert.match(source, /identityMatches/);
    assert.match(source, /identity_matches/);
  });

  it('has a migration that deduplicates portfolio-level signals with NULL property IDs', async () => {
    const source = await readFile(new URL('../db/migrations.ts', repoRoot), 'utf8');
    assert.match(source, /030_harden_owner_signal_dedupe/);
    assert.match(source, /uq_owner_lead_signals_portfolio/);
  });
});
