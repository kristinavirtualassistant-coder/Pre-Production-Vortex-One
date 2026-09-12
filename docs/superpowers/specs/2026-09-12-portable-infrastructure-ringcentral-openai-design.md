# Vortex One Portable Infrastructure, RingCentral, and OpenAI Design

**Date:** 2026-09-12

## Goal
Make Vortex One portable outside GCP, establish RingCentral as a provider integration, preserve PostgreSQL/PostGIS as the authoritative data layer, and continue resolving the existing OpenAI Agents SDK failure without masking or replacing it.

## Current Baseline
- GitHub `main` is the source baseline and the latest CI merge is `55abf1496fa8254bf718ee1ff0d837354e50246b`.
- The application already has a RingCentral SDK dependency and telephony/dialer adapters.
- The application already uses PostgreSQL as the authoritative production store and has durable-job infrastructure.
- The repository still contains GCP-specific deployment/database assumptions and UI wording that should become provider-neutral.
- The OpenAI agent runner currently uses `OpenAIConversationsSession` with a persisted conversation ID and a hard-coded project identifier. A live run has failed with a 404 for an OpenAI message ID. This issue is an explicit workstream and must not be hidden by infrastructure changes.

## Target Architecture

```text
                         VORTEX ONE
                              |
          +-------------------+-------------------+
          |                   |                   |
      Web / UI          Portable API        Worker/Jobs
          |                   |                   |
          +-------------------+-------------------+
                              |
                     PostgreSQL / PostGIS
                              |
        +-------------------+-------------------+
        |                   |                   |
   Property Intel        CRM/Leads        Campaigns/Calls
                                                |
                                      Telephony Interface
                                                |
                                      +---------+---------+
                                      |                   |
                                 RingCentral        Future Provider

                           OpenAI Agents
                         (explicit provider boundary)
```

## Architecture Decisions

### 1. Provider-neutral runtime
The core server must not require Cloud Run, Cloud SQL, Google Secret Manager, or another cloud-specific service to start. Runtime configuration comes from environment variables and standard PostgreSQL connection settings.

Cloud-specific deployment files may remain as optional deployment targets during migration, but application behavior must not require them.

### 2. PostgreSQL/PostGIS authority
PostgreSQL remains the canonical state store. The portability work must preserve tenant isolation, migrations, transactions, durable jobs, idempotency, and production-authoritative-state behavior.

No new Redis, Kafka, Pub/Sub, RabbitMQ, or equivalent queue is introduced unless a tested requirement demonstrates that PostgreSQL-backed jobs cannot meet it.

### 3. RingCentral integration
RingCentral is a telephony provider, not a Vortex One infrastructure dependency. The provider interface must expose only the capabilities the application needs, such as call initiation, call state/event normalization, and provider identifiers.

Vortex One owns contacts, campaigns, queues, call records, dispositions, notes, suppression/DNC, CRM relationships, agent workflows, and analytics. RingCentral owns telephony transport, company numbers, and provider-side call execution.

RingCentral configuration uses environment/deployment secrets:
- `RINGCENTRAL_CLIENT_ID`
- `RINGCENTRAL_CLIENT_SECRET`
- `RINGCENTRAL_JWT`
- `RINGCENTRAL_WEBHOOK_VALIDATION_TOKEN`

Credentials must never be persisted in application database records or committed to Git.

### 4. OpenAI boundary
OpenAI remains an explicit external provider integration. Agent execution must be independently testable from the deployment target. The existing 404 session/message problem must be diagnosed using fresh evidence before changing session persistence, conversation identifiers, model configuration, or SDK behavior.

The implementation must not silently discard the persisted conversation state to make the current smoke test appear successful.

### 5. $0-first deployment
The codebase should support a no-GCP/local mode and a free-tier-first hosted mode where the selected providers permit it. Cost reduction is a constraint, not a reason to weaken data integrity, tenant isolation, security, or call compliance.

### 6. Safe GCP migration
No GCP resource is deleted or decommissioned in this workstream until:
1. the portable runtime is tested;
2. PostgreSQL data/schema integrity is verified;
3. RingCentral live E2E is verified;
4. OpenAI Agents E2E is verified;
5. authentication and tenant isolation are verified;
6. backup/recovery is verified; and
7. a documented rollback/cutover procedure exists.

## Implementation Workstreams

1. **OpenAI Agents diagnosis and hardening** — reproduce the 404, identify whether the persisted conversation/message state is stale or invalid, add regression coverage, and keep provider configuration explicit.
2. **Infrastructure portability** — isolate/remove runtime dependencies on GCP-specific database and secret-management behavior while preserving optional GCP deployment support during migration.
3. **Telephony provider boundary** — formalize a provider-neutral interface around the existing RingCentral implementation and normalize provider events/call identifiers.
4. **Configuration and deployment** — provide documented local/no-cost configuration and keep secrets external to source control.
5. **Validation** — run lint, build, automated tests, provider smoke tests, PostgreSQL integration tests where available, and targeted E2E checks.
6. **Migration/decommission readiness** — document data export/import, cutover, rollback, and the conditions required before GCP resources may be removed.

## Non-Goals
- Do not delete the existing GCP project, Cloud SQL instance, Cloud Run services, VPC connectors, or secrets during implementation.
- Do not replace RingCentral with another telephony vendor.
- Do not remove the OpenAI Agents implementation.
- Do not fabricate property, owner, phone, email, management-company, or provider data.
- Do not make production release claims until the release gates pass.

## Acceptance Criteria
- Vortex One can run without requiring GCP-specific runtime services.
- PostgreSQL connection and migration behavior are configurable through standard environment variables.
- RingCentral is accessed through a provider boundary and remains usable with the company's existing credentials.
- RingCentral webhook/call events continue to map to canonical Vortex One call state.
- OpenAI Agents smoke execution either passes or produces a deterministic, actionable failure with the stale/invalid session state identified and covered by tests.
- No credentials are stored in source or database records.
- Existing CI remains green.
- No production GCP resource is deleted as part of this implementation.
