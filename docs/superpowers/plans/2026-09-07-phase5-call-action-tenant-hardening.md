# Phase 5 Call Action Tenant Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every authenticated call mutation/read helper in the call-action surface tenant-scoped and make disposition errors return stable HTTP contracts without weakening the existing transactional disposition workflow.

**Architecture:** Keep PostgreSQL authoritative and derive organization identity exclusively from authenticated request context. Reuse the existing transactional disposition service; harden the adjacent notes, patch, and task-suggestion endpoints so they lock/read/update only calls belonging to the authenticated organization. Map expected domain errors to 400/404 responses instead of exposing them as generic 500 responses.

**Tech Stack:** TypeScript, Express, PostgreSQL (`pg`), existing Vortex One auth middleware, Node test runner via `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-02-vortex-one-integrated-platform-design.md`

## Global Constraints

- PostgreSQL/PostGIS is the production source of truth.
- Every authenticated request resolves a canonical organization from Firebase identity plus database membership.
- Every database query involving tenant-owned data is scoped to the authenticated organization.
- No runtime default organization is permitted.
- No synthetic production records or in-memory production fallback may be introduced.
- No production deployment or outbound RingCentral call is part of this phase.

---

### Task 1: Define failing HTTP boundary tests

**Files:**
- Create: `server/test/callActionTenantBoundary.test.ts`
- Modify: `server/test/suite.ts`

**Interfaces:**
- Tests inspect the route source for required organization scoping and expected error mappings.
- Produces regression coverage for `/api/calls/:id`, `/api/calls/:id/notes`, `/api/calls/:id/suggest-task`, and `/api/calls/:id/disposition`.

- [x] **Step 1: Write failing source-boundary tests**
- [x] **Step 2: Run the focused test and confirm it fails against the current routes**
- [x] **Step 3: Register the test in the existing suite**
- [x] **Step 4: Re-run the focused test and confirm the expected failures are present**

### Task 2: Harden call notes, patch, and voicemail routes

**Files:**
- Modify: `server.ts` around the call mutation routes
- Test: `server/test/callActionTenantBoundary.test.ts`

**Interfaces:**
- Authenticated organization comes from `requireOrganizationId((req as AuthRequest).dbUser?.organization_id)`.
- Updates use `WHERE id = $1 AND organization_id = $2`.
- Missing tenant-owned calls return 404 rather than silently updating zero rows.

- [x] **Step 1: Implement organization-scoped lookup/update for PATCH notes**
- [x] **Step 2: Implement organization-scoped lookup/update for POST notes**
- [x] **Step 3: Return 404 when no tenant-owned call exists**
- [x] **Step 4: Run focused tests and confirm green**
- [x] **Step 5: Harden voicemail-drop persistence with tenant scoping, PostgreSQL fail-closed behavior, and 404 handling**

### Task 3: Harden task suggestion lookup

**Files:**
- Modify: `server.ts` task suggestion route
- Test: `server/test/callActionTenantBoundary.test.ts`

**Interfaces:**
- Call notes are read using `WHERE id = $1 AND organization_id = $2`.
- Cross-tenant or missing calls return 404 before invoking Gemini.

- [x] **Step 1: Add failing assertion for organization-scoped suggestion query**
- [x] **Step 2: Implement the tenant-scoped lookup**
- [x] **Step 3: Run focused tests and confirm green**

### Task 4: Harden disposition HTTP contract

**Files:**
- Modify: `server.ts` disposition route
- Test: `server/test/callActionTenantBoundary.test.ts`
- Test: `server/test/dispositionService.test.ts`

**Interfaces:**
- `applyCallDisposition` remains the single transactional mutation boundary.
- Successful responses include `status` and `followUpTaskId` when applicable.
- Validation errors return 400.
- Missing tenant-owned calls return 404.
- Duplicate idempotent dispositions return 200 with `status: duplicate_ignored`.
- Database failures remain 500/503 and do not create synthetic state.

- [x] **Step 1: Add failing assertions for stable disposition response/error mapping**
- [x] **Step 2: Return the service result instead of discarding it**
- [x] **Step 3: Map known validation/not-found errors to 400/404**
- [x] **Step 4: Run focused disposition tests**

### Task 5: Full verification and documentation

**Files:**
- Modify: `docs/superpowers/plans/2026-09-07-phase5-call-action-tenant-hardening.md`

- [x] **Step 1: Run `npm test`**
- [x] **Step 2: Run `npm run build`**
- [x] **Step 3: Run `git diff --check`**
- [x] **Step 4: Inspect the final diff for unintended production fallbacks or unscoped call queries**
- [x] **Step 5: Confirm no call mutation route in the reviewed surface ignores organization_id**
- [x] **Step 5: Commit the verified changes**
- [x] **Step 6: Push the feature branch and create a PR for manual review/merge**
