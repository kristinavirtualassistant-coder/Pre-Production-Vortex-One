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
  const url = `${env.VORTEX_ONE_API_URL.replace(/\/$/, '')}/internal/scheduler/property-refresh`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-vortex-scheduler-secret': env.SCHEDULER_TRIGGER_SECRET },
  });
  return new Response(await response.text(), {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  });
}
