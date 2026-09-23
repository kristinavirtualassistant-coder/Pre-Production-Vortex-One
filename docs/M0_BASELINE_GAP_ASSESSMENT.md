# Vortex One M0 Baseline / Gap Assessment

Captured: 2026-09-23
Repository: kristinavirtualassistant-coder/Pre-Production-Vortex-One
Reference branch: main

## Evidence summary

| Area | Status | Evidence | Gap |
|---|---|---|---|
| Frontend | Partial | Existing Vite/React TypeScript app under src/ | Target apps/web structure is not present |
| Backend | Partial | Existing Express server in server.ts | Target specification names NestJS; reconcile before any rewrite |
| Database | Partial | PostgreSQL pool and versioned SQL migrations exist in server/db/migrations.ts | Target database/migrations structure is not present; Prisma is absent |
| Redis | Missing/Unverified | No Redis dependency or dedicated Redis service identified in inspected manifest | M1 target requires Redis |
| Authentication | Partial | PostgreSQL authentication exists in server/middleware/auth.ts and server/services/postgresqlAuth.ts | Needs full end-to-end verification |
| Multi-tenancy | Partial | Canonical organization resolution and mismatch rejection exist | Need exhaustive protected-resource authorization tests |
| RBAC | Partial/Unverified | User role and authorization infrastructure exist | Full permission matrix and property/portfolio scopes are not proven |
| Audit | Partial | Audit types/services/tests exist | Verify immutable behavior across critical mutations |
| Workers | Partial | Durable PostgreSQL jobs exist in server/services/jobService.ts | Redis-backed worker requirement is not established |
| Cache | Partial | cacheService.ts uses in-process Map plus disk persistence | Not equivalent to distributed Redis |
| CI | Partial | ci.yml runs npm ci, lint, build, test | No explicit integration/security stages identified |
| Package management | Conflict | package-lock.json and bun.lock both exist | Establish one authoritative package-manager workflow |
| Infrastructure | Partial | Cloudflare/deployment assets and Dockerfile exist | Reconcile with final staging/production architecture |
| Environment config | Present | .env.example exists | Formal production secret/environment contract needed |
| API health | Present | /api/health checks PostgreSQL | Dedicated readiness contract needs verification |
| Correlation IDs | Unverified | Not established from inspected entrypoint | M1 requirement remains unverified |
| OpenAPI | Unverified | No OpenAPI artifact established in inspected tree | M1 requirement remains unverified |
| Prisma | Missing | Not in package.json and no Prisma path found | Either introduce it or formally approve existing SQL layer |
| Monorepo | Missing | Current app is root-level src/ plus server/ | Requires migration only if mandatory |
| Domain coverage | Partial | Property/CRM/dialer/workflow functionality is substantial | Leasing, facilities, construction, finance, documents, reporting need explicit mapping |
| AI | Partial | Gemini/agent code exists | Authorized tools, RAG/pgvector, references and security evaluation remain unverified |
| Production state | Strong partial | Production-boundary tests and PostgreSQL-authoritative design exist | Verify current CI and deployed environment |

## Existing capabilities to preserve

- PostgreSQL-authoritative persistence.
- PostgreSQL authentication/session design.
- Organization canonicalization.
- Tenant fallback regression tests.
- Frontend tenant-boundary tests.
- Durable PostgreSQL jobs.
- Dialer state-machine and provider-boundary tests.
- Property intelligence and CRM services.
- Cloudflare deployment assets.
- Backup/deployment documentation.
- Existing production-reliability and security plans.

## M0 conclusion

The repository is not a blank foundation and should not be rewritten wholesale.

Current major M1 gaps:
1. Target monorepo structure.
2. Formal Express vs NestJS decision.
3. Formal Prisma vs existing SQL data-access decision.
4. Redis-backed infrastructure.
5. OpenAPI contract.
6. Correlation-ID observability.
7. CI integration/security stages.
8. Single package-manager policy.
9. Explicit staging/production environment contract.

Current major M2 gaps:
1. Full role/permission matrix.
2. Property/portfolio scope model.
3. Exhaustive protected-resource authorization tests.
4. Verification that all domain services derive tenant identity from authenticated context.
5. Verification of immutable/auditable security-sensitive mutations.

## Immediate remediation sequence

### M0-A
Freeze this assessment as the baseline.

### M1-A
Do not migrate frameworks yet. First prove whether the current Express architecture can satisfy the API/domain requirements.

### M1-B
Decide ORM/data-access policy. The current repository already owns SQL migrations and PostgreSQL access; adding Prisma without a concrete need would create a second schema abstraction.

### M1-C
Introduce Redis only after identifying the exact cache/queue responsibilities that cannot safely be served by PostgreSQL jobs.

### M1-D
Expand CI to include integration tests and security scanning.

### M2-A
Complete the authorization matrix and negative-test suite before expanding domain modules.

## Status rule

This assessment distinguishes observed repository evidence from recommendations. An unobserved artifact is Unverified, not proof that no implementation exists.

> CI note: M2 RBAC route coverage is enforced on the contractor execution branch; workflow validation must run against the latest branch head before authorization is considered verified.
