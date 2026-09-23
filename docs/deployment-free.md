# Vortex One Free Hosting Deployment

This deployment keeps PostgreSQL authoritative and uses one Node service for the complete web application. Cloudflare provides DNS/custom-domain management; the application remains portable and has no GCP dependency.

## Target architecture

- GitHub `main`: source of truth
- Render Free: Node/Express service serving the Vite frontend and `/api/*` from the same origin
- Neon Free: PostgreSQL database
- Cloudflare: DNS, TLS, and custom domain in front of the Render service
- PostgreSQL: application identity and authentication authority
- RingCentral: optional telephony provider

Keeping the frontend and API on the same origin is intentional. The frontend currently uses relative `/api/...` requests, so no CORS proxy or browser API URL is required.

## 1. Create PostgreSQL

Create a hosted PostgreSQL database and copy its connection string.

Set this value in Render as the secret `DATABASE_URL`. Do not commit it to Git.

The application accepts `DATABASE_URL` in addition to the existing SQL_* variables.

## 2. Deploy the complete application to Render

Connect `kristinavirtualassistant-coder/Pre-Production-Vortex-One` to Render as a Web Service or use the repository `render.yaml` Blueprint.

The blueprint configures:

- Node.js runtime
- Free plan
- `npm ci && npm run build`
- `npm start`
- `/api/ready` health checks
- production mode
- demo data disabled
- external webhooks disabled until explicitly configured
- PostgreSQL and OAuth secrets as deployment-time variables

The Node server serves the compiled `dist` frontend as well as the API, so the deployed application is a single same-origin web app.

## 3. Required production variables

Set these in Render's environment/secrets configuration:

- `DATABASE_URL` — Neon PostgreSQL connection string
- `APP_URL` — final public HTTPS application URL
- `INTEGRATION_ENCRYPTION_KEY` — base64-encoded 32-byte key

For Google Workspace OAuth, also set:

- `GOOGLE_INTEGRATION_CLIENT_ID`
- `GOOGLE_INTEGRATION_CLIENT_SECRET`

For Microsoft 365 OAuth, also set:

- `MICROSOFT_INTEGRATION_CLIENT_ID`
- `MICROSOFT_INTEGRATION_CLIENT_SECRET`

Email outreach additionally requires the SMTP/provider configuration documented by the email service implementation before it can send production mail.

## 4. OAuth callback URLs

Once the final public URL is known, register these exact callbacks with the providers:

- `https://YOUR-DOMAIN/api/integrations/oauth/callback/google-workspace`
- `https://YOUR-DOMAIN/api/integrations/oauth/callback/microsoft-365`

`APP_URL` must use that same public HTTPS origin.

## 5. Verify the deployment

After deployment, verify:

1. `GET /api/health` returns HTTP 200;
2. `GET /api/ready` returns HTTP 200 with PostgreSQL ready;
3. the application loads from the same public origin;
4. sign-up/login works against PostgreSQL;
5. migrations are applied;
6. no demo records were seeded; and
7. OAuth callbacks return to the same public origin.

Production must not fall back to in-memory state.

## 6. Put the custom domain on Cloudflare

Add the domain to Cloudflare and configure the DNS record for the Render service. Keep Cloudflare proxying enabled if desired after the Render custom-domain verification succeeds.

The final application should be accessed through the Cloudflare-managed HTTPS domain, with Render remaining the application origin.

## 7. Production boundary

Free hosting is suitable for development and controlled pilot use, but it is not equivalent to production-grade availability, backup retention, webhook reliability, or sustained dialer capacity. Live RingCentral calling also incurs provider costs.
