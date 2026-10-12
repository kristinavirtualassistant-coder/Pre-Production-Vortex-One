import type { Pool } from 'pg';
import { claimNextJob, completeJob, failJob, recoverStaleJobs } from './jobService';
import { EMAIL_JOB_TYPE } from './emailOutreachService';
import { sendEmail } from './emailService';
import { SuppressionService } from '../dialer/suppressionService';

const WORKER_INTERVAL_MS = 1000;
const WORKER_STALE_SECONDS = 300;

export async function processEmailJob(pool: Pool, organizationId: string, workerId = 'email-worker'): Promise<boolean> {
  const job = await claimNextJob(pool, organizationId, workerId, [EMAIL_JOB_TYPE]);
  if (!job) return false;
  if (job.job_type !== EMAIL_JOB_TYPE) {
    await failJob(pool, organizationId, job.id, workerId, `Unsupported job type: ${job.job_type}`, 60);
    return true;
  }

  const outreachId = typeof job.payload?.outreachId === 'string' ? job.payload.outreachId : '';
  if (!outreachId) {
    await failJob(pool, organizationId, job.id, workerId, 'Email job missing outreachId', 60);
    return true;
  }

  try {
    const result = await pool.query(
      `SELECT id, recipient_email, subject, body, status, provider_attempted_at
       FROM email_outreach
       WHERE id = $1 AND organization_id = $2`,
      [outreachId, organizationId],
    );
    if (!result.rowCount) throw new Error('Email outreach record not found');

    const outreach = result.rows[0];
    // Terminal states are never re-sent.
    if (['sent', 'manual_review', 'suppressed', 'failed'].includes(outreach.status)) {
      await completeJob(pool, organizationId, job.id, workerId);
      return true;
    }

    // A previous attempt wrote the pre-send marker and never recorded an outcome (crash/timeout): the provider may
    // already have accepted the message. Sending again could duplicate it, so a human reconciles it instead.
    if (outreach.provider_attempted_at) {
      await pool.query(
        `UPDATE email_outreach SET status = 'manual_review', last_error = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND organization_id = $2`,
        [outreachId, organizationId, 'A previous send attempt has no recorded outcome; verify with the provider before retrying.'],
      );
      await completeJob(pool, organizationId, job.id, workerId);
      return true;
    }

    // Opt-outs are honoured at send time, not only when the email was queued.
    const suppression = await SuppressionService.isEmailSuppressed(organizationId, String(outreach.recipient_email).toLowerCase());
    if (suppression.isSuppressed) {
      await pool.query(
        `UPDATE email_outreach SET status = 'suppressed', last_error = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND organization_id = $2`,
        [outreachId, organizationId, `Recipient suppressed: ${suppression.reason || 'suppressed'}`],
      );
      await completeJob(pool, organizationId, job.id, workerId);
      return true;
    }

    // Pre-send marker, committed BEFORE the provider is contacted.
    await pool.query(
      `UPDATE email_outreach
       SET status = 'processing', attempts = attempts + 1, provider_attempted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND organization_id = $2`,
      [outreachId, organizationId],
    );

    const delivery = await sendEmail({
      to: outreach.recipient_email,
      subject: outreach.subject,
      text: outreach.body,
    });

    await pool.query(
      `UPDATE email_outreach
       SET status = 'sent', provider_message_id = $1, sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
           last_error = NULL
       WHERE id = $2 AND organization_id = $3`,
      [delivery.messageId, outreachId, organizationId],
    );
    await completeJob(pool, organizationId, job.id, workerId);
    return true;
  } catch (error: any) {
    const message = String(error?.message || 'Email delivery failed');
    // Timeouts / dropped sockets are ambiguous (the provider may have accepted the message): never auto-retry those.
    const ambiguous = /ETIMEDOUT|ESOCKET|ECONNRESET|EPIPE/.test(message);
    await pool.query(
      `UPDATE email_outreach
       SET status = CASE WHEN $4 THEN 'manual_review' WHEN attempts >= 3 THEN 'failed' ELSE 'queued' END,
           provider_attempted_at = CASE WHEN $4 THEN provider_attempted_at ELSE NULL END,
           last_error = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND organization_id = $3`,
      [message.slice(0, 2000), outreachId, organizationId, ambiguous],
    );
    if (ambiguous) await completeJob(pool, organizationId, job.id, workerId);
    else await failJob(pool, organizationId, job.id, workerId, message.slice(0, 2000));
    return true;
  }
}

async function listQueuedOrganizations(pool: Pool, configuredOrganizationId?: string): Promise<string[]> {
  if (configuredOrganizationId) return [configuredOrganizationId];

  const result = await pool.query<{ organization_id: string }>(
    `SELECT DISTINCT organization_id
     FROM jobs
     WHERE status = 'queued'
       AND available_at <= CURRENT_TIMESTAMP
       AND job_type = $1
     ORDER BY organization_id`,
    [EMAIL_JOB_TYPE],
  );
  return result.rows.map((row) => row.organization_id);
}

export function startEmailWorker(pool: Pool, configuredOrganizationId?: string): () => void {
  let stopped = false;
  const workerId = `email-worker-${process.pid}`;

  const tick = async () => {
    if (stopped) return;
    try {
      const organizations = await listQueuedOrganizations(pool, configuredOrganizationId);
      for (const organizationId of organizations) {
        await recoverStaleJobs(pool, organizationId, WORKER_STALE_SECONDS);
        for (let i = 0; i < 10; i += 1) {
          const processed = await processEmailJob(pool, organizationId, workerId);
          if (!processed) break;
        }
      }
    } catch (error) {
      console.error('[EmailWorker]', error);
    } finally {
      if (!stopped) setTimeout(tick, WORKER_INTERVAL_MS);
    }
  };

  void tick();
  return () => { stopped = true; };
}
