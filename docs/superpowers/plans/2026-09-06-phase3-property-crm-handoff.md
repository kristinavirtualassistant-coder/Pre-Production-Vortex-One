# Phase 3 Property-to-CRM Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the property-search-to-CRM workflow create canonical tenant-scoped leads from real database records instead of navigating to a screen with no persistence action.

**Architecture:** The authenticated property record determines its canonical owner. A PostgreSQL transaction locks the property, verifies the owner relationship, checks for an existing lead, and inserts one when necessary. The UI invokes this server command and navigates only after the server confirms the canonical lead ID.

**Tech Stack:** React/TypeScript, Express, PostgreSQL, existing CRM service and authenticated API middleware.

**Spec:** `docs/superpowers/plans/2026-09-02-property-intelligence.md`

## Global Constraints

- PostgreSQL/PostGIS is the property search source of truth.
- Every property query is tenant-scoped.
- Provider failures must never become synthetic production search results.
- Provenance is retained for imported/verified data.

---

### Task 1: Canonical property-to-lead transaction

**Files:**
- Modify: `server/services/crmService.ts`
- Create: `server/test/crmService.test.ts`

- [x] **Step 1: Write a failing test for transactional canonical lead creation and owner mismatch rejection.**
- [x] **Step 2: Verify the existing non-transactional implementation fails the test.**
- [x] **Step 3: Implement tenant-scoped property locking and owner verification.**
- [x] **Step 4: Preserve idempotent existing-lead behavior inside the transaction.**
- [x] **Step 5: Run focused CRM tests.**

### Task 2: Authenticated property handoff API

**Files:**
- Modify: `server.ts`

- [x] **Step 1: Add an authenticated `POST /api/properties/:id/create-lead` route.**
- [x] **Step 2: Derive owner/property identity from PostgreSQL instead of trusting client-supplied IDs.**
- [x] **Step 3: Return the canonical lead ID and created/existing status.**
- [x] **Step 4: Fail closed when PostgreSQL or the canonical owner is unavailable.**

### Task 3: Property search UI integration

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/PropertySearchView.tsx` only if callback contract requires it

- [x] **Step 1: Replace the navigation-only Create Lead action with the authenticated API command.**
- [x] **Step 2: Store the returned lead ID and navigate to CRM only after confirmation.**
- [x] **Step 3: Surface server errors without creating synthetic local leads.**

### Task 4: Phase verification

- [ ] **Step 1: Run focused CRM tests.**
- [ ] **Step 2: Run the complete test suite.**
- [ ] **Step 3: Run production build and `git diff --check`.**
- [ ] **Step 4: Review the diff for client-generated owner/property/lead identifiers.**
- [ ] **Step 5: Commit and publish the Phase 3 branch; do not deploy production.**
