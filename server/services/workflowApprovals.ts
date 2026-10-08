/**
 * Durable approval gates for workflow runs.
 *
 * An `approval` step persists an approvals row whose payload carries the resume point, blocks the step, pauses the run
 * (`paused_approval`) and ends the job. Nothing is held in memory, so the wait survives restarts. Deciding the approval
 * (decideApproval) calls resumeWorkflowAfterApproval inside the same transaction: approve/modify enqueues a resume job,
 * reject fails the run.
 */
import type { PoolClient } from 'pg';
import { enqueueJobWithClient } from './jobService';

export const WORKFLOW_JOB_TYPE = 'workflow.execute';

export interface WorkflowResumePoint {
  scheduleId: string;
  workflowId: string;
  workflowVersionId: string;
  triggerPayload: unknown;
  runId: string;
  stepId: string;
  resumeStepIndex: number;
}

/** Called with the already-updated approval row, inside the decision transaction. */
export async function resumeWorkflowAfterApproval(client: PoolClient, organizationId: string, approval: any): Promise<void> {
  const resume: WorkflowResumePoint | undefined = approval?.payload?.workflowResume;
  if (!resume || !approval.workflow_run_id || resume.runId !== approval.workflow_run_id) return;
  const status = String(approval.status);
  const stepKey = `${resume.runId}:${resume.stepId}`;

  if (status === 'approved' || status === 'modified') {
    const unblocked = await client.query(
      `UPDATE workflow_execution_steps SET status='completed', output=$3::jsonb, completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        WHERE organization_id=$1 AND idempotency_key=$2 AND status='blocked'`,
      [organizationId, stepKey, JSON.stringify({ approved: true, approvalId: approval.id, decidedBy: approval.decided_by, modifications: approval.modifications ?? null })],
    );
    // Only the first decision resumes the run; a repeated decision on the same approval is a no-op.
    if (!unblocked.rowCount) return;
    await client.query(
      `UPDATE workflow_runs SET status='running', updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND organization_id=$2 AND status='paused_approval'`,
      [resume.runId, organizationId],
    );
    await enqueueJobWithClient(client, organizationId, WORKFLOW_JOB_TYPE, {
      scheduleId: resume.scheduleId, workflowId: resume.workflowId, workflowVersionId: resume.workflowVersionId,
      triggerPayload: resume.triggerPayload, runId: resume.runId, resumeStepIndex: resume.resumeStepIndex,
    }, 3);
  } else if (status === 'rejected') {
    await client.query(
      `UPDATE workflow_execution_steps SET status='failed', error='Approval rejected', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
        WHERE organization_id=$1 AND idempotency_key=$2 AND status='blocked'`,
      [organizationId, stepKey],
    );
    await client.query(
      `UPDATE workflow_runs SET status='failed', completed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP, final_summary='Approval rejected'
        WHERE id=$1 AND organization_id=$2 AND status='paused_approval'`,
      [resume.runId, organizationId],
    );
  }
}
