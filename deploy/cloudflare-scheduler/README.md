# Vortex One Cloudflare Scheduler

This Worker is the managed trigger for the Vortex One durable property-refresh worker.

## Runtime configuration

Set these Worker secrets/variables:

- `VORTEX_ONE_API_URL`: the public HTTPS origin of the Vortex One Node/Express API.
- `SCHEDULER_TRIGGER_SECRET`: the same high-entropy secret configured as `SCHEDULER_TRIGGER_SECRET` in the Vortex One API runtime.

The Cron Trigger runs hourly in UTC and calls the API's internal scheduler endpoint. The API drains up to 10 queued/due property-refresh jobs per invocation.

## Deploy

From this directory:

```bash
npx wrangler secret put SCHEDULER_TRIGGER_SECRET
npx wrangler deploy
```

Set `VORTEX_ONE_API_URL` in the Wrangler dashboard or configuration before deployment.

Cloudflare Cron Triggers run the Worker's `scheduled()` handler on the configured cron. See the Cloudflare Workers Cron Trigger documentation for the current platform behavior.
