# Vortex One Owner Portal

An **internal control plane** for the single Vortex One platform operator. It is not a customer feature and has no public
entry point for becoming an owner.

## Security model

```
Visitor              -> no registration, no owner creation          -> 401 / sign-in page
Customer user/admin  -> customer application only                   -> owner API 403, "Access denied" UI
Platform owner       -> /owner portal (MFA-verified session)        -> allowed
```

* **No public path to `platform_owner`.** There is no sign-up, register, invite, promote, "add owner" or owner password-reset
  UI or endpoint. `platform_owner` is **not a value of `users.role`** (a CHECK constraint rejects it) and the role-assignment API
  only accepts `admin | executive | manager | agent | member`.
* **Exactly one owner, provisioned out of band.** The owner is the single row of `platform_owners`:
  * a unique index on a constant expression allows at most one row;
  * a trigger rejects INSERT/UPDATE/DELETE/TRUNCATE unless the session sets `vortex_one.platform_provisioning = 'on'`, which only
    `scripts/provision-platform-owner.ts` does;
  * the runtime database role must have **no write privilege** on the table (see "Database grants" below).
* **Server-side only.** `requirePlatformOwner` runs first on every `/api/owner/*` route, after the shared session
  authentication. It looks the caller up in `platform_owners` (joined to an enabled user in an active organization). It never reads
  a role, owner flag or organization id from the request. Non-owners get a generic `403` and the attempt is audited.
* **MFA.** In production the owner must have MFA enabled **and** the current session must have been MFA-verified. A session
  created before MFA was enabled does not qualify. The owner can deliberately turn this off with
  `OWNER_PORTAL_REQUIRE_MFA=false` (password-only owner sign-in, also accepted by the bootstrap); the server logs a warning
  at startup while it is off. Re-enable by removing the variable or setting it to `true`.
* **No second authentication system.** `/owner/login` calls the existing `/api/auth/login` and `/api/auth/mfa/verify`.
  Sessions are the existing HttpOnly cookie (idle/absolute limits, rotation, revocation, brute-force limits all apply). Nothing is
  stored in browser storage.
* **CSRF.** Cookies are `SameSite=Lax`; additionally every state-changing owner request needs the `X-Vortex-Owner: 1` header and a
  same-origin `Origin`.
* **Responses are `Cache-Control: no-store`**; the `/owner` HTML shell is no-store, `X-Frame-Options: DENY`, `noindex`.
* **Authorization layers** (`server/security/platformAuthorization.ts`): `requireAuthenticatedUser`, `requirePlatformOwner`,
  `requireOrganizationAdmin(param?)`, `requireOrganizationMember(param?)`. The organization is always taken from the session;
  a client-supplied id is only compared against it.

## Separate services (APP_SURFACE)

The same image runs as two services on two hostnames, selected by `APP_SURFACE`:

| `APP_SURFACE` | Hostname | Serves | Absent (404) |
|---|---|---|---|
| `platform` | `app.<domain>` | Customer platform | `/owner`, `/api/owner/*` |
| `owner` | `owner.<domain>` | Owner Portal shell, `POST /api/auth/login`, `/api/auth/mfa/verify`, `/api/auth/logout`, `/api/owner/*`, health probes | Every other `/api` route (sign-up, password reset, customer API, webhooks, billing), `/internal/*`; other pages redirect to `/owner` |
| unset / `combined` | local development and tests | Both | Nothing |

Each hostname gets its own host-only session cookie, so signing in to one never affects the other. The owner service runs no
background timers. An unknown value refuses to start. The gate is `server/security/appSurface.ts`, installed before every
route; tests: `server/test/security/surfaceOwner.http.test.ts`, `surfacePlatform.http.test.ts`.

## Provisioning the owner (operator procedure)

1. The future owner creates a normal account, verifies the email address and enables MFA (account security panel).
2. An operator with administrative database access runs:

   ```bash
   PLATFORM_PROVISIONING_DATABASE_URL='postgresql://ADMIN:***@HOST/DB' \
     npm run owner:provision -- --user-id <users.id>
   ```

   It refuses unverified/disabled users, requires MFA in production, refuses to replace an existing owner unless `--replace`
   is passed (a deliberate transfer), and writes an `owner.provisioned` audit row.
3. The owner signs in at `/owner/login`.

**Alternative when no administrative database connection is reachable (one-time bootstrap):** set
`PLATFORM_OWNER_BOOTSTRAP_EMAIL=<owner email>` in the server's environment and restart. After migrations, the server makes
that account the owner **only if no owner exists yet**, with the same checks (verified, MFA enabled, not disabled) and an
`owner.provisioned` audit row (`via: env-bootstrap`). It never replaces an existing owner, is a no-op on later boots, and a
failure is logged without stopping the server. Remove the variable once the owner exists. It writes through the migration
connection (`SQL_ADMIN_*`, else the runtime user), so it needs a role that may write `platform_owners`.

There is intentionally no UI for any of this.

## Database grants (required)

Run once per environment as the administrative role, naming your runtime role:

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON platform_owners FROM <runtime_role>;
REVOKE UPDATE, DELETE, TRUNCATE ON platform_audit_logs FROM <runtime_role>;
```

The triggers already make the audit log append-only and the owner table provisioning-only even for administrators; the revokes
remove the runtime role's ability to even attempt it (the security test runner applies the same revokes).

## Schema changes (migration 047, idempotent)

| Object | Change |
|---|---|
| `organizations` | + `status` (`active`/`suspended`/`deactivated`, default `active`), `status_reason`, `status_changed_at`, `status_changed_by`; index on status |
| `users` | + indexes on `(organization_id, role)` and `last_login_at` (no columns added; no credentials added anywhere) |
| `platform_owners` | new: `user_id` PK → `users(id)` RESTRICT; singleton unique index; provisioning guard triggers |
| `platform_audit_logs` | new: append-only (UPDATE/DELETE/TRUNCATE blocked by triggers); no foreign keys so the trail outlives users/orgs |
| `platform_support_sessions` | new: owner, organization, reason, `expires_at`, `ended_at` |
| `platform_backup_runs` | new: per-target backup outcomes written by backup jobs |

Existing tables reused instead of duplicated: `users` (+ `users.role`) is the membership model (a user belongs to exactly one
organization), `auth_sessions` for sessions, `organization_billing`/`organization_usage` for plan and usage, `audit_logs` for customer
activity. No second database, no password storage added.

Behavior changes to the existing customer system: a session whose organization is not `active` is rejected on the next request, and
sign-in for such an organization returns `403 ORGANIZATION_NOT_ACTIVE` (only after valid credentials).

## Routes

Pages: `/owner/login`, `/owner`, `/owner/organizations[/:id]`, `/owner/users`, `/owner/usage`, `/owner/audit-logs`,
`/owner/system`, `/owner/backups`, `/owner/settings`.

API (all behind `requirePlatformOwner`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/owner/session` | who am I, MFA state, active support session |
| POST | `/api/owner/session/start` | audit `owner.login` after sign-in |
| GET | `/api/owner/overview` `/usage` `/system` `/backups` `/settings` | dashboard data (real values or explicit zero/empty/"not configured") |
| GET | `/api/owner/audit-logs?action=&result=&orgId=&before=&limit=` | read-only audit trail |
| GET/POST | `/api/owner/organizations` | list/search/filter, create (optional first-admin invitation email) |
| GET | `/api/owner/organizations/:id` `/users` `/usage` `/activity` | detail |
| POST | `/api/owner/organizations/:id/suspend` `/activate` `/deactivate` | lifecycle; deactivate needs the typed name (soft delete) |
| GET | `/api/owner/users?search=&orgId=&active=` · `/users/:id` | read (no secrets) |
| POST/PUT | `/api/owner/users/:id/activate` `/deactivate` `/remove-membership` · `PUT /role` | user management |
| POST/GET | `/api/owner/support/start` `/end` · `/support/:orgId/summary` | support mode |

(Owner endpoints use `orgId`, not `organizationId`, because the shared tenant layer rejects any `organizationId` differing from the
caller's own organization.)

Protections: the owner account and the owner's own organization cannot be suspended/modified from the portal; the last active
administrator of an organization cannot be demoted or deactivated.

## Audit events

`owner.login`, `owner.login_failed`, `owner.access_denied`, `owner.provisioned`, `owner.organization_created|suspended|activated|deactivated`,
`owner.user_role_changed|activated|deactivated|membership_removed`, `owner.support_session_started|ended|expired`,
`owner.support_data_viewed|denied`. Each row: actor id, actor role, action, target type/id, organization id, result, IP, user agent,
details, timestamp. State changes write their audit row in the same transaction as the change. Denials and logins use the raw pool so
they survive request rollback.

Not implemented (no feature exists to audit yet): data export, configuration changes from the portal (settings are read-only),
backup actions from the portal (jobs report; the portal does not trigger backups), security-setting changes.

## Support access

Explicit action, required reason (10+ chars), 5–60 minute window, one active session, one organization. A persistent amber
"SUPPORT MODE" banner with countdown and an **Exit** button shows throughout the portal. Start, data views and end are audited under the
owner's id. It grants read-only summaries through `/api/owner/support/:orgId/summary`; it never impersonates or issues a customer session.

## Backups

The portal reports only rows in `platform_backup_runs`; with no rows a target is shown as **Not configured**. Jobs record outcomes with
`node scripts/record-backup-run.mjs --target postgresql|google_sheets|google_drive --status success|failure [--error ...]`. The
PostgreSQL backup script (`deploy/backup/vortex-one-postgres-backup.sh`) now records its own result when `DATABASE_URL` is set.
**Integration points still to build:** Google Sheets export and Google Drive archive jobs (they must call the recorder). Google Sheets/Drive
are backup destinations only, never authentication or primary storage.

## Settings

Read-only view of backend-supported platform settings, each labelled `implemented`, `unavailable` or `planned`. No environment values
or secrets are shown (credentials appear only as configured / not configured).

## Tests

* `server/test/security/owner.http.test.ts` – authentication, authorization matrix, spoofing, CSRF, MFA, organization and user
  management, suspension enforcement, audit immutability, no public path to owner, support mode, backups, settings (no secrets).
* `server/test/security/ownerPortal.browser.test.ts` – real Chromium: redirects, customer denial, MFA sign-in, refresh persistence,
  no browser storage, create organization, confirmation dialog, expired-session handling. Needs `npm run build`.
* `server/test/ownerPortalSource.test.ts` – structural guards (no sign-up surface, no storage, no owner imports in the customer app).
* Run: `npm run test:security` (needs PostgreSQL and a build) and `npm test`.
