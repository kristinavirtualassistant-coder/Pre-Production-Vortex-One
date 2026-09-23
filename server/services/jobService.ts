import type { Pool } from 'pg';
import { requireOrganizationId } from './organizationContext';

export const JOB_TYPES = {
  EMAIL_OUTREACH: 'email_outreach.send',
  SCHEDULED_CAMPAIGN: 'campaign.scheduled_dispatch',
  PROPERTY_REFRESH: 'property_refresh',
} as const;

export interface JobRecord { id: string; organization_id: string; job_type: string; payload: Record<string, unknown>; status: string; attempts: number; max_attempts: number; }

export async function enqueueJob(pool: Pool, organizationId: string, jobType: string, payload: Record<string, unknown>, maxAttempts = 3): Promise<string> {
  const orgId = requireOrganizationId(organizationId);
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await pool.query(`INSERT INTO jobs (id, organization_id, job_type, payload, max_attempts) VALUES ($1,$2,$3,$4,$5)`, [id, orgId, jobType, JSON.stringify(payload), maxAttempts]);
  return id;
}

export async function claimNextJob(pool: Pool, organizationId: string, workerId: string, allowedJobTypes?: string[]): Promise<JobRecord | null> {
  const orgId = requireOrganizationId(organizationId);
  const typeFilter = allowedJobTypes?.length ? 'AND job_type = ANY($2::varchar[])' : '';
  const values = allowedJobTypes?.length ? [orgId, allowedJobTypes, workerId] : [orgId, workerId];
  const workerParam = allowedJobTypes?.length ? '$3' : '$2';
  const result = await pool.query(`
    WITH candidate AS (
      SELECT id FROM jobs WHERE organization_id = $1 AND status = 'queued' AND available_at <= CURRENT_TIMESTAMP ${typeFilter}
        ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE jobs j SET status = 'processing', attempts = attempts + 1, locked_at = CURRENT_TIMESTAMP, locked_by = ${workerParam}
    FROM candidate WHERE j.id = candidate.id RETURNING j.*`, values);
  return result.rows[0] || null;
}

export async function completeJob(pool: Pool, organizationId: string, jobId: string, workerId: string): Promise<void> {
  const orgId = requireOrganizationId(organizationId);
  await pool.query(`UPDATE jobs SET status='completed', completed_at=CURRENT_TIMESTAMP, locked_at=NULL, locked_by=NULL WHERE id=$1 AND organization_id=$2 AND status='processing' AND locked_by=$3`, [jobId, orgId, workerId]);
}

export async function failJob(pool: Pool, organizationId: string, jobId: string, workerId: string, error: string, retryDelaySeconds = 30): Promise<void> {
  const orgId = requireOrganizationId(organizationId);
  await pool.query(`UPDATE jobs SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END, available_at = CASE WHEN attempts >= max_attempts THEN available_at ELSE CURRENT_TIMESTAMP + ($4 * INTERVAL '1 second') END, locked_at=NULL, locked_by=NULL, last_error=$3 WHERE id=$1 AND organization_id=$2 AND status='processing' AND locked_by=$5`, [jobId, orgId, error, retryDelaySeconds, workerId]);
}

export async function recoverStaleJobs(
  pool: Pool,
  organizationId: string,
  staleAfterSeconds = 300,
): Promise<number> {
  const orgId = requireOrganizationId(organizationId);
  if (!Number.isFinite(staleAfterSeconds) || staleAfterSeconds <= 0) {
    throw new Error('staleAfterSeconds must be greater than zero');
  }
  const result = await pool.query(
    `UPDATE jobs
     SET status = 'queued', available_at = CURRENT_TIMESTAMP, locked_at = NULL, locked_by = NULL,
         last_error = COALESCE(last_error, 'Recovered abandoned processing lease')
     WHERE organization_id = $1
       AND status = 'processing'
       AND locked_at IS NOT NULL
       AND locked_at < CURRENT_TIMESTAMP - ($2 * INTERVAL '1 second')`,
    [orgId, staleAfterSeconds],
  );
  return result.rowCount || 0;
}
