# Production readiness checklist

Status legend: ✅ done and covered by an automated test · 🟡 done, needs a human to verify in the real environment · ⛔ not done.

| Area | Status | Evidence |
|---|---|---|
| Stripe webhook authenticated by signature only; scheduler by secret only; telephony by provider token | ✅ | `server/test/security/webhookScheduler.http.test.ts` |
| Client-supplied identity/role/org never authoritative | ✅ | `identityHeaders.http.test.ts` |
| Cross-tenant read/write/execute probes | ✅ | `crossTenant.http.test.ts` |
| RBAC permission matrix | ✅ | `docs/rbac-matrix.md`, `rbac.http.test.ts` |
| SSRF guard (DNS pinning, no redirects, size/time caps) | ✅ | `server/test/ssrfGuard.test.ts` |
| Shared-store rate limiting, Redis-swappable | ✅ | `rateLimitAndBodies.http.test.ts` |
| Per-route body limits, safe JSON errors | ✅ | `rateLimitAndBodies.http.test.ts` |
| Sessions: idle/absolute lifetime, rotation, revoke | ✅ | `sessions.http.test.ts` |
| Sign-up abuse controls, anti-enumeration, TOTP replay | ✅ | `authAbuse.http.test.ts` |
| Integration OAuth with browser-bound state | ✅ (callback exchange 🟡) | `integrationOAuth.http.test.ts` |
| Durable workflows: restart, approval resume, retries, leases | ✅ | `workflowDurability.test.ts` |
| Email pipeline with mock transport, no duplicates | ✅ (real SMTP 🟡) | `emailPipeline.test.ts` |
| Single worker process | ✅ | `workerTick.test.ts` |
| PostgreSQL CI job, security job, audit | ✅ | `.github/workflows/ci.yml` |
| Production bundle boots as non-superuser role | ✅ | verified manually (`/api/ready` 200) |
| Row-level security | ⛔ (decision) | `docs/tenant-isolation.md` |
| Real Stripe / SMTP / RingCentral / Google / Microsoft credentials exercised | 🟡 | needs a staging environment |
| Database TLS with provider CA (`DATABASE_SSL_CA`) | 🟡 | verification is now on by default |
| Backups and restore drill | 🟡 | `deploy/backup/` script exists, not exercised |
| Legacy `/api/workflows/execute` agent chain is synchronous (not crash-resumable) | ⛔ | scheduled/versioned workflows are durable; see report |

See `docs/deployment.md` for deployment steps and the environment variable list.
