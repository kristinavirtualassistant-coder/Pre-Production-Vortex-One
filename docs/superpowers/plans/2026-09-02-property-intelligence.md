# Vortex One Property Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make California property search genuinely database-backed while preserving a provider-neutral nationwide architecture.

**Architecture:** Verified county/source data is ingested, normalized, and persisted in PostgreSQL/PostGIS. Search reads normalized data rather than calling providers or returning demo records at request time.

**Tech Stack:** React/TypeScript, Express, Drizzle/PostgreSQL, PostGIS, existing property-provider interfaces and ingestion services.

**Spec:** `docs/superpowers/specs/2026-09-02-vortex-one-integrated-platform-design.md`

## Global Constraints

- California is operational V1 coverage; nationwide is an adapter architecture.
- PostgreSQL/PostGIS is the property search source of truth.
- Every property query is tenant-scoped.
- Provider failures must never become synthetic production search results.
- Provenance is retained for imported/verified data.

---

### Task 1: Map current property-search flow

**Files:**
- Inspect: `src/components/PropertySearch*`, `src/components/PropertyDetailView*`, `src/components/BulkAreaSearch*`
- Inspect: `server/services/propertyProviders/*`
- Inspect: `server.ts`, `server/db/schema.ts`
- Test: existing property-search and GIS tests

- [ ] **Step 1: Trace frontend search request to database/provider boundary.**
- [ ] **Step 2: Identify demo data, direct-provider search, and fallback branches.**
- [ ] **Step 3: Identify normalized database fields needed for each existing filter.**
- [ ] **Step 4: Document missing indexes and PostGIS requirements.**

### Task 2: Build normalized property search contract

**Files:**
- Create/modify: `server/services/propertySearchService.ts`
- Modify: `server/db/schema.ts` and migration files as required
- Test: `server/test/propertySearchService.test.ts`

- [ ] **Step 1: Write failing tests for geography, address/APN, owner, property-type, value/equity, ownership-duration, absentee/corporate, and portfolio filters.**
- [ ] **Step 2: Define `PropertySearchQuery` with optional typed filters and pagination/sort.**
- [ ] **Step 3: Implement parameterized PostgreSQL queries scoped by organization ID.**
- [ ] **Step 4: Add required indexes for common exact/range/filter access paths.**
- [ ] **Step 5: Run focused tests and verify returned rows are normalized records.**

### Task 3: Operationalize California ingestion

**Files:**
- Modify: existing county provider implementations under `server/services/propertyProviders/`
- Modify: `server/services/dataImportService.ts`
- Inspect/modify: county ingestion tests and staging schemas

- [ ] **Step 1: Add failing ingestion tests for one representative county/source.**
- [ ] **Step 2: Validate source record parsing and APN/address normalization.**
- [ ] **Step 3: Persist normalized records with source/provenance metadata.**
- [ ] **Step 4: Make imports idempotent using source record identifiers and organization scope.**
- [ ] **Step 5: Run the county ingestion test suite.**

### Task 4: Connect Property Search UI to database API

**Files:**
- Modify: `src/components/PropertySearch*`
- Modify: `src/components/PropertyDetailView*`
- Modify: `src/components/BulkAreaSearch*`
- Modify: `src/components/SavedPropertiesView*`
- Test: frontend search tests

- [ ] **Step 1: Add failing tests for query submission, pagination, selection, and empty/error states.**
- [ ] **Step 2: Replace local/demo result sources with the authenticated search API.**
- [ ] **Step 3: Render map/table results from normalized API records.**
- [ ] **Step 4: Persist saved properties and searches through tenant-scoped APIs.**
- [ ] **Step 5: Run frontend tests and build.**

### Task 5: Owner, portfolio, enrichment, and lead handoff

**Files:**
- Modify: `server/services/skipTraceService.ts`
- Modify: owner/lead services and relevant API handlers
- Modify: `src/components/BatchEnrichmentModal*`, `src/components/SkipTraceModal*`
- Test: enrichment and lead-creation tests

- [ ] **Step 1: Write failing tests for owner deduplication and multi-property portfolio aggregation.**
- [ ] **Step 2: Implement enrichment writes against canonical owner/contact records.**
- [ ] **Step 3: Persist phone/email provenance and verification state.**
- [ ] **Step 4: Implement transactional Property → Owner → Contact → Lead creation/update.**
- [ ] **Step 5: Ensure DNC/suppression is evaluated before campaign eligibility.**
- [ ] **Step 6: Verify a selected property can become a CRM lead without CSV export/import.**

### Task 6: Nationwide provider contract and verification

**Files:**
- Modify: `server/services/propertyProviders/PropertyDataProvider.ts`
- Modify: `server/services/propertyProviders/providerHelpers.ts`
- Test: provider contract tests

- [ ] **Step 1: Define normalized provider input/output independent of county implementation.**
- [ ] **Step 2: Add contract tests that every provider must satisfy.**
- [ ] **Step 3: Classify each current provider as operational, partial, adapter, demo, or deprecated.**
- [ ] **Step 4: Prevent demo providers from being selected in production configuration.**
- [ ] **Step 5: Run contract tests and the production build.**

### Task 7: End-to-end property acceptance

- [ ] **Step 1: Run ingestion for a controlled California dataset.**
- [ ] **Step 2: Search the ingested property through the authenticated API.**
- [ ] **Step 3: Open property detail and verify provenance.**
- [ ] **Step 4: Enrich owner/contact and create a CRM lead.**
- [ ] **Step 5: Verify no synthetic provider fallback occurs.**
- [ ] **Step 6: Commit with `feat: establish database-backed property intelligence`.**
