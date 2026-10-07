import { getPgPool } from './server/db/db';
import { runPropertyRefreshWorkerOnce } from './server/workers/schedulerWorker';
import { runEmailWorkerOnce } from './server/workers/emailWorker';
import { claimDueWorkflowSchedules, runWorkflowWorkerOnce } from './server/services/workflowAutomationService';
import { runFileProcessingWorkerOnce } from './server/workers/fileProcessingWorker';

export async function runFirebaseWorkerTick() {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is required for Firebase worker execution');

  const workflowSchedules = await claimDueWorkflowSchedules(pool);
  const workflowJobs = await runWorkflowWorkerOnce(pool);
  const emailJobs = await runEmailWorkerOnce();

  const fileProcessing = await runFileProcessingWorkerOnce(pool, 10);

  const propertyResults = [];
  for (let i = 0; i < 10; i += 1) {
    const result = await runPropertyRefreshWorkerOnce();
    if (!result.claimed) break;
    propertyResults.push(result);
  }

  return {
    workflowSchedules: workflowSchedules.length,
    workflowJobs,
    emailJobs,
    propertyJobs: propertyResults.length,
    fileProcessing,
  };
}
