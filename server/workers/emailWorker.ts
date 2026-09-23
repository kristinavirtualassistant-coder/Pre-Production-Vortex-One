import { getPgPool } from '../db/db';
import { processEmailJob } from '../services/emailWorker';

export async function runEmailWorkerOnce(): Promise<number> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required for email worker execution');
  const configuredOrg = process.env.EMAIL_WORKER_ORGANIZATION_ID?.trim() || undefined;
  const result = { processed: 0 };
  const organizations = configuredOrg
    ? [configuredOrg]
    : (await pool.query<{ organization_id: string }>(`
        SELECT DISTINCT organization_id
        FROM jobs
        WHERE status = 'queued'
          AND available_at <= CURRENT_TIMESTAMP
          AND job_type = 'email_outreach.send'
        ORDER BY organization_id`)).rows.map((row) => row.organization_id);
  for (const organizationId of organizations) {
    for (let i = 0; i < 10; i += 1) {
      const processed = await processEmailJob(pool, organizationId, `email-job-${process.pid}`);
      if (!processed) break;
      result.processed += 1;
    }
  }
  return result.processed;
}
