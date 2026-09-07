# Phase 6 — Agent Operations PostgreSQL Authority

## Goal
Make production task, workflow, and human-approval state PostgreSQL-authoritative and tenant-scoped, with no in-memory fallback for these entities.

## Scope
- `/api/tasks` GET/POST
- `/api/workflows` GET/GET-by-id/POST/PUT/DELETE
- `/api/approvals` GET and `/api/approvals/:id/decide`
- Workflow execution lookup must resolve workflow definitions from PostgreSQL.
- Durable task creation used by workflow execution must persist to PostgreSQL.
- Existing API response shapes are preserved where practical.
- DB failures return explicit 503 rather than silently serving mutable in-memory state.

## Safety boundaries
- `organization_id` always comes from authenticated tenant context.
- IDs supplied by clients are never sufficient to cross tenant boundaries.
- No production deployment or outbound calls in this phase.

## Verification
- Focused service/tenant tests
- Full `npm test`
- `npm run build`
- `git diff --check`
