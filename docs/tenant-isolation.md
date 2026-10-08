# Tenant isolation

## Model

Every authenticated request resolves identity **only** from the server-side session → `users` row (`req.dbUser`: id,
organization_id, role). Client-supplied `x-user-*` headers are deleted before any handler runs; `x-organization-id`, query and
body organization ids are rejected when they differ from the authenticated organization and then overwritten.

Isolation is enforced at the application layer:

* every tenant table carries `organization_id` and every query filters on it;
* references between records are verified (`server/security/tenantGuards.ts` – `assertOwned`, `assertAllOwned`) before use, and
  foreign ids return `404` (not `403`) so existence is not disclosed;
* machine endpoints (Stripe, scheduler, telephony) authenticate with signatures/secrets and derive the organization from
  server-side records, never from payload fields;
* the HTTP suite `server/test/security/crossTenant.http.test.ts` probes read/write/delete paths with a second tenant under
  `NODE_ENV=production` as a non-superuser role.

## Row-level security: decision

PostgreSQL RLS is **not enabled** in this release (decision recorded with the product owner: application-level enforcement plus
database constraints). `server/db/tenantRls.ts` keeps an explicit `enableTenantRls()` hook, and every request already runs in a
transaction that sets `vortex_one.organization_id` (`TENANT_GUC`). Blockers before enabling:

1. several code paths use `pool.connect()` directly and do not carry the tenant setting;
2. the runtime role must be a non-owner of the tables (policies do not apply to owners without `FORCE`);
3. background workers need an explicit "system" context per organization;
4. policies need load testing (`current_setting` lookups on hot tables).

Until these are done, treat the application-level checks and the cross-tenant tests as the control.
