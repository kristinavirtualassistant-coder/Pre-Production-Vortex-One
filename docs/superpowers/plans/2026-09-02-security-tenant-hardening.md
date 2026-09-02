# Vortex One Security & Tenant Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove remaining runtime tenant fallbacks and prove every production API/service path uses the authenticated organization.

**Architecture:** Firebase authenticates the user; database membership establishes the canonical organization; request handlers and services consume that canonical tenant. No production path may substitute `org_cmc_realty` when tenant context is absent.

**Tech Stack:** TypeScript, Express, Firebase Admin, PostgreSQL/Drizzle, Vitest/tsx tests.

**Spec:** `docs/superpowers/specs/2026-09-02-vortex-one-integrated-platform-design.md`

## Global Constraints

- PostgreSQL is the production source of truth.
- No runtime default organization is permitted.
- Client tenant identifiers must match authenticated tenant context.
- Provider callbacks require provider-level verification and replay protection.
- Seed/test fixtures may retain explicit CMC identifiers when they are not runtime fallbacks.

---

### Task 1: Inventory remaining tenant fallbacks

**Files:**
- Inspect: `server.ts`, `server/db/db.ts`, `server/services/*.ts`, `src/App.tsx`, `src/components/*.tsx`
- Test: `server/test/apiAuthBoundary.test.ts`, `server/test/webhookAuthorization.test.ts`

- [ ] **Step 1: Search the merged `main` branch for runtime fallback patterns.**

Run in **Remote Desktop Commander / Codespace**:
```bash
cd /workspaces/Pre-Production-Vortex-One
rg -n "org_cmc_realty|organizationId.*\|\||\|\|.*organizationId|DEFAULT_ORG_ID" server src --glob '!**/node_modules/**'
```
Expected: results are classified into runtime fallbacks versus seed/test/display-name references.

- [ ] **Step 2: Record each runtime occurrence in the task notes before editing.**
- [ ] **Step 3: Confirm the working tree is clean before changes.**

Run in **Remote Desktop Commander / Codespace**:
```bash
git status --short --branch
```
Expected: clean `main` before feature work.

### Task 2: Remove server tenant fallbacks

**Files:**
- Modify: `server.ts`
- Modify: `server/services/organizationContext.ts`
- Test: `server/test/webhookAuthorization.test.ts`

- [ ] **Step 1: Add failing assertions for requests missing tenant context at the service boundary.**
- [ ] **Step 2: Run the targeted tests and verify they fail for each fallback path.**
- [ ] **Step 3: Replace handler-level `|| 'org_cmc_realty'` logic with `canonicalizeOrganizationContext(req)` or an explicit required organization value.**
- [ ] **Step 4: Ensure service calls use `requireOrganizationId()` rather than choosing a default.**
- [ ] **Step 5: Run targeted authorization tests.**

Run in **Remote Desktop Commander / Codespace**:
```bash
npx tsx server/test/apiAuthBoundary.test.ts
npx tsx server/test/firebaseAdminInitialization.test.ts
npx tsx server/test/webhookAuthorization.test.ts
```
Expected: all targeted security tests pass.

### Task 3: Remove frontend runtime defaults

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/SyncStatusFooter.tsx`
- Modify: `src/components/OutreachTemplateManager.tsx`
- Modify: `src/components/DataImportModal.tsx`
- Modify: `src/components/AuditView.tsx`
- Modify: `src/components/StudioView.tsx`
- Modify: `src/components/CreateLeadModal.tsx`
- Modify: `src/services/dataImportService.ts`

- [ ] **Step 1: Add tests or type-level guards for absent authenticated tenant context.**
- [ ] **Step 2: Replace runtime defaults with an unavailable/disabled state until tenant context exists.**
- [ ] **Step 3: Keep seed/test constants isolated from production UI state.**
- [ ] **Step 4: Run lint/typecheck.**

Run in **Remote Desktop Commander / Codespace**:
```bash
npm run lint
```
Expected: TypeScript/lint passes with no tenant-default errors.

### Task 4: Verify database and provider boundaries

**Files:**
- Inspect/modify: `server/db/db.ts`
- Inspect: `server/services/propertyProviders/*`
- Inspect: `server/services/dataImportService.ts`

- [ ] **Step 1: Prove seed-only `org_cmc_realty` usage is not reachable from request handlers.**
- [ ] **Step 2: Ensure every tenant-owned query receives an explicit organization ID.**
- [ ] **Step 3: Verify provider failures cannot return synthetic production records.**
- [ ] **Step 4: Run the existing targeted database/provider tests.**

### Task 5: Full security verification and commit

- [ ] **Step 1: Run the complete security test set.**
- [ ] **Step 2: Search again for runtime tenant fallbacks.**
- [ ] **Step 3: Run `npm run lint` and `npm run build`.**
- [ ] **Step 4: Review the diff for accidental seed/test changes.**
- [ ] **Step 5: Commit with `security: remove runtime tenant fallbacks`.**
