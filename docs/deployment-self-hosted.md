# Vortex One Self-Hosted Production Deployment

This is the canonical production architecture for Vortex One.

## Architecture

```
Internet
   |
   v
Cloudflare DNS + HTTPS + Tunnel
   |
   v
cloudflared on VPS
   |
   v
Vortex One Node/Express :8080
   |
   v
PostgreSQL (localhost only)
```

The VPS is the only recurring infrastructure service. PostgreSQL runs on the same machine as Vortex One and is never exposed to the public Internet.

GitHub remains the source of truth. Cloudflare provides the public domain, DNS, TLS edge, and tunnel. The application and database remain under our control.

## Components

- GitHub: source control and CI
- Cloudflare: DNS, public HTTPS, Cloudflare Tunnel
- One VPS: Vortex One + PostgreSQL + backups
- PostgreSQL: authoritative application database
- RingCentral: optional telephony provider
- Google Workspace / Microsoft 365: optional OAuth integrations
- SMTP provider: required only when production email outreach is enabled

Render and Neon are not part of this architecture.

## VPS baseline

Use a current Ubuntu LTS or Debian stable VPS with at least:

- 2 vCPU
- 4 GB RAM
- 40+ GB SSD
- 1 public IPv4 address
- SSH access
- automatic security updates enabled

A larger machine can be selected later without changing the application architecture.

## Network boundary

Only SSH and the Cloudflare Tunnel need network access.

PostgreSQL must listen only on localhost:

`listen_addresses = '127.0.0.1'`

Do not open port 5432 in the VPS firewall.

Vortex One should listen on localhost:

`HOST=127.0.0.1`
`PORT=8080`

Cloudflare Tunnel forwards public HTTPS traffic to the local application.

## Production database

Create:

- database: `vortex_one`
- application role: `vortex_one_app`
- a separate backup role if required by the backup process

Use a strong generated password and store it only in the server environment/secret store.

Example connection:

`postgresql://vortex_one_app:PASSWORD@127.0.0.1:5432/vortex_one`

Do not commit the connection string.

## Application environment

Required production values include:

- `NODE_ENV=production`
- `PORT=8080`
- `DATABASE_URL`
- `APP_URL=https://YOUR-DOMAIN`
- `INTEGRATION_ENCRYPTION_KEY`

OAuth integrations:

- `GOOGLE_INTEGRATION_CLIENT_ID`
- `GOOGLE_INTEGRATION_CLIENT_SECRET`
- `MICROSOFT_INTEGRATION_CLIENT_ID`
- `MICROSOFT_INTEGRATION_CLIENT_SECRET`

Email outreach, when enabled:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_FROM`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `OUTREACH_AGENT_EMAIL`

Other provider credentials are optional and should be enabled only when their corresponding integration is configured.

## Cloudflare Tunnel

Create a Cloudflare Tunnel for the production domain.

Route:

`https://YOUR-DOMAIN`

to:

`http://127.0.0.1:8080`

The tunnel means the VPS does not need to expose application port 8080 publicly.

Keep the tunnel configuration outside Git if it contains credentials.

## OAuth callback URLs

Register these exact URLs with the providers:

- `https://YOUR-DOMAIN/api/integrations/oauth/callback/google-workspace`
- `https://YOUR-DOMAIN/api/integrations/oauth/callback/microsoft-365`

Set `APP_URL` to the same HTTPS origin.

## PostgreSQL migrations

The application verifies PostgreSQL migrations at startup.

After the database is created:

```bash
npm ci
npm run build
npm start
```

Confirm startup reports successful PostgreSQL migration verification.

Never enable a development/in-memory fallback in production.

## systemd

Run Vortex One as a system service so it restarts automatically after a crash or reboot.

The repository includes a service template under `deploy/systemd/`.

Install it only after setting the production path and environment.

## Backups

Back up PostgreSQL independently of application deployments.

Minimum policy:

- daily logical dump
- retain multiple recent copies
- copy backups off the VPS
- periodically test restore into a separate database

A VPS disk failure must not destroy the only copy of the database.

The repository includes a backup script template under `deploy/backup/`.

## Deployment

The intended deployment flow is:

```
git push origin main
        |
        v
GitHub Actions
        |
        v
VPS pulls approved main commit
        |
        v
npm ci
npm run build
        |
        v
systemctl restart vortex-one
        |
        v
GET /api/ready
```

Database migrations run as part of application startup.

Do not deploy by manually editing production source files.

## Verification checklist

After first deployment:

1. `https://YOUR-DOMAIN` loads the application.
2. `/api/health` returns HTTP 200.
3. `/api/ready` reports PostgreSQL ready.
4. PostgreSQL is reachable from the application.
5. PostgreSQL is not reachable from the public Internet.
6. Signup/login works.
7. OAuth callback URLs resolve.
8. No demo data is seeded.
9. Vortex One restarts automatically after reboot.
10. A database backup can be created.
11. A backup can be restored.
12. Cloudflare Tunnel reconnects after restart.

## Production boundary

This architecture removes managed application/database hosting from the stack, but the VPS provider is still infrastructure. Domain registration and external providers such as RingCentral, SMTP, Google, and Microsoft can still have their own costs.

The application remains portable: moving to another VPS requires copying the repository, environment, PostgreSQL backup, and tunnel/domain configuration.
