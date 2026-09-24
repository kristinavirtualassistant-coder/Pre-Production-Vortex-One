interface ScheduledController { cron: string; scheduledTime: number; }
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void; }

interface Env {
  VORTEX_ONE_API_URL: string;
  SCHEDULER_TRIGGER_SECRET: string;
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(triggerScheduler(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    return triggerScheduler(env);
  },
};

async function triggerScheduler(env: Env): Promise<Response> {
  const base = env.VORTEX_ONE_API_URL.replace(/\/$/, '');
  const headers = { 'x-vortex-scheduler-secret': env.SCHEDULER_TRIGGER_SECRET };
  const [propertyResponse, emailResponse] = await Promise.all([
    fetch(`${base}/internal/scheduler/property-refresh`, { method: 'POST', headers }),
    fetch(`${base}/internal/scheduler/email-outreach`, { method: 'POST', headers }),
  ]);
  const propertyBody = await propertyResponse.text();
  const emailBody = await emailResponse.text();
  const status = propertyResponse.ok && emailResponse.ok ? 200 : 502;
  return new Response(JSON.stringify({
    property_refresh: { status: propertyResponse.status, body: propertyBody },
    email_outreach: { status: emailResponse.status, body: emailBody },
  }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
