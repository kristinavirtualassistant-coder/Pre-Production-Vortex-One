# Vortex One Self-Hosted Deployment

The canonical Vortex One deployment is self-hosted: one VPS runs the Node/Express application and PostgreSQL. Cloudflare provides the public domain, DNS, HTTPS edge, and optional Tunnel.

## Architecture

```
Internet
  -> Cloudflare
  -> Cloudflare Tunnel
  -> Vortex One Node/Express :8080
  -> PostgreSQL on localhost
```

Render and Neon are not required. GCP is not part of the architecture.

## Infrastructure

- GitHub: source control and CI
- Cloudflare: domain, DNS, HTTPS, optional Tunnel
- One VPS: Vortex One, PostgreSQL, backups
- PostgreSQL: authoritative application database
- Optional providers: RingCentral, SMTP, Google Workspace, Microsoft 365

See [deployment-self-hosted.md](./deployment-self-hosted.md) for the complete production procedure.

## Cost/control model

The VPS is the only recurring infrastructure service required for the application and database. The domain and optional external providers remain separate costs.

PostgreSQL is private and should not be exposed to the public Internet. Vortex One listens on localhost and Cloudflare provides the public edge.

## Development

Local development continues to use PostgreSQL on the existing local port and the normal Vite/Node workflow. Development infrastructure is separate from production infrastructure.

## Production requirements

Before go-live, provision a VPS, configure PostgreSQL, install Node.js, configure Cloudflare Tunnel, set production secrets, run migrations, enable the systemd service, and verify `/api/health` and `/api/ready`.
