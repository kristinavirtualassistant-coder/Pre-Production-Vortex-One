import type { Pool } from 'pg';
import { getPgPool } from '../db/db';
import { archiveRingCentralRecording, downloadStoredObject } from '../services/fileStorageService';

export interface FileProcessingJob {
  id: string;
  organization_id: string;
  file_id: string;
  job_type: string;
  status: string;
  attempts: number;
  max_attempts: number;
  result: Record<string, unknown>;
  last_error?: string | null;
  call_id?: string | null;
  recording_url?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
}

export interface FileProcessingWorkerResult {
  processed: number;
  completed: number;
  retried: number;
  failed: number;
}

const DEFAULT_BATCH_SIZE = 10;
const MAX_BACKOFF_SECONDS = 3600;

function retryDelaySeconds(attempts: number): number {
  const safeAttempts = Math.max(1, Math.min(8, Math.floor(attempts)));
  return Math.min(MAX_BACKOFF_SECONDS, 30 * (2 ** (safeAttempts - 1)));
}

export async function claimNextFileProcessingJob(
  pool: Pool,
  workerId: string,
): Promise<FileProcessingJob | null> {
  const result = await pool.query<FileProcessingJob>(`
    WITH candidate AS (
      SELECT id
      FROM file_processing_jobs
      WHERE
        (
          status = 'pending'
          AND available_at <= CURRENT_TIMESTAMP
        )
        OR (
          status = 'processing'
          AND locked_at IS NOT NULL
          AND locked_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        )
      ORDER BY available_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE file_processing_jobs j
    SET
      status = 'processing',
      attempts = attempts + 1,
      locked_at = CURRENT_TIMESTAMP,
      result = COALESCE(j.result, '{}'::jsonb) || jsonb_build_object('worker_id', $1),
      updated_at = CURRENT_TIMESTAMP
    FROM candidate
    WHERE j.id = candidate.id
    RETURNING j.*,
      (
        SELECT fa.entity_id
        FROM file_assets fa
        WHERE fa.id = j.file_id
          AND fa.organization_id = j.organization_id
      ) AS call_id,
      (
        SELECT fa.storage_path
        FROM file_assets fa
        WHERE fa.id = j.file_id AND fa.organization_id = j.organization_id
      ) AS storage_path,
      (
        SELECT fa.mime_type
        FROM file_assets fa
        WHERE fa.id = j.file_id AND fa.organization_id = j.organization_id
      ) AS mime_type,
      (
        SELECT fa.metadata->>'source_url'
        FROM file_assets fa
        WHERE fa.id = j.file_id
          AND fa.organization_id = j.organization_id
      ) AS recording_url
  `, [workerId]);

  return result.rows[0] || null;
}

export async function completeFileProcessingJob(
  pool: Pool,
  job: FileProcessingJob,
  result: Record<string, unknown>,
): Promise<void> {
  await pool.query(
    `UPDATE file_processing_jobs
     SET status='completed',
         locked_at=NULL,
         last_error=NULL,
         result=$3::jsonb,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=$1 AND organization_id=$2 AND status='processing'`,
    [job.id, job.organization_id, JSON.stringify(result)],
  );
}

export async function failFileProcessingJob(
  pool: Pool,
  job: FileProcessingJob,
  error: string,
): Promise<'retrying' | 'failed'> {
  const terminal = job.attempts >= job.max_attempts;
  const delay = retryDelaySeconds(job.attempts);
  const status = terminal ? 'failed' : 'pending';

  await pool.query(
    `UPDATE file_processing_jobs
     SET status=$3,
         available_at=CASE WHEN $4::boolean THEN available_at ELSE CURRENT_TIMESTAMP + ($5 * INTERVAL '1 second') END,
         locked_at=NULL,
         last_error=$6,
         result=COALESCE(result,'{}'::jsonb) || $7::jsonb,
         updated_at=CURRENT_TIMESTAMP
     WHERE id=$1 AND organization_id=$2 AND status='processing'`,
    [
      job.id,
      job.organization_id,
      status,
      terminal,
      delay,
      error.slice(0, 4000),
      JSON.stringify({ last_attempt_at: new Date().toISOString(), retry_delay_seconds: terminal ? 0 : delay }),
    ],
  );

  return terminal ? 'failed' : 'retrying';
}

export async function processFileProcessingJob(pool: Pool, job: FileProcessingJob): Promise<'completed' | 'retrying' | 'failed'> {
  try {
    if (job.job_type === 'recording_archive') {
      const callId = String(job.call_id || '').trim();
      const recordingUrl = String(job.recording_url || '').trim();
      if (!callId || !recordingUrl) return failFileProcessingJob(pool, job, 'Recording archive job is missing call_id or recording_url');
      const archived = await archiveRingCentralRecording({ organizationId: job.organization_id, callId, recordingUrl });
      await completeFileProcessingJob(pool, job, {
        archived_file_id: archived?.id || job.file_id,
        storage_path: archived?.storage_path || null,
        completed_at: new Date().toISOString(),
      });
      return 'completed';
    }

    if (job.job_type === 'document_extract' || job.job_type === 'transcript_extract') {
      const storagePath = String(job.storage_path || '').trim();
      if (!storagePath) return failFileProcessingJob(pool, job, 'Document extraction job is missing storage_path');
      const mime = String(job.mime_type || '').toLowerCase();
      const textMimes = new Set(['text/plain', 'text/csv', 'application/json', 'application/xml', 'text/xml']);
      if (!textMimes.has(mime)) return failFileProcessingJob(pool, job, 'Text extraction is not supported for MIME type: ' + (mime || 'unknown'));
      const downloaded = await downloadStoredObject(storagePath);
      const extractedText = downloaded.body.toString('utf8').replace(/^\uFEFF/, '').trim();
      await pool.query(
        `UPDATE file_assets SET extracted_text=$1, status='ready', updated_at=CURRENT_TIMESTAMP WHERE id=$2 AND organization_id=$3`,
        [extractedText, job.file_id, job.organization_id],
      );
      await completeFileProcessingJob(pool, job, {
        extracted_characters: extractedText.length,
        mime_type: mime,
        completed_at: new Date().toISOString(),
      });
      return 'completed';
    }

    return failFileProcessingJob(pool, job, 'Unsupported file processing job type: ' + job.job_type);
  } catch (error: any) {
    return failFileProcessingJob(pool, job, error?.message || String(error));
  }
}

export async function runFileProcessingWorkerOnce(
  pool: Pool = getPgPool() as Pool,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<FileProcessingWorkerResult> {
  if (!pool) throw new Error('PostgreSQL is required for file processing worker execution');
  const safeBatchSize = Math.max(1, Math.min(100, Math.floor(batchSize)));
  const workerId = `file-processing-${process.pid}-${Date.now()}`;
  const summary: FileProcessingWorkerResult = { processed: 0, completed: 0, retried: 0, failed: 0 };

  for (let i = 0; i < safeBatchSize; i += 1) {
    const job = await claimNextFileProcessingJob(pool, workerId);
    if (!job) break;

    summary.processed += 1;
    const outcome = await processFileProcessingJob(pool, job);
    if (outcome === 'completed') summary.completed += 1;
    else if (outcome === 'retrying') summary.retried += 1;
    else summary.failed += 1;
  }

  return summary;
}

export { retryDelaySeconds };


if (import.meta.url === `file://${process.argv[1]}`) {
  runFileProcessingWorkerOnce()
    .then((result) => {
      console.log(JSON.stringify(result));
      process.exit(0);
    })
    .catch((error) => {
      console.error('[file-processing-worker] failed:', error);
      process.exit(1);
    });
}
