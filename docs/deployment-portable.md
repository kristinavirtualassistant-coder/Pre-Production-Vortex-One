# Vortex One Portable Deployment Contract

Vortex One is designed to run with standard Node.js and PostgreSQL configuration. GCP services are optional deployment targets during migration and are not required by the application runtime.

## Required runtime configuration

Use either:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

or the standard variables:

```text
SQL_HOST=HOST
SQL_PORT=5432
SQL_DB_NAME=DATABASE
SQL_USER=USER
SQL_PASSWORD=PASSWORD
SQL_SSL=false
```

`DATABASE_URL` may include `sslmode=require`. The application derives the host, port, user, password, database, and SSL requirement from the URL unless explicit SQL_* values override them.

Production startup requires an available PostgreSQL database. The application must not silently fall back to in-memory state in production.

## Local/no-cost mode

Requirements:

- Node.js 22+
- PostgreSQL 14+ (local installation)
- Git

Start the isolated local database and application with:

```bash
./scripts/local-dev.sh
```

The script uses a local PostgreSQL data directory and port 5433 by default. Override them with `VORTEX_LOCAL_PGDATA`, `VORTEX_LOCAL_PGPORT`, and `VORTEX_LOCAL_PGSOCKET` when needed.

The local script enables local development authentication only and does not create cloud resources.

## Container mode

Build and run the portable Node.js container:

```bash
npm ci
npm run build
docker build -t vortex-one:local .
docker run --rm -p 8080:8080 \
  -e NODE_ENV=production \
  -e DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DATABASE' \
  vortex-one:local
```

The container does not require Cloud Run, Cloud SQL, Google Secret Manager, or Google-specific database sockets.

## RingCentral

RingCentral is an external telephony provider. Configure its credentials only through the deployment secret mechanism:

- `RINGCENTRAL_CLIENT_ID`
- `RINGCENTRAL_CLIENT_SECRET`
- `RINGCENTRAL_JWT`
- `RINGCENTRAL_WEBHOOK_VALIDATION_TOKEN`
- `RINGCENTRAL_FROM_NUMBER`
- optional `RINGCENTRAL_SERVER_URL`

Do not expose RingCentral credentials through `VITE_*` variables or store them in PostgreSQL records.

## Database migrations

Application startup applies the repository migrations transactionally. PostgreSQL is authoritative for production state.

Before a production cutover, verify:

1. the target PostgreSQL instance is reachable;
2. all expected migrations are applied;
3. tenant constraints and indexes are present;
4. durable jobs and processed-event idempotency tables are present;
5. critical row counts and hashes match the migration source/target verification plan; and
6. backup and restore have been tested.

## Health checks

- `GET /api/health` verifies the application process is reachable.
- `GET /api/ready` reports readiness only when PostgreSQL is connected and authoritative.

A 503 readiness response is expected when PostgreSQL is unavailable.

## Free-tier-first hosting

A hosted deployment may use a free/low-cost web host and a PostgreSQL provider with a suitable free tier where current provider limits permit it. The application architecture does not depend on a particular vendor.

Free tiers must not be treated as equivalent to production-grade availability, backup retention, webhook reliability, or sustained dialer capacity. Live RingCentral calling also incurs telephony/provider costs even when application hosting is free.

## GCP migration status

Existing GCP resources remain untouched during this portability work. Do not delete Cloud Run, Cloud SQL, Secret Manager, VPC, or related resources until the documented cutover and rollback gates have passed.
