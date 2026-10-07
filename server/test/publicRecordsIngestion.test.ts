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
    assert.match(source, /owner_ownerships/);
    assert.match(source, /uq_owner_source_records_org_provider_hash/);
  });

  it('has a migration that deduplicates portfolio-level signals with NULL property IDs', async () => {
    const source = await readFile(new URL('../db/migrations.ts', repoRoot), 'utf8');
    assert.match(source, /030_harden_owner_signal_dedupe/);
    assert.match(source, /uq_owner_lead_signals_portfolio/);
  });
});
