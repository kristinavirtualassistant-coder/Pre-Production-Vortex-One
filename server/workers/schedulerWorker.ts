import { getPgPool } from '../db/db';
import { UnifiedPropertyDataProvider } from '../services/propertyProviders/PropertyDataProvider';
import { claimDuePropertyRefreshSchedule, claimPropertyRefreshScheduleById, updateScheduleAfterRun } from '../services/propertyRefreshScheduler';
import { claimNextJob, completeJob, failJob, recoverStaleJobs, JOB_TYPES, type JobRecord } from '../services/jobService';

export interface SchedulerWorkerResult {
  claimed: boolean;
  scheduleId?: string;
  organizationId?: string;
  processed?: number;
  updated?: number;
  status?: string;
}

export async function runPropertyRefreshWorkerOnce(): Promise<SchedulerWorkerResult> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required for scheduler worker execution');

  const workerId = `scheduler-${process.pid}`;
  let job: JobRecord | null = null;
  const organizations = await pool.query(`SELECT DISTINCT organization_id FROM jobs WHERE job_type = $1 AND (status = 'queued' OR (status='processing' AND locked_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'))`, [JOB_TYPES.PROPERTY_REFRESH]);
  for (const row of organizations.rows) {
    await recoverStaleJobs(pool, row.organization_id, 300);
    job = await claimNextJob(pool, row.organization_id, workerId, [JOB_TYPES.PROPERTY_REFRESH]);
    if (job) break;
  }

  let schedule;
  if (job) {
    const scheduleId = typeof job.payload?.scheduleId === 'string' ? job.payload.scheduleId : '';
    if (!scheduleId) {
      await failJob(pool, job.organization_id, job.id, workerId, 'Property refresh job missing scheduleId', 60);
      return { claimed: false };
    }
    const due = await pool.query(`SELECT status FROM property_refresh_schedules WHERE id=$1 AND organization_id=$2`, [scheduleId, job.organization_id]);
    if (!due.rows[0] || due.rows[0].status === 'paused') {
      await completeJob(pool, job.organization_id, job.id, workerId);
      return { claimed: false };
    }
    schedule = await claimPropertyRefreshScheduleById(pool, job.organization_id, scheduleId, workerId);
    if (!schedule) {
      await failJob(pool, job.organization_id, job.id, workerId, 'Schedule is currently locked or unavailable', 30);
      return { claimed: false };
    }
  } else {
    schedule = await claimDuePropertyRefreshSchedule(pool, workerId);
    if (!schedule) return { claimed: false };
  }

  const startedAt = Date.now();
  const provider = new UnifiedPropertyDataProvider();
  const errors: string[] = [];
  let processed = 0;
  let updated = 0;
  let valuationDelta = 0;
  let equityDelta = 0;
  let providerUsed = '';

  try {
    const propertyResult = await pool.query(
    `SELECT * FROM properties
     WHERE organization_id = $1
       AND ($2 = 'all'
         OR ($2 = 'selected' AND id = ANY($3::varchar[]))
         OR ($2 = 'high_equity' AND estimated_equity >= 1000000)
         OR ($2 = 'absentee_only' AND is_absentee_owner = true)
         OR ($2 = 'county_filter' AND $4 IS NOT NULL AND county ILIKE '%' || $4 || '%'))
     ORDER BY updated_at DESC NULLS LAST`,
    [schedule.organization_id, schedule.target_selection_mode, schedule.target_property_ids, schedule.county_filter || null],
  );

  for (const row of propertyResult.rows) {
    processed += 1;
    try {
      const result = await provider.refreshProperty(row, schedule.organization_id, schedule.enrichment_options);
      providerUsed = result.providerUsed || providerUsed;
      if (!result.updated) continue;
      await pool.query(
        `UPDATE properties SET
          estimated_value = $1,
          assessed_tax_value = $2,
          estimated_equity = $3,
          is_absentee_owner = $4,
          tax_delinquent = $5,
          latitude = $6,
          longitude = $7,
          provenance = $8::jsonb
         WHERE id = $9 AND organization_id = $10`,
        [
          result.property.estimated_value,
          result.property.assessed_tax_value,
          result.property.estimated_equity,
          result.property.is_absentee_owner,
          result.property.tax_delinquent,
          result.property.latitude ?? null,
          result.property.longitude ?? null,
          JSON.stringify(result.property.provenance),
          row.id,
          schedule.organization_id,
        ],
      );
      updated += 1;
      valuationDelta += result.valuationDelta;
      equityDelta += result.equityDelta;
    } catch (error: any) {
      errors.push(`${row.address || row.apn}: ${error?.message || String(error)}`);
    }
  }

  const now = new Date();
  const nextRun = new Date(now.getTime() + schedule.interval_hours * 60 * 60 * 1000);
  const status = errors.length === 0 ? 'success' : 'warning';
  const summary = `Refreshed ${updated} of ${processed} property parcel${processed === 1 ? '' : 's'}.`;
  const duration = Date.now() - startedAt;
  const logId = `log_sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await pool.query(
    `INSERT INTO property_refresh_logs
      (id, organization_id, schedule_id, executed_at, duration_ms, properties_processed, properties_updated, status, details, valuation_delta, equity_delta, errors)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
    [
      logId, schedule.organization_id, schedule.id, now, duration, processed, updated, status,
      `${summary}${providerUsed ? ` Provider: ${providerUsed}.` : ''}`,
      valuationDelta, equityDelta, JSON.stringify(errors),
    ],
  );

  await updateScheduleAfterRun(pool, schedule.id, schedule.organization_id, {
    status: 'active',
    lastRunAt: now,
    nextRunAt: nextRun,
    lastRunStatus: status,
    lastRunSummary: errors.length ? `${summary} ${errors.length} error(s) recorded.` : summary,
    lastRunRefreshedCount: updated,
  });

  await pool.query(
    `INSERT INTO audit_logs
      (id, organization_id, agent, action, input, output, status, latency_ms, confidence, source, created_at)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11)`,
    [
      `audit_sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      schedule.organization_id,
      'sub_agent_1',
      'BACKGROUND_PROPERTY_REFRESH',
      JSON.stringify({ scheduleId: schedule.id, targetCount: processed, intervalHours: schedule.interval_hours }),
      JSON.stringify({ updatedCount: updated, valuationDelta, equityDelta, errors, logId }),
      status,
      duration,
      errors.length ? 0.85 : 0.98,
      providerUsed || 'Unified Property Data Provider',
      now,
    ],
  );

  if (job) await completeJob(pool, job.organization_id, job.id, workerId);

  return { claimed: true, scheduleId: schedule.id, organizationId: schedule.organization_id, processed, updated, status };
  } catch (error: any) {
    if (job) {
      await failJob(pool, job.organization_id, job.id, workerId, error?.message || String(error), 60);
    }
    throw error;
  }
}
