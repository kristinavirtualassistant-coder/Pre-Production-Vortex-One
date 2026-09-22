# Phase 4 Production Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the current hardening sequence by making core CRM/property/campaign reads PostgreSQL-authoritative and adding a repeatable production-readiness acceptance gate without performing a live outbound call.

**Architecture:** Authenticated read APIs return tenant-scoped PostgreSQL records and fail closed on database loss. Existing provider, webhook, authentication, campaign, and property-boundary tests remain the acceptance gates. Live RingCentral calling remains outside this code-only phase unless separately authorized.

**Tech Stack:** TypeScript/Node.js, Express, PostgreSQL, React/Vite, existing Vortex One acceptance tests.

**Spec:** `docs/superpowers/specs/2026-09-02-vortex-one-integrated-platform-design.md`

## Global Constraints

- PostgreSQL is authoritative; no production synthetic contacts or in-memory-only campaigns.
- Provider events are authenticated, idempotent, durable, and tenant-scoped.
- California is operational V1 coverage; nationwide is an adapter architecture.
- Production data is never replaced by demo/fallback data.
- No live outbound call is performed by this phase.

---

### Task 1: Authoritative production read APIs

**Files:**
- Modify: `server.ts`
- Create: `server/test/phase4ProductionReadBoundary.test.ts`

- [x] **Step 1: Write failing boundary tests for property, lead, and campaign read fallbacks.**
- [x] **Step 2: Verify the tests fail against the existing memory-backed routes.**
- [x] **Step 3: Replace property, lead, and campaign read fallbacks with tenant-scoped PostgreSQL queries.**
- [x] **Step 4: Return explicit 503 errors when authoritative PostgreSQL state is unavailable.**
- [x] **Step 5: Run the focused boundary test.**

### Task 2: Final acceptance verification

**Files:**
- No additional production behavior changes.

- [ ] **Step 1: Run the complete test suite.**
- [ ] **Step 2: Run the production build.**
- [ ] **Step 3: Run `git diff --check`.**
- [ ] **Step 4: Audit authentication, provider, webhook, property, CRM, campaign, and call-state boundaries.**
- [ ] **Step 5: Commit and publish the Phase 4 branch without deploying production or placing a live call.**
