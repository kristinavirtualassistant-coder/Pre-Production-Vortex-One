# Vortex One Portable Infrastructure, RingCentral, and OpenAI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Vortex One runtime-portable outside GCP, formalize RingCentral as the telephony provider integration, and diagnose/harden the existing OpenAI Agents session failure without hiding it.

**Architecture:** Keep PostgreSQL/PostGIS authoritative and expose infrastructure through environment-driven interfaces. Keep RingCentral behind a provider-neutral telephony contract, and keep OpenAI Agents as a separate external-provider boundary with explicit session-state handling.

**Tech Stack:** Node.js 22, TypeScript, Express, PostgreSQL/`pg`, PostGIS where configured, RingCentral SDK, OpenAI Agents SDK, Vite/React, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-12-portable-infrastructure-ringcentral-openai-design.md`

## Global Constraints

- PostgreSQL remains the canonical production state store.
- RingCentral credentials are environment/deployment secrets and are never persisted in application records or Git.
- No new Redis, Kafka, Pub/Sub, RabbitMQ, or equivalent queue is introduced.
- No GCP resource is deleted or decommissioned in this implementation.
- The OpenAI Agents 404 must be reproduced and explained rather than bypassed by deleting persisted session state.
- Existing tenant isolation, durable jobs, idempotency, and authoritative-state behavior must remain intact.
- Existing CI must remain green.
- No production release claim is made until the existing release gates pass.

---

### Task 1: Reconcile the repository baseline and isolate the OpenAI failure

**Files:**
- Read: `scripts/openai-agent.ts`
- Read: `config/openai-agent.json`
- Read: `package.json`
- Read: `server/test/`
- Create: `server/test/openaiAgentSession.test.ts`

**Interfaces:**
- Consumes the existing `AgentConfig` shape and OpenAI environment configuration.
- Produces deterministic tests around session ID loading, OpenAI project configuration, and invalid/stale persisted conversation behavior.

- [ ] **Step 1: Inspect the current OpenAI configuration and reproduce the existing command failure**

Run from the repository root:

```bash
npm run openai:agent
```

Record the HTTP status, message ID, request context, project, model, and whether `.openai/conversation-id` is present. Do not delete or overwrite the conversation ID before recording the failure.

- [ ] **Step 2: Write a failing regression test for stale persisted conversation state**

Add a test that supplies a persisted conversation ID and a mocked session/run boundary, then asserts the runner reports the provider failure without silently replacing the persisted ID.

- [ ] **Step 3: Run the targeted test and verify the regression test fails for the current behavior**

Run:

```bash
node --import tsx server/test/openaiAgentSession.test.ts
```

Expected: the test demonstrates the current runner lacks an explicit stale-session recovery boundary.

- [ ] **Step 4: Implement the smallest explicit session-state boundary**

Refactor `scripts/openai-agent.ts` so session ID persistence/loading is isolated behind a small testable function or module. Preserve the existing persisted ID on ordinary failures and emit an actionable distinction between provider rejection and local state corruption.

- [ ] **Step 5: Run the targeted test again**

Run:

```bash
node --import tsx server/test/openaiAgentSession.test.ts
```

Expected: PASS.

- [ ] **Step 6: Re-run the real OpenAI agent command without clearing state**

Run:

```bash
npm run openai:agent
```

Expected: either successful execution or a deterministic provider error that identifies the invalid/stale session condition. Do not claim the OpenAI issue fixed unless the live command succeeds or the root cause is verified from provider evidence.

- [ ] **Step 7: Commit the OpenAI hardening**

```bash
git add scripts/openai-agent.ts server/test/openaiAgentSession.test.ts config/openai-agent.json
git commit -m "fix: harden OpenAI agent session state"
```

---

### Task 2: Establish a provider-neutral runtime configuration boundary

**Files:**
- Modify: `server/db/db.ts`
- Modify: `.env.example`
- Read/modify only where required: `server.ts`
- Test: `server/test/`

**Interfaces:**
- Consumes `DATABASE_URL` or standard `SQL_HOST`, `SQL_PORT`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD`, and `SQL_SSL` settings.
- Produces one runtime database configuration independent of Cloud Run/Cloud SQL socket metadata.

- [ ] **Step 1: Add failing configuration tests**

Test that a standard PostgreSQL URL configures the application without any `CLOUD_SQL_CONNECTION_NAME`, Google Secret Manager, or Cloud Run environment variable.

- [ ] **Step 2: Run the targeted configuration test**

Run:

```bash
npm test -- --help
```

Then run the repository's existing targeted test mechanism for the added case. If the suite does not expose per-test selection, run `npm test` after adding the test and use its failure output as the baseline.

- [ ] **Step 3: Implement the portable database configuration**

Make standard PostgreSQL settings the primary path. Keep the existing Cloud SQL connection-name setting as optional metadata for legacy GCP deployments, not as a required startup input.

- [ ] **Step 4: Update `.env.example`**

Document standard PostgreSQL configuration first and clearly mark GCP-specific settings as optional legacy deployment settings.

- [ ] **Step 5: Run lint and the full automated suite**

```bash
npm run lint
npm test
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add server/db/db.ts server.ts .env.example server/test
 git commit -m "refactor: make database runtime portable"
```

---

### Task 3: Formalize the telephony provider interface around RingCentral

**Files:**
- Modify: `src/services/telephonyAdapter.ts`
- Modify: `server/dialer/telephonyAdapter.ts`
- Modify: `server/dialer/types.ts`
- Modify: `server/dialer/dialingEngine.ts`
- Modify: `server/dialer/webhookHandler.ts`
- Test: existing RingCentral tests plus new provider contract tests under `server/test/`

**Interfaces:**
- Produces a provider-neutral contract with operations equivalent to `makeCall`, provider event normalization, and provider identifiers.
- RingCentral remains the concrete implementation selected by configuration.

- [ ] **Step 1: Write provider-contract tests first**

Test the contract with a fake provider that can start a call and emit normalized events. Assert that the dialer consumes the contract rather than RingCentral SDK types directly.

- [ ] **Step 2: Run the contract tests and verify they fail**

Run:

```bash
npm test
```

Expected: failures identify direct RingCentral assumptions in the dialer path.

- [ ] **Step 3: Introduce the smallest telephony interface**

Define the exact application-facing operations required by current dialing and webhook flows. Keep the interface narrow; do not expose the entire RingCentral SDK.

- [ ] **Step 4: Adapt RingCentral to the interface**

Wrap existing RingCentral SDK calls and map provider-specific call IDs/ringout IDs into the canonical call model.

- [ ] **Step 5: Update dialing and webhook paths to consume the interface**

Replace direct provider assumptions only where required. Preserve existing PostgreSQL transactions, idempotency, DNC/suppression checks, and call-state transitions.

- [ ] **Step 6: Run RingCentral smoke/auth tests**

```bash
npm run test:ringcentral:jwt
npm run test:ringcentral:auth
```

Expected: PASS when valid company RingCentral credentials are supplied; otherwise failures must identify missing/invalid credentials without exposing secrets.

- [ ] **Step 7: Run the full suite**

```bash
npm run lint
npm test
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/services/telephonyAdapter.ts server/dialer/telephonyAdapter.ts server/dialer/types.ts server/dialer/dialingEngine.ts server/dialer/webhookHandler.ts server/test
 git commit -m "refactor: isolate RingCentral behind telephony provider"
```

---

### Task 4: Remove application-level GCP runtime assumptions

**Files:**
- Modify only files identified by repository search for `Cloud Run`, `Cloud SQL`, `Secret Manager`, `googleapis`, `CLOUD_SQL_CONNECTION_NAME`, and GCP-specific startup branches.
- Test: affected server tests.

**Interfaces:**
- Consumes portable environment configuration.
- Produces identical application behavior when GCP-specific variables are absent.

- [ ] **Step 1: Search for runtime coupling**

Run:

```bash
git grep -n -E 'Cloud Run|Cloud SQL|Secret Manager|CLOUD_SQL_CONNECTION_NAME|GOOGLE_|gcloud|@google-cloud' -- ':!package-lock.json' ':!bun.lock'
```

Classify each match as runtime dependency, deployment metadata, documentation, or harmless UI copy.

- [ ] **Step 2: Add a regression test for startup without GCP variables**

Start the application with a local PostgreSQL `DATABASE_URL` and without GCP-specific variables. Assert the health/readiness path reports the actual database state rather than assuming Cloud SQL.

- [ ] **Step 3: Remove only runtime coupling**

Do not delete optional deployment manifests or documentation solely because they mention GCP. Remove code paths that make GCP a prerequisite for normal operation.

- [ ] **Step 4: Normalize provider-neutral status labels**

Replace misleading hard-coded labels such as `PostgreSQL Cloud SQL` with runtime-derived database/provider status.

- [ ] **Step 5: Run build, lint, and tests**

```bash
npm run lint
npm run build
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server src .env.example
 git commit -m "refactor: remove GCP runtime coupling"
```

---

### Task 5: Add documented no-cost/local deployment mode

**Files:**
- Modify: `scripts/local-dev.sh`
- Modify: `.env.example`
- Create: `docs/deployment-portable.md`
- Review: `Dockerfile`
- Review: `docs/deployment-free.md`

**Interfaces:**
- Consumes standard environment variables and local PostgreSQL/PostGIS.
- Produces a repeatable local runtime suitable for development and controlled small-scale operation.

- [ ] **Step 1: Test the documented local startup path**

Run:

```bash
./scripts/local-dev.sh
```

Verify the process starts against the isolated local PostgreSQL configuration and does not require GCP credentials.

- [ ] **Step 2: Make only required script/config changes**

Ensure the script creates no cloud resources, uses standard PostgreSQL configuration, and leaves the existing local safety defaults intact.

- [ ] **Step 3: Document the portable deployment contract**

Document required variables, optional RingCentral variables, optional OpenAI variables, database setup, migration execution, health checks, and the distinction between local/no-cost operation and production-grade hosted operation.

- [ ] **Step 4: Build the container**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/local-dev.sh .env.example docs/deployment-portable.md docs/deployment-free.md Dockerfile
 git commit -m "docs: define portable zero-cost deployment mode"
```

---

### Task 6: Validate PostgreSQL migration portability and data safety

**Files:**
- Read: `server/db/migrations.ts`
- Read: `server/test/postgresAuthoritativeState.test.ts`
- Modify only if tests expose a portability defect: `server/db/migrations.ts` and corresponding tests.
- Create if needed: `server/test/postgresMigrationPortability.test.ts`

**Interfaces:**
- Consumes standard PostgreSQL connection configuration.
- Produces the same nine-migration schema state without Cloud SQL-specific behavior.

- [ ] **Step 1: Add migration portability coverage**

Assert that migrations run against ordinary PostgreSQL and that `schema_migrations` records the expected migration sequence.

- [ ] **Step 2: Run migration tests against a disposable local PostgreSQL instance**

Use the existing `scripts/local-dev.sh` PostgreSQL setup. Do not use production credentials or alter the live Cloud SQL database.

- [ ] **Step 3: Fix only verified portability defects**

Preserve transactions, tenant constraints, durable jobs, processed-event idempotency, and authoritative-state behavior.

- [ ] **Step 4: Run the authoritative-state regression test**

```bash
npm test
```

Expected: PostgreSQL outage tests still reject mutations rather than falling back to in-memory authoritative state.

- [ ] **Step 5: Commit**

```bash
git add server/db server/test
 git commit -m "test: verify portable PostgreSQL migrations"
```

---

### Task 7: Validate OpenAI, RingCentral, database, and application integration together

**Files:**
- Test: existing and newly added tests only unless an integration defect is found.
- Read: `scripts/openai-agent.ts`, RingCentral adapter files, database layer.

**Interfaces:**
- Validates the boundaries created by Tasks 1–6.

- [ ] **Step 1: Run the complete local verification suite**

```bash
npm run lint
npm run build
npm test
```

Expected: PASS.

- [ ] **Step 2: Run RingCentral authentication smoke tests with the company's authorized credentials**

```bash
npm run test:ringcentral:jwt
npm run test:ringcentral:auth
```

Expected: PASS with valid credentials; output must not print secret values.

- [ ] **Step 3: Run the OpenAI agent smoke test**

```bash
npm run openai:agent
```

Expected: successful agent session, or a provider-confirmed actionable error. A stale conversation ID must not be silently replaced.

- [ ] **Step 4: Verify no credentials are tracked**

```bash
git status --short
git grep -n -E 'RINGCENTRAL_CLIENT_SECRET|RINGCENTRAL_JWT|OPENAI_API_KEY|SQL_PASSWORD=' -- ':!.env.example'
```

Expected: no real secrets in tracked source.

- [ ] **Step 5: Commit verification-only documentation if required**

If the verification results require documentation changes, commit them separately with a message describing the verified behavior. Do not commit runtime secrets or generated local state.

---

### Task 8: Open the migration/cutover gate without decommissioning GCP

**Files:**
- Create: `docs/migration/gcp-to-portable-cutover.md`
- Modify: `docs/deployment-portable.md` if necessary.

**Interfaces:**
- Documents the migration inputs/outputs and explicit release gates; does not perform destructive decommissioning.

- [ ] **Step 1: Document database migration procedure**

Specify source backup/export, target restore/import, migration verification, row-count/hash checks for critical tables, tenant checks, and rollback to the original database.

- [ ] **Step 2: Document RingCentral cutover verification**

Specify credential configuration, test call, webhook delivery, call-state reconciliation, disposition persistence, and rollback to the prior deployment.

- [ ] **Step 3: Document OpenAI validation gate**

Require a successful live agent session and explicit session persistence verification before production release.

- [ ] **Step 4: Document the GCP decommission gate**

State that Cloud Run, Cloud SQL, Secret Manager, VPC connectors, and related resources remain untouched until the migration is accepted and rollback is no longer required.

- [ ] **Step 5: Commit the cutover documentation**

```bash
git add docs/migration/gcp-to-portable-cutover.md docs/deployment-portable.md
 git commit -m "docs: define safe GCP cutover and rollback"
```

---

## Final Verification

- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm test` and confirm zero failures.
- [ ] Run `npm run test:ringcentral:jwt` with authorized credentials.
- [ ] Run `npm run test:ringcentral:auth` with authorized credentials.
- [ ] Run `npm run openai:agent` and record the actual outcome.
- [ ] Verify `git status --short` contains no accidental secrets or generated state.
- [ ] Verify no GCP production resource was deleted or modified destructively.
- [ ] Verify the migration/cutover document explicitly blocks decommissioning until all release gates pass.
