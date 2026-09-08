# Phase 7 — Agent Runtime PostgreSQL Authority

## Goal
Remove production agent-runtime dependence on in-memory business state and make PostgreSQL the authoritative source for property, owner, lead, task, analytics, call, suppression, approval, and audit operations.

## Scope
- PostgreSQL-authoritative property and owner search.
- PostgreSQL-authoritative explainable lead scoring and lead recommendation updates.
- Durable CRM task creation through the Phase 6 task service.
- PostgreSQL-backed agent analytics.
- Durable call reservation before telephony dispatch; no dispatch when persistence is unavailable.
- PostgreSQL-authoritative DNC/suppression reads and writes with no memory fallback.
- Durable orchestrator tasks, approvals, and audit logs.
- Tenant scoping on all affected runtime queries and mutations.
- Explicit DB-unavailable failure paths.

## Verification
- Agent runtime service unit tests.
- Static runtime boundary tests for tools, sub-agents, orchestrator, and suppression service.
- Full automated suite with local-only/no-DB mode preserved for legacy in-memory fixture tests.
- Production build.
- Local PostgreSQL smoke test for suppression persistence and runtime analytics/search queries.
- No production deployment.
- No real outbound calls.
