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

The production migration chain owns these tables; the service retains a defensive runtime guard for compatibility:

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

The skip-trace compatibility endpoints use the canonical owner/property records as an enrichment source. County/GIS property adapters now also persist authoritative public-record provenance into Owner 360 during property ingestion. When a source legally redacts owner identity, Vortex One stores the parcel evidence without creating a blank or synthetic owner.

## Source policy

Do not treat a provider response as canonical merely because it exists. Store the source record, retrieval time, provider key, raw hash, and confidence. Conflicting evidence should create separate evidence rather than silently overwriting the canonical owner.

## Current ingestion boundary

1. County/GIS adapters are the authoritative public-record ingestion layer for supported parcel/assessor datasets.
2. `PublicRecordsIngestionService` stores source URL, dataset, record identifier, query filter, raw attributes, retrieval time, and a raw hash in `owner_source_records`.
3. Owner identity is linked only when the upstream normalized result contains a real owner identity. Statutorily redacted county records do not create placeholder owners.
4. Ownership rows are reconciled into `owner_ownerships` and candidate identity conflicts are stored in `owner_identity_matches`.
5. Portfolio-level lead signals use dedicated partial unique indexes so `NULL` property IDs cannot create duplicate global signals.
6. Commercial adapters remain separate and return `unavailable` until lawful credentials/data access are configured.

7. Relationship intelligence is evidence-based: only explicit related-owner/entity records from a normalized source are persisted to `owner_relationships`; name similarity and shared addresses are never treated as proof of a relationship.
