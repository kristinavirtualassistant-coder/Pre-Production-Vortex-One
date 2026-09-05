# Phase 2 Production State Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure production call, webhook, and background-job state is PostgreSQL-authoritative and fails closed instead of returning synthetic or stale in-memory data.

**Architecture:** HTTP read paths and provider webhooks use PostgreSQL as the production source of truth. Durable jobs are claimed with PostgreSQL row locks and can recover from abandoned workers. In-memory state remains test/UI cache only and never substitutes for authoritative production records.

**Tech Stack:** TypeScript/Node.js, Express, PostgreSQL/Drizzle-compatible SQL, existing dialer services and tests.

**Spec:** `docs/superpowers/plans/2026-09-02-production-reliability.md`

## Global Constraints

- Long-running work cannot depend on an open HTTP request.
- Provider events are idempotent and durable.
- Secrets are never committed to Git.
- Production data is never replaced by demo/fallback data.
- Tenant scope is mandatory for all tenant-owned jobs and events.

---

### Task 1: Production call-state boundary

**Files:**
- Modify: `server.ts`
- Modify: `server/dialer/webhookHandler.ts`
- Modify: `server/test/suite.ts`
- Create: `server/test/productionStateBoundary.test.ts`

- [x] **Step 1: Write failing tests for synthetic call/event responses and webhook memory fallback.**
- [x] **Step 2: Verify the tests fail against the existing fallback behavior.**
- [x] **Step 3: Remove production fallback responses and require PostgreSQL for authoritative webhook processing.**
- [x] **Step 4: Update local suite behavior to skip PostgreSQL-dependent webhook integration tests when no database is configured.**
- [x] **Step 5: Run the focused boundary test.**

### Task 2: Durable job recovery

**Files:**
- Modify: `server/services/jobService.ts`
- Modify: `server/test/jobService.test.ts`

- [ ] **Step 1: Write failing tests for stale processing jobs being safely re-queued and tenant-scoped.**
- [ ] **Step 2: Implement `recoverStaleJobs` with an age threshold and row-count result.**
- [ ] **Step 3: Reject invalid retry/lease parameters before SQL execution.**
- [ ] **Step 4: Run focused job tests.**

### Task 3: Phase verification

**Files:**
- No production files beyond Tasks 1–2.

- [ ] **Step 1: Run the complete test suite.**
- [ ] **Step 2: Run the production build.**
- [ ] **Step 3: Run TypeScript validation and `git diff --check`.**
- [ ] **Step 4: Audit the diff for remaining synthetic call/event fallbacks.**
- [ ] **Step 5: Commit and create the Phase 2 PR without deploying production.**
