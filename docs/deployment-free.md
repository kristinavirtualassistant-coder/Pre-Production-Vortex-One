# Vortex One Free Hosting Deployment

This deployment keeps PostgreSQL authoritative and separates the frontend from the Node API.

## Target architecture

- GitHub `main`: source of truth
- Cloudflare Pages: React/Vite frontend
- Render Free: Node/Express API for development and controlled pilot use
- Neon Free: PostgreSQL database
- PostgreSQL sessions: application identity and authentication authority
- RingCentral: telephony provider

## 1. Create PostgreSQL

Create a hosted PostgreSQL database and copy its connection string.

Set this value in the API host as `DATABASE_URL`. Do not commit it to Git.

The application accepts `DATABASE_URL` in addition to the existing SQL_* variables.

## 2. Deploy the API

Connect the repository `kristinavirtualassistant-coder/Pre-Production-Vortex-One` to the API host.

The repository's `render.yaml` blueprint configures the Node API to build with `npm ci && npm run build`, start with `npm start`, use `NODE_ENV=production`, disable demo data, disable external webhooks until configured, and use `/api/ready` for health checks.

Add `DATABASE_URL` as a secret environment variable in the API host.

## 3. Verify the API

After the first successful API deploy, verify `/api/health`, `/api/ready`, PostgreSQL connectivity, migrations, and the absence of demo records. Production must not fall back to in-memory state.

## 4. Frontend

Create the frontend deployment from the same GitHub repository.

Build settings:

- Build command: `npm run build`
- Output directory: `dist`

The frontend currently uses relative `/api/...` requests. After the API URL exists, route `/api/*` from the frontend host to the API so browser requests remain same-origin.

Do not expose database credentials or RingCentral secrets as `VITE_*` variables. Browser configuration must not contain PostgreSQL credentials or authentication secrets.

## 5. Production boundary

Use an always-on API host for live RingCentral webhook and dialer workloads. The application architecture remains portable because PostgreSQL is authoritative and provider-specific deployment configuration is external to the runtime.
