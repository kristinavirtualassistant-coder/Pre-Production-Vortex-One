# Vortex One Production Infrastructure

## Authoritative architecture

GitHub main → Firebase Hosting → React/Vite frontend

Firebase Hosting rewrites `/api/**` to Firebase Cloud Functions (2nd gen, Express). The Functions runtime connects to Supabase PostgreSQL/PostGIS, which is the authoritative application database.

## External integrations

- Phone: RingCentral / approved telephony provider
- Email: configured email provider
- SMS: RingCentral / approved SMS provider
- AI: Gemini/OpenAI/other approved provider
- GIS: GIS Cloud and public GIS sources
- Public records: county/public APIs
- Analytics: PostHog

## Removed deployment paths

- Vercel
- Cloudflare Workers / Containers / Scheduler
- Self-hosted VPS/systemd deployment
- GCP Cloud Run/Cloud SQL deployment
- Firebase Authentication as the application identity source
- Firestore as the application persistence source

Firebase is the runtime/edge platform, not the application database or identity system. PostgreSQL remains authoritative for users, sessions, organizations, and application data.

## Runtime

- Node.js 22
- Firebase Cloud Functions 2nd gen
- Firebase Hosting
- Supabase PostgreSQL/PostGIS
- Express API
- Vite/React frontend

## Background jobs

One Firebase scheduled function, `workerTick`, runs every minute with `maxInstances: 1`. It processes due workflow schedules, workflow jobs, email outreach jobs, and property refresh jobs. Durable job state remains in PostgreSQL; Firebase Scheduler is only the trigger.

## Secrets

Production credentials must not be committed to GitHub. The runtime uses one JSON secret named `VORTEX_ONE_RUNTIME_CONFIG`, stored in Firebase Secret Manager. It can contain DATABASE_URL, SQL_* credentials, AUTH_SESSION_PEPPER, integration credentials, telephony credentials, AI credentials, and analytics credentials actually used by the enabled services.

Set it with:

    firebase functions:secrets:set VORTEX_ONE_RUNTIME_CONFIG

## Deployment

Local:

    npm ci
    npm run build:firebase
    firebase emulators:start

Production:

    firebase use vortex-one-propflow
    firebase deploy --only functions,hosting

CI uses Application Default Credentials/service-account credentials rather than the legacy FIREBASE_TOKEN flow.

## Production gate

- Firebase Hosting deploy succeeds.
- `/api/health` reports PostgreSQL healthy.
- Authenticated API requests reach Supabase.
- Supabase tenant isolation/RLS tests pass.
- `workerTick` can claim and complete a test job.
- No Vercel, Cloudflare, or self-hosted deployment workflow remains active.
- Production secrets exist only in Firebase Secret Manager.
- GitHub Actions is the source-controlled deployment trigger.
