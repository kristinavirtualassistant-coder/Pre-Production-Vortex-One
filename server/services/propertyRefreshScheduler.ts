import type { Pool } from 'pg';
import { requireOrganizationId } from './organizationContext';
import type { PropertyRefreshSchedule } from '../../src/types';

export const PROPERTY_REFRESH_JOB_TYPE = 'property_refresh';

export interface DurablePropertyRefreshSchedule extends PropertyRefreshSchedule {}

export async function listDuePropertyRefreshSchedules(pool: Pool, limit = 10): Promise<DurablePropertyRefreshSchedule[]> {
  const result = await pool.query(`
    SELECT *
    FROM property_refresh_schedules
    WHERE (status = 'active' AND next_run_at <= CURRENT_TIMESTAMP)
       OR (status = 'running' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
    ORDER BY next_run_at ASC
    LIMIT $1`, [limit]);
  return result.rows.map(normalizeSchedule);
}

export async function claimPropertyRefreshScheduleById(pool: Pool, organizationId: string, scheduleId: string, _workerId: string): Promise<DurablePropertyRefreshSchedule | null> {
  const orgId = requireOrganizationId(organizationId);
  const result = await pool.query(
    `UPDATE property_refresh_schedules
     SET status = 'running', updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND organization_id = $2
       AND status = 'active'
     RETURNING *`,
    [scheduleId, orgId],
  );
  return result.rows[0] ? normalizeSchedule(result.rows[0]) : null;
}

export async function claimDuePropertyRefreshSchedule(pool: Pool, _workerId: string): Promise<DurablePropertyRefreshSchedule | null> {
  const result = await pool.query(`
    WITH candidate AS (
      SELECT id
      FROM property_refresh_schedules
      WHERE (status = 'active' AND next_run_at <= CURRENT_TIMESTAMP)
         OR (status = 'running' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
      ORDER BY next_run_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE property_refresh_schedules s
    SET status = 'running', updated_at = CURRENT_TIMESTAMP
    FROM candidate
    WHERE s.id = candidate.id
    RETURNING s.*`, []);
  return result.rows[0] ? normalizeSchedule(result.rows[0]) : null;
}

export async function updateScheduleAfterRun(
  pool: Pool,
  scheduleId: string,
  organizationId: string,
  update: { status: 'active' | 'paused'; lastRunAt: Date; nextRunAt: Date; lastRunStatus: string; lastRunSummary: string; lastRunRefreshedCount: number },
): Promise<void> {
  const orgId = requireOrganizationId(organizationId);
  await pool.query(`
    UPDATE property_refresh_schedules
    SET status = $1,
        last_run_at = $2,
        next_run_at = $3,
        last_run_status = $4,
        last_run_summary = $5,
        last_run_refreshed_count = $6,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $7 AND organization_id = $8`,
    [update.status, update.lastRunAt, update.nextRunAt, update.lastRunStatus, update.lastRunSummary, update.lastRunRefreshedCount, scheduleId, orgId]);
}

function normalizeSchedule(row: any): DurablePropertyRefreshSchedule {
  return {
    ...row,
    target_property_ids: Array.isArray(row.target_property_ids) ? row.target_property_ids : [],
    interval_hours: Number(row.interval_hours || 24),
    enrichment_options: row.enrichment_options || {},
  } as DurablePropertyRefreshSchedule;
}
