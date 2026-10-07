# RBAC permission matrix

Source of truth: `server/security/permissionMatrix.ts`. Roles come from the authenticated PostgreSQL user, never from client headers. Enforced by `requirePermission()` / `assertCan()` (`server/security/permissions.ts`) and verified over HTTP by `server/test/security/rbac.http.test.ts`.

| Permission | member | agent | manager | executive | admin | Notes |
|---|---|---|---|---|---|---|
| `system:read` |  |  |  | ✓ | ✓ | db status, cache administration |
| `metrics:read` |  |  | ✓ | ✓ | ✓ | operational metrics |
| `audit:read` |  |  | ✓ | ✓ | ✓ | tenant audit trails |
| `billing:read` |  |  | ✓ | ✓ | ✓ | plan, usage, invoices |
| `billing:manage` |  |  |  | ✓ | ✓ | checkout, portal, cancel |
| `webhooks:read` |  |  | ✓ | ✓ | ✓ | endpoints + deliveries (payloads) |
| `webhooks:manage` |  |  |  | ✓ | ✓ | Data and files |
| `files:read` |  |  | ✓ | ✓ | ✓ | imported data files |
| `calls:read` |  | ✓ | ✓ | ✓ | ✓ | call records and recordings |
| `dial:bulk` |  |  | ✓ | ✓ | ✓ | bulk dialing |
| `suppressions:write` |  |  | ✓ | ✓ | ✓ | DNC / opt-out compliance writes |
| `inbox:sync` |  |  | ✓ | ✓ | ✓ | CRM |

Routes without a permission entry keep their existing `requireRole([...])` guards or are session-only reads scoped to the caller's organization.
