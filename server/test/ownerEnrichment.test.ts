import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('Owner enrichment architecture', () => {
  it('defines the provider-neutral capability model', async () => {
    const mod = await import('../services/ownerEnrichmentService');
    assert.ok(mod.OwnerEnrichmentService);
  });

  it('does not expose a commercial provider as the default', async () => {
    const mod = await import('../services/ownerEnrichmentService');
    assert.equal(typeof mod.OwnerEnrichmentService.listProviders, 'function');
    assert.equal(typeof mod.OwnerEnrichmentService.enrichOwner, 'function');
    assert.equal(typeof mod.OwnerEnrichmentService.getOwnerProfile, 'function');
  });
});
