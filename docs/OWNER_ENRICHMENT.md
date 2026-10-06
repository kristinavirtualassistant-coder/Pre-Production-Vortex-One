# Owner Enrichment

Vortex One owner enrichment is provider-neutral. The canonical owner remains `property_owners`; enrichment evidence is stored separately.

## Architecture

```
Owner
  -> Owner Enrichment Engine
  -> Provider Adapter
       - public_records
       - manual_import
       - provider_a
       - provider_b
       - provider_c
  -> Source Record
  -> Contact Points / Ownerships / Relationships / Signals
```

Commercial skip-trace providers are not hard-wired into the application. Unconfigured providers return `unavailable` and never create synthetic contact data.

## Persistence

The service creates these tables when first used:

- `owner_enrichment_providers`
- `owner_enrichment_jobs`
- `owner_source_records`
- `owner_contact_points`
- `owner_ownerships`
- `owner_relationships`
- `owner_lead_signals`
- `owner_identity_matches`

All tables are organization-scoped.

## Existing API compatibility

The existing skip-trace endpoints now route through the enrichment engine:

- `POST /api/skip-trace/execute`
- `POST /api/skip-trace/automated-pipeline`
- `POST /api/skip-trace/batch`
- `POST /api/skip-trace/auto-enrich`
- `POST /api/skip-trace/save-contacts`

The first four use the canonical owner/property records as the public-records adapter. A commercial adapter can later be added without changing the owner model.

## Source policy

Do not treat a provider response as canonical merely because it exists. Store the source record, retrieval time, provider key, raw hash, and confidence. Conflicting evidence should create separate evidence rather than silently overwriting the canonical owner.

## Next implementation

1. Add a dedicated Owner 360 API/router.
2. Wire Owner 360 to `owner_contact_points`, `owner_ownerships`, `owner_relationships`, and `owner_lead_signals`.
3. Add the first real public-record adapter for supported counties.
4. Add commercial adapters only when credentials and lawful data sources are configured.
5. Move the service-created schema into the numbered production migration chain once the database migration cleanup is complete.
