# Vortex One Integrated Platform Design

## Status
Approved architecture. V1 property coverage: California operational data with nationwide-ready architecture.

## Goal
Turn the existing Vortex One codebase into one production workflow combining property intelligence, owner-centric CRM, outreach, and a PhoneBurner-style power dialer.

## Product loop
Property Search → Enrich → DNC → Score → CRM → Campaign → Dialer → Disposition → Follow-up → Conversion.

## Source of truth
PostgreSQL/PostGIS is the production source of truth. Frontend state, synthetic contacts, provider fallbacks, and in-memory stores must not create production records or silently substitute for unavailable database data.

## Identity and tenancy
Every authenticated request resolves a canonical organization from Firebase identity plus database membership. Client tenant identifiers may be accepted only when they match the authenticated organization. There is no runtime default organization.

## Property intelligence
Search is performed against normalized PostgreSQL/PostGIS data. Providers ingest or refresh verified source data through a common adapter contract. California is operational in V1; provider interfaces remain state/county agnostic for nationwide expansion.

## Property capabilities
Search by geography, address, APN, owner, property characteristics, valuation, equity, mortgage, ownership duration, absentee/corporate ownership, tax delinquency, vacancy/distress indicators, portfolio size, and related motivated-owner signals. Results support map/table views, detail pages, saved properties, saved searches, bulk selection, enrichment, and lead creation.

## Provenance
Property and contact records retain source/provider identifiers, retrieval timestamps, verification state, and confidence where available. Failed providers never produce synthetic production results.

## CRM
CRM is owner-centric. An owner can have multiple properties, contacts, leads, activities, tasks, notes, communications, and opportunities. A lead is canonical and is shared by property intelligence, enrichment, CRM, campaigns, and dialer workflows.

## Pipeline
Default stages: New Lead, Researching, Ready to Call, Attempted, Connected, Qualified, Appointment, Proposal, Won. Terminal/nurture outcomes include Not Interested, Nurture, Lost, Wrong Number, DNC, Voicemail, No Answer, and Disconnected. Pipelines/stages are organization-configurable.

## Activity timeline
Calls, SMS, email, voicemail, enrichment, notes, tasks, stage changes, and campaign actions write to one chronological CRM activity history.

## Lead generation
Property selection can create/update owner, property, contact, and lead records transactionally, calculate/store lead intelligence, and immediately add eligible leads to an outreach campaign without CSV round-tripping.

## Dialer
The dialer is a server-owned campaign engine, not a click-to-call UI. Campaigns maintain an eligibility queue, configurable concurrency, retry policy, calling hours, timezone rules, suppression checks, agent assignment, and metrics.

## Call state machine
QUEUED → DIALING → RINGING → HUMAN/VOICEMAIL/NO_ANSWER/BUSY/DISCONNECTED/FAILED. Human calls continue through CONNECTED → IN_CALL → WRAP_UP → DISPOSITIONED → COMPLETED.

## Telephony
RingCentral is the first production provider behind a provider-neutral telephony adapter. Provider events enter verified webhook endpoints, pass idempotency checks, update the call state machine, persist to PostgreSQL, and publish realtime UI updates.

## Multi-line behavior
The server controls 3–10 configurable concurrent attempts. When a prospect connects, the engine resolves other active attempts according to provider capabilities and immediately replenishes available queue capacity.

## Dispositions
Disposition writes must update the call, campaign contact, lead stage, CRM activity, and follow-up task as one transactional workflow. Disconnected and DNC numbers are not automatically redialed.

## Communications
SMS, email, voicemail, and call history are unified with the CRM activity model. Provider integrations are tenant-scoped and auditable.

## Background processing
Workers handle ingestion, normalization, enrichment, suppression processing, campaign queueing, retries, scheduled campaigns, webhook events, metrics, and recovery. Long-running work does not depend on an HTTP request remaining open.

## Reliability
Webhook processing is idempotent. Replayed provider events cannot duplicate activities, metrics, tasks, or state transitions. PostgreSQL remains authoritative after worker/API restarts.

## Production observability
Monitor API, database, workers, telephony, provider ingestion, searches, enrichments, leads, calls, connections, dispositions, campaign metrics, failures, and security/audit events.

## Deployment
Target Cloud Run application/API with Cloud SQL PostgreSQL/PostGIS and dedicated worker execution as needed. Development, staging, and production configuration are separated; secrets are not committed.

## Security gates
No runtime `org_cmc_realty` fallback. Cross-tenant access returns 403. Provider callbacks use provider-level verification and replay protection. Every database query involving tenant-owned data is scoped to the authenticated organization.

## Production acceptance
The final acceptance path is real California property → owner → enrichment → CRM lead → campaign → controlled RingCentral call → disposition → CRM activity → follow-up → next eligible lead, with no synthetic production data.
