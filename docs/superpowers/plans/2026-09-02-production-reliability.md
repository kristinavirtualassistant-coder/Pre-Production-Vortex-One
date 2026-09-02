# Vortex One Production Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long-running ingestion, enrichment, campaign, webhook, retry, and metrics work durable and observable in production.

**Architecture:** HTTP APIs enqueue durable work; workers process jobs and provider events; PostgreSQL stores job/call/event state; realtime notifications update the UI. Cloud Run/Cloud SQL remain the deployment baseline.

**Tech Stack:** TypeScript/Node.js, Express, PostgreSQL/Drizzle, Cloud Run, Cloud SQL, RingCentral webhooks, existing application logging/metrics.

**Spec:** `docs/superpowers/specs/2026-09-02-vortex-one-integrated-platform-design.md`

## Global Constraints

- Long-running work cannot depend on an open HTTP request.
- Provider events are idempotent and durable.
- Secrets are never committed to Git.
- Production data is never replaced by demo/fallback data.
- Tenant scope is mandatory for all tenant-owned jobs and events.

---

### Task 1: Durable job boundary

**Files:**
- Create/modify: worker/job modules under `server/`
- Modify: `server/services/dataImportService.ts`, enrichment services, campaign services
- Test: worker/job tests

- [ ] **Step 1: Write failing tests for queued, processing, completed, failed, and retryable jobs.**
- [ ] **Step 2: Define a durable job record containing organization ID, type, payload, status, attempts, and timestamps.**
- [ ] **Step 3: Implement atomic job claiming so multiple workers cannot process the same job concurrently.**
- [ ] **Step 4: Add bounded retries and terminal failure state.**
- [ ] **Step 5: Run worker tests against PostgreSQL.**

### Task 2: Webhook idempotency and recovery

**Files:**
- Modify: `server/dialer/webhookHandler.ts`
- Modify: webhook persistence/service modules
- Test: webhook integration tests

- [ ] **Step 1: Write a test that submits the same provider event twice.**
- [ ] **Step 2: Persist a provider event key before applying its side effects inside a transaction.**
- [ ] **Step 3: Return the already-processed result for a duplicate event without repeating side effects.**
- [ ] **Step 4: Test recovery after a worker/API restart between event receipt and processing.**

### Task 3: Realtime event delivery

**Files:**
- Inspect/modify: existing realtime server/client modules
- Modify: `src/components/DialerView*`, campaign and CRM views
- Test: realtime integration tests

- [ ] **Step 1: Write tests for call-state and campaign-state events reaching subscribed authenticated users.**
- [ ] **Step 2: Publish normalized durable events after successful database transactions.**
- [ ] **Step 3: Filter realtime events by organization and relevant resource.**
- [ ] **Step 4: Verify the UI reflects server state after refresh/reconnect.**

### Task 4: Production observability

**Files:**
- Modify: existing logging/metrics modules
- Create/modify: health and operational metric endpoints
- Test: observability tests

- [ ] **Step 1: Add tests for API/database/worker/telephony/provider health status.**
- [ ] **Step 2: Emit structured events for search, enrichment, lead, campaign, call, webhook, and failure operations.**
- [ ] **Step 3: Expose metrics for campaign attempts, connections, dispositions, queue depth, job failures, and provider errors.**
- [ ] **Step 4: Ensure logs never contain access tokens or secret values.**

### Task 5: Cloud deployment verification

**Files:**
- Inspect/modify: Cloud Run deployment configuration, Dockerfile, package scripts, environment examples
- Test: production smoke-test scripts

- [ ] **Step 1: Write a smoke test for authenticated API → PostgreSQL → realtime response.**
- [ ] **Step 2: Verify production configuration has no committed secrets and no default tenant.**
- [ ] **Step 3: Verify Cloud Run can reach Cloud SQL and worker execution can reach required providers.**
- [ ] **Step 4: Verify health checks do not expose protected data.**
- [ ] **Step 5: Run the smoke test against staging before production.**

### Task 6: Final production gate

- [ ] **Step 1: Run security, property, CRM, dialer, worker, and webhook tests.**
- [ ] **Step 2: Run `npm run lint` and `npm run build`.**
- [ ] **Step 3: Run the controlled end-to-end acceptance path from the approved specification.**
- [ ] **Step 4: Review deployment logs and database state for duplicate or cross-tenant records.**
- [ ] **Step 5: Commit with `chore: harden production reliability and observability`.**
