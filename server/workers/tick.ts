import { getPgPool, initializeDatabase } from '../db/db';
import { runPropertyRefreshWorkerOnce } from './schedulerWorker';
import { runEmailWorkerOnce } from './emailWorker';
import { claimDueWorkflowSchedules, runWorkflowWorkerOnce } from '../services/workflowAutomationService';
import { runFileProcessingWorkerOnce } from './fileProcessingWorker';
import { purgeExpiredSessions } from '../security/sessionPolicy';
import { logError } from '../security/logger';

export interface WorkerTickResult {
  workflowSchedules: number;
  workflowJobs: unknown;
  emailJobs: unknown;
  propertyJobs: number;
  fileProcessing: unknown;
  sessionsPurged: number;
}

/**
 * One pass over all background work. Every unit is claimed through PostgreSQL (FOR UPDATE SKIP LOCKED + leases), so
 * several worker processes (or the HTTP scheduler trigger) can run concurrently without double-processing.
 */
export async function runWorkerTick(): Promise<WorkerTickResult> {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required for worker execution');

  const workflowSchedules = await claimDueWorkflowSchedules(pool);
  const workflowJobs = await runWorkflowWorkerOnce(pool);
  const emailJobs = await runEmailWorkerOnce();
  const fileProcessing = await runFileProcessingWorkerOnce(pool, 10);

  let propertyJobs = 0;
  for (let i = 0; i < 10; i += 1) {
    const result = await runPropertyRefreshWorkerOnce();
    if (!result.claimed) break;
    propertyJobs += 1;
  }

  let sessionsPurged = 0;
  try { sessionsPurged = await purgeExpiredSessions(pool); } catch (error) { logError('worker session purge', error); }

  return { workflowSchedules: workflowSchedules.length, workflowJobs, emailJobs, propertyJobs, fileProcessing, sessionsPurged };
}

/** Starts the polling loop; returns a stop function that resolves once the in-flight tick has finished. */
export function startWorkerLoop(intervalMs = Number(process.env.WORKER_INTERVAL_MS) || 5_000): () => Promise<void> {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> = Promise.resolve();

  const schedule = () => { if (!stopped) timer = setTimeout(tick, intervalMs); };
  const tick = () => {
    inFlight = (async () => {
      try {
        const result = await runWorkerTick();
        if (result.workflowSchedules || result.propertyJobs || result.sessionsPurged) console.log('[Worker] tick', JSON.stringify(result));
      } catch (error) {
        logError('worker tick', error);
      } finally {
        schedule();
      }
    })();
  };
  tick();
  return async () => { stopped = true; if (timer) clearTimeout(timer); await inFlight; };
}

export { initializeDatabase };
