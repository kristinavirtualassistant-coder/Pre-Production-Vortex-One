# Vortex One Free Hosting Deployment

This deployment keeps PostgreSQL authoritative and separates the frontend from the Node API.

## Target architecture

- GitHub `main`: source of truth
- Cloudflare Pages: React/Vite frontend
- Render Free: Node/Express API for development and controlled pilot use
- Neon Free: PostgreSQL database
- Firebase Authentication: existing identity provider
- RingCentral: telephony provider

## 1. Create Neon PostgreSQL

Create a Neon PostgreSQL project and copy its connection string.

Set this value in Render as `DATABASE_URL`. Do not commit it to Git.

The application now accepts `DATABASE_URL` in addition to the existing SQL_* variables.

## 2. Create the Render API

Connect GitHub repository `kristinavirtualassistant-coder/Pre-Production-Vortex-One`.

Render can use the repository's `render.yaml` blueprint. The service is configured to build with `npm ci && npm run build`, start with `npm start`, use `NODE_ENV=production`, disable demo data, disable external webhooks until configured, and use `/api/ready` for health checks.

Add `DATABASE_URL` as a secret environment variable in Render.

Do not use Render Free Postgres for Vortex One's authoritative database; Render documents that its free databases expire after 30 days.

## 3. Verify the API

After the first successful Render deploy, verify `/api/health`, `/api/ready`, PostgreSQL connectivity, migrations, and the absence of demo records. Production must not fall back to in-memory state.

## 4. Cloudflare Pages frontend

Create a Cloudflare Pages project from the same GitHub repository.

Build settings:

- Build command: `npm run build`
- Output directory: `dist`

The frontend currently uses relative `/api/...` requests. After the Render API URL exists, route `/api/*` from the Cloudflare Pages site to the Render API so browser requests remain same-origin.

Do not expose database credentials or RingCentral secrets as `VITE_*` variables. Only browser-safe Firebase and frontend configuration belongs in Cloudflare Pages environment variables.

## 5. Production boundary

The free Render service is a development/controlled-pilot host, not the final dialer host. Render Free services can spin down after 15 minutes of inactivity and restart with approximately one minute of startup latency.

When live RingCentral webhook reliability becomes a requirement, move the API to an always-on compute tier without changing the PostgreSQL-authoritative application architecture.
