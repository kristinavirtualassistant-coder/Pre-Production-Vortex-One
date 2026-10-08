# Deployment

Single source of truth for running Vortex One in production. Vortex One is a standard Node service plus a worker, backed by
PostgreSQL/PostGIS. No cloud-provider SDK is required at runtime.

## Architecture

```
            ┌──────────────┐        ┌───────────────────────────┐
 browser ──▶│  web (Node)  │───────▶│ PostgreSQL + PostGIS       │
 webhooks ─▶│ Express + SPA│        │ (Supabase or any managed)  │
            └──────┬───────┘        └─────────────▲─────────────┘
                   │ signed URLs                  │ FOR UPDATE SKIP LOCKED
            ┌──────▼───────┐                      │
            │ Object store │◀──────────┐   ┌──────┴───────┐
            │ (Supabase)   │           └───│ worker (Node)│
            └──────────────┘               └──────────────┘
```

* **web** – `node dist/server-runtime.cjs`. Serves the API and the built SPA. Stateless; scale horizontally.
* **worker** – `node dist/worker.cjs` (`npm run worker` in development). Runs scheduled workflows, email/SMS queues, file
  processing, property refresh and session purging. Work is claimed with `FOR UPDATE SKIP LOCKED` leases, so running two
  workers is safe. The HTTP trigger `POST /internal/scheduler/workflows` (header `x-vortex-scheduler-secret`) is an alternative
  for platforms that prefer cron-over-HTTP.
* **database** – PostgreSQL 14+ with PostGIS. Migrations run at startup using the admin role; the runtime role must **not** be
  SUPERUSER or BYPASSRLS (startup refuses otherwise).
* **object storage** – private Supabase Storage bucket (`VORTEX_FILES_BUCKET`), accessed through short-lived signed URLs.

One Docker image (`Dockerfile`) contains both entrypoints.

## Database roles

| Role | Used by | Privileges |
|---|---|---|
| `SQL_ADMIN_USER` | migrations at startup | owns the schema, can `CREATE`/`ALTER` |
| `SQL_USER` | runtime (web + worker) | `SELECT/INSERT/UPDATE/DELETE` on tables, `USAGE` on sequences; no superuser, no bypassrls |

The auth schema (`users`, `auth_sessions`, …) is part of the migration chain (migration 012); the runtime role never runs DDL
in production.

## Required environment variables (names only)

| Variable | Purpose |
|---|---|
| `NODE_ENV=production` | enables production code paths and startup guards |
| `DATABASE_URL` *or* `SQL_HOST/SQL_PORT/SQL_DB_NAME/SQL_USER/SQL_PASSWORD` | runtime database |
| `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD` | migration role |
| `DATABASE_SSL_CA` | provider CA; TLS verification is on by default |
| `AUTH_SESSION_PEPPER` (≥32 chars) | session token hashing |
| `AUTH_ENCRYPTION_KEY` (base64, 32 bytes) | TOTP secret encryption |
| `INTEGRATION_ENCRYPTION_KEY` (base64, 32 bytes) | OAuth token encryption and tracking-link signing |
| `APP_URL` | public origin (links in emails, OAuth redirects) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | billing |
| `SCHEDULER_TRIGGER_SECRET` | machine auth for the scheduler endpoint |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | outbound email |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VORTEX_FILES_BUCKET` | file storage |
| `TRUST_PROXY` | reverse-proxy hop count so rate limits see the real client IP |

Optional: `RINGCENTRAL_*`, `GOOGLE_INTEGRATION_*`, `MICROSOFT_INTEGRATION_*`, AI provider keys, `SESSION_IDLE_HOURS`,
`SESSION_ABSOLUTE_DAYS`, `SIGNUP_ENABLED`, `SIGNUP_ALLOWED_DOMAINS`, `RATE_LIMIT_MULTIPLIER`, `WORKFLOW_WEBHOOK_ALLOWLIST`.
See `.env.example` for the complete list. Never put secrets in `VITE_*` variables.

## Deploy steps

1. Provision PostgreSQL with PostGIS and create the two roles above.
2. Build and push the image: `docker build -t vortex-one .`
3. Start **web** with the production environment and wait for `GET /api/ready` → `200`.
4. Start **worker** from the same image: `docker run … vortex-one node dist/worker.cjs`.
5. Point a reverse proxy/TLS terminator at the web service, set `TRUST_PROXY` to the number of proxy hops.
6. Register the Stripe webhook (`POST /api/billing/webhook`) and the telephony webhooks; configure SMTP.
7. Run the smoke checks below.

Migrations apply automatically at startup (ordered, idempotent, recorded in `schema_migrations`). Roll forward only; take a
database backup first (`deploy/backup/vortex-one-postgres-backup.sh`).

## Smoke checks

* `GET /api/health` → `200`; `GET /api/ready` → `200` with `database: postgresql`.
* Sign up → verification email arrives → sign in; `GET /api/auth/me` returns the user.
* `POST /api/billing/webhook` without a signature → `400`; scheduler endpoint without the secret → `401`.
* A second tenant cannot read the first tenant's data (`npm run test:security` against staging data is not required; the HTTP
  suites run in CI).

## Local development

```bash
npm ci
cp .env.example .env     # fill DATABASE_URL etc.
npm run dev              # web with Vite middleware
npm run worker           # worker (separate terminal)
npm test                 # integrated suite + every standalone test (needs PostgreSQL)
npm run test:security    # HTTP security suites, production mode, least-privileged role
```
