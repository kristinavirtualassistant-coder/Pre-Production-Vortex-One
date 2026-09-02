# Vortex One CRM & PhoneBurner-Style Dialer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace disconnected CRM/dialer prototypes with a canonical lead workflow and a server-owned RingCentral power-dialing engine.

**Architecture:** CRM owns canonical leads, pipeline, activities, tasks, and contact relationships. Campaigns consume eligible CRM leads; the dialer owns call concurrency/state and emits durable events back into CRM.

**Tech Stack:** React/TypeScript, Express, Drizzle/PostgreSQL, Firebase auth, existing campaign manager, RingCentral integration/webhooks, worker/job infrastructure.

**Spec:** `docs/superpowers/specs/2026-09-02-vortex-one-integrated-platform-design.md`

## Global Constraints

- A lead has one canonical CRM identity within an organization.
- PostgreSQL is authoritative; no production synthetic contacts or in-memory-only campaigns.
- Dialer concurrency is server-controlled and configurable from 3–10.
- DNC, timezone, calling-hours, and retry policy are enforced before each attempt.
- Provider events are authenticated, idempotent, durable, and tenant-scoped.

---

### Task 1: Canonical CRM model

**Files:**
- Modify: `server/db/schema.ts`
- Create/modify: CRM service modules under `server/services/`
- Test: CRM service tests

- [ ] **Step 1: Write failing tests for owner/contact/lead identity and duplicate prevention.**
- [ ] **Step 2: Add `contacts`, `phones`, `emails`, `pipelines`, `pipeline_stages`, `activities`, `tasks`, and opportunity records where the existing schema lacks first-class support.**
- [ ] **Step 3: Add unique/index constraints needed for tenant-safe deduplication.**
- [ ] **Step 4: Implement canonical lead creation/update transactions.**
- [ ] **Step 5: Run focused CRM tests and migrations against a test database.**

### Task 2: CRM pipeline and activity timeline

**Files:**
- Modify: CRM API handlers in `server.ts`
- Modify: `src/components/TasksView*`, lead/CRM views, and `src/App.tsx`
- Test: CRM API/component tests

- [ ] **Step 1: Write failing tests for stage transitions and activity ordering.**
- [ ] **Step 2: Implement organization-configurable pipelines and stages with the approved default stages.**
- [ ] **Step 3: Implement activity writes for calls, SMS, email, voicemail, enrichment, notes, tasks, and stage changes.**
- [ ] **Step 4: Render one chronological owner/lead timeline in the CRM.**
- [ ] **Step 5: Run focused CRM tests and frontend build.**

### Task 3: Campaign eligibility and database queue

**Files:**
- Modify: `server/services/campaignManager.ts`
- Modify: campaign-related schema/API files
- Test: campaign eligibility tests

- [ ] **Step 1: Write failing tests for DNC, timezone, calling-hours, invalid-number, retry-limit, and duplicate-campaign membership rules.**
- [ ] **Step 2: Replace synthetic contact creation in `dialNextContact()` with a database eligibility query.**
- [ ] **Step 3: Make campaign creation and contact membership PostgreSQL-authoritative.**
- [ ] **Step 4: Add deterministic queue claiming so two workers cannot dial the same contact.**
- [ ] **Step 5: Run campaign tests under concurrent claim scenarios.**

### Task 4: Provider-neutral dialer state machine

**Files:**
- Create: `server/dialer/callStateMachine.ts`
- Create/modify: `server/dialer/telephonyAdapter.ts`
- Modify: `server/dialer/webhookHandler.ts`
- Test: `server/test/callStateMachine.test.ts`

- [ ] **Step 1: Write failing tests for QUEUED, DIALING, RINGING, HUMAN, VOICEMAIL, NO_ANSWER, BUSY, DISCONNECTED, FAILED, CONNECTED, IN_CALL, WRAP_UP, DISPOSITIONED, and COMPLETED transitions.**
- [ ] **Step 2: Define typed provider-neutral events and legal transitions.**
- [ ] **Step 3: Reject illegal/replayed transitions without corrupting the durable call state.**
- [ ] **Step 4: Persist every accepted transition as a call event.**
- [ ] **Step 5: Run the state-machine test suite.**

### Task 5: RingCentral adapter and webhook reliability

**Files:**
- Modify: `server/dialer/*`
- Modify: RingCentral configuration/integration files
- Test: webhook authorization/idempotency and adapter tests

- [ ] **Step 1: Write failing tests for provider event normalization and duplicate event handling.**
- [ ] **Step 2: Implement the RingCentral adapter behind the provider-neutral interface.**
- [ ] **Step 3: Validate provider callback authenticity using the supported RingCentral mechanism before processing events.**
- [ ] **Step 4: Use `processedEvents`/equivalent durable idempotency records to ignore duplicates.**
- [ ] **Step 5: Persist normalized events and update the call state machine.**
- [ ] **Step 6: Run webhook regression tests.**

### Task 6: Multi-line dialing engine

**Files:**
- Create: `server/dialer/dialingEngine.ts`
- Modify: `server/services/campaignManager.ts`
- Modify: `server/db/schema.ts` if agent-state/lease fields are required
- Test: `server/test/dialingEngine.test.ts`

- [ ] **Step 1: Write failing tests for configurable concurrency from 3 through 10.**
- [ ] **Step 2: Implement server-side slot accounting and durable contact leases.**
- [ ] **Step 3: Start eligible calls until the configured concurrency is reached.**
- [ ] **Step 4: On a human connection, resolve other active attempts according to provider-supported behavior and free capacity.**
- [ ] **Step 5: Replenish the queue without requiring frontend navigation.**
- [ ] **Step 6: Run concurrency and recovery tests.**

### Task 7: Disposition and follow-up transaction

**Files:**
- Modify: call/lead/campaign service modules
- Modify: dialer UI components
- Test: disposition integration tests

- [ ] **Step 1: Write failing tests for each approved disposition and resulting stage/retry behavior.**
- [ ] **Step 2: Implement one transactional disposition command updating call, campaign contact, lead, activity, and follow-up task.**
- [ ] **Step 3: Prevent automatic redial for DNC and disconnected numbers.**
- [ ] **Step 4: Add `Save & Next` behavior that returns the next eligible campaign contact.**
- [ ] **Step 5: Run integration tests.**

### Task 8: Production dialer UI and realtime updates

**Files:**
- Modify: `src/components/DialerView*`
- Modify: `src/components/DialerDashboard*`
- Modify: campaign views and CRM lead views
- Test: dialer UI tests

- [ ] **Step 1: Write failing tests for live call status, current contact, disposition controls, pause/stop, and Save & Next.**
- [ ] **Step 2: Remove hard-coded lead pools and consume campaign state from authenticated APIs.**
- [ ] **Step 3: Subscribe to server call/campaign events using the project's realtime transport.**
- [ ] **Step 4: Render provider state without making the browser authoritative for call state.**
- [ ] **Step 5: Run UI tests and production build.**

### Task 9: End-to-end acceptance

- [ ] **Step 1: Create a real CRM lead from a verified California property.**
- [ ] **Step 2: Add it to a controlled campaign and verify eligibility filtering.**
- [ ] **Step 3: Execute a controlled RingCentral call using test credentials.**
- [ ] **Step 4: Receive and process the provider event.**
- [ ] **Step 5: Record a disposition and verify CRM activity/follow-up.**
- [ ] **Step 6: Verify the dialer advances to the next eligible contact.**
- [ ] **Step 7: Run security tests, lint, build, and relevant integration tests.**
- [ ] **Step 8: Commit with `feat: integrate canonical crm and power dialer`.**
