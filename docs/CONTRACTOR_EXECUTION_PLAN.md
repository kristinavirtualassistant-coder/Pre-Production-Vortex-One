# Vortex One Contractor Execution Plan

Status: Active execution baseline
Repository: `kristinavirtualassistant-coder/Pre-Production-Vortex-One`
Branch: `contractor-execution-plan`

## Objective

Bring the existing Vortex One codebase into alignment with the approved M1–M12 implementation and acceptance model without rebuilding working capabilities unnecessarily.

## Execution rule

A milestone is complete only when:

`Implemented → Tested → Authorized → Documented → Deployed → Verified`

## Current repository baseline

The repository is currently a TypeScript/Vite/Express application with existing deployment, Cloudflare, PostgreSQL, worker, security-hardening, and production-reliability material. It is **not yet verified** as conforming to the target monorepo/NestJS/Prisma/Redis architecture.

Therefore the first task is a gap assessment, not a blind rewrite.

## M0 — Baseline / Gap Assessment

### Verify

- Current repository structure.
- Frontend architecture and build.
- Backend architecture and runtime.
- PostgreSQL integration and schema ownership.
- Authentication and identity model.
- Organization/membership model.
- RBAC and property/portfolio scope enforcement.
- Existing migrations.
- Existing worker/background-job infrastructure.
- CI workflows and required checks.
- Deployment topology.
- Secrets/configuration handling.
- Existing tests and current failures.
- Existing observability.
- Existing backup/restore procedures.
- Existing AI/tool authorization.

### Classification

Every assessed item receives exactly one state:

- Verified
- Partial
- Missing
- Broken
- Unverified
- Superseded

### M0 exit gate

A repository inventory and remediation backlog exist, and no major rewrite is started until existing capabilities have been classified.

## M1 — Architecture & Engineering Foundation

Target structure:

```
apps/web
apps/api
packages/shared-types
packages/validation
packages/api-client
packages/ui
database/migrations
database/seed
database/fixtures
infrastructure
docs
.github/workflows
```

Build or reconcile:

- TypeScript strict mode.
- ESLint/formatting.
- Conventional commits.
- PR review policy.
- Automated unit/integration testing.
- OpenAPI.
- Database migration source control.
- Environment configuration.
- PostgreSQL.
- Redis.
- Prisma, if retained as the approved ORM.
- API health/readiness.
- Structured logs.
- Correlation IDs.
- Development environment.
- CI pipeline.

### M1 exit gate

A clean checkout can be installed, tested, built, and deployed to the development environment using documented instructions.

## M2 — Identity & Multi-Tenancy

Implement and verify:

- Authentication provider integration.
- User synchronization.
- Organizations.
- Memberships.
- Roles.
- Permissions.
- Property/portfolio scopes.
- Backend authorization guards.
- Audit events.

Required negative tests:

- User A cannot access Organization B.
- User A cannot access Property B without scope.
- Finance users cannot modify permissions.
- Tenant users cannot access another tenant's records.
- Direct API requests cannot bypass UI restrictions.

### M2 exit gate

Authorization tests pass against protected API resources.

## M3–M9 — Domain Delivery

Implement domain modules using the approved shared contracts and authorization model:

1. Property & portfolio management.
2. Tenants & leasing.
3. Facilities & maintenance.
4. Construction.
5. Finance.
6. Documents & workers/notifications.
7. Reporting & operational dashboards.

Each domain requires:

- Migration/schema.
- Validation.
- Service layer.
- API.
- Authorization.
- Audit behavior where required.
- Unit tests.
- Integration tests.
- API contract coverage.
- UI feature.
- Documentation.

## M10 — AI Assistant

AI must consume existing authorized application capabilities.

Required architecture:

```
User
  ↓
Conversation API
  ↓
AI Orchestrator
  ↓
Authorized Tool Registry
  ↓
Vortex One Services
  ↓
Authorization
  ↓
Data
```

Do not permit unrestricted AI-to-database access.

Initial tools:

- get_property
- search_properties
- search_units
- search_tenants
- get_lease
- search_leases
- search_work_orders
- get_project
- get_financial_summary
- search_documents

First release: read-only.

## M11 — Production Hardening

Verify:

- Load behavior.
- Security.
- Authorization penetration tests.
- Dependency/container scanning.
- Backup/restore.
- Disaster recovery.
- Rate limiting.
- API contracts.
- Observability.
- AI prompt-injection resistance.
- AI authorization.
- Production runbooks.

## M12 — Production Launch

Required:

- Production deployment.
- Database.
- Backups.
- Monitoring.
- Alerting.
- Incident procedures.
- Support procedures.
- Contractor handover.
- Technical documentation.
- End-user documentation.

## CI/CD target

Pull request:

```
Install
→ Lint
→ Type Check
→ Unit Tests
→ Build
→ Integration Tests
→ Security Scan
```

Main:

```
Build Image
→ Push Registry
→ Deploy Staging
→ Smoke Tests
```

Production:

```
Approved Release
→ Database Migration
→ API
→ Worker
→ Web
→ Smoke Tests
→ Monitor
```

## Required testing layers

```
Unit
→ Integration
→ API Contract
→ Authorization
→ End-to-End
→ Load
→ Security
```

Critical business logic must have automated tests before production deployment.

## Current execution priority

1. M0 baseline/gap assessment.
2. M1 foundation reconciliation.
3. M2 identity and authorization verification.
4. M3 property foundation.
5. Parallelize M4/M5/M6 after shared domain contracts stabilize.
6. M7 finance.
7. M8 documents/workers.
8. M9 reporting.
9. M10 AI.
10. M11 hardening.
11. M12 launch.

## Change-control rule

Do not replace existing infrastructure, database, authentication, or deployment components solely to match the target architecture. First establish whether the current implementation can satisfy the required behavior. Replace only where it is materially incompatible, insecure, unmaintainable, or prevents an acceptance gate from passing.

## Evidence standard

All status claims must identify the evidence source and scope. Unsupported claims remain Unverified.

Secrets, credentials, tokens, private keys, and recovery codes must never be committed or reproduced.

## Contractor handover

Final delivery must allow another engineering team to:

- Clone the repository.
- Configure environments.
- Run tests.
- Run migrations.
- Deploy staging.
- Deploy production through the documented process.
- Restore the database.
- Operate monitoring.
- Diagnose common incidents.
- Understand the architecture.
- Extend the system without undocumented tribal knowledge.
