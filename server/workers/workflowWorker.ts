import { getPgPool } from '../db/db';
import { claimDueWorkflowSchedules, runWorkflowWorkerOnce } from '../services/workflowAutomationService';

export async function runWorkflowSchedulerOnce() {
  const pool=getPgPool();
  if(!pool) throw new Error('PostgreSQL is required for workflow worker execution');
  const scheduled=await claimDueWorkflowSchedules(pool);
  const processed=await runWorkflowWorkerOnce(pool);
  return {scheduled:scheduled.length,processed};
}
