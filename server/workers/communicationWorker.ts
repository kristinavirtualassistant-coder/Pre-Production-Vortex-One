import type { Pool } from 'pg';
import { claimNextJob, completeJob, failJob } from '../services/jobService';
import {
  COMMUNICATION_JOB_TYPES,
  runSequenceStep,
  sendEmailNow,
  sendSmsNow,
} from '../services/communicationsService';

/**
 * Claim and process one email, SMS, or sequence job for the organization.
 * Record completion or failure with a retry delay; return false only when no job was claimed.
 */
export async function processCommunicationJob(pool: Pool, organizationId: string, workerId: string): Promise<boolean> {
  const job = await claimNextJob(pool, organizationId, workerId, [
    COMMUNICATION_JOB_TYPES.EMAIL_SEND,
    COMMUNICATION_JOB_TYPES.SMS_SEND,
    COMMUNICATION_JOB_TYPES.SEQUENCE_STEP,
  ]);
  if (!job) return false;
  try {
    const payload = job.payload || {};
    if (job.job_type === COMMUNICATION_JOB_TYPES.EMAIL_SEND) {
      await sendEmailNow(pool, {
        organizationId,
        userId:String(payload.userId || ''),
        provider:payload.provider,
        to:payload.to,
        subject:payload.subject,
        body:payload.body,
        leadId:payload.leadId,
        ownerId:payload.ownerId,
        propertyId:payload.propertyId,
        externalThreadId:payload.externalThreadId,
        inReplyTo:payload.inReplyTo,
        idempotencyKey:payload.idempotencyKey,
      });
    } else if (job.job_type === COMMUNICATION_JOB_TYPES.SMS_SEND) {
      await sendSmsNow(pool, {
        organizationId,
        userId:String(payload.userId || ''),
        to:payload.to,
        body:payload.body,
        from:payload.from,
        leadId:payload.leadId,
        ownerId:payload.ownerId,
        propertyId:payload.propertyId,
        idempotencyKey:payload.idempotencyKey,
      });
    } else {
      await runSequenceStep(pool,organizationId,String(payload.enrollmentId || ''));
    }
    await completeJob(pool,organizationId,job.id,workerId);
    return true;
  } catch (error:any) {
    await failJob(pool,organizationId,job.id,workerId,error?.message || 'Communication job failed',60);
    return true;
  }
}

/**
 * Process at most 25 communication jobs per organization and return the number handled,
 * including jobs whose processing failed.
 */
export async function runCommunicationWorkerOnce(pool: Pool, organizationIds: string[]) {
  let processed=0;
  for (const organizationId of organizationIds) {
    for (let i=0;i<25;i++) {
      const did=await processCommunicationJob(pool,organizationId,'communication-job-' + process.pid);
      if (!did) break;
      processed++;
    }
  }
  return processed;
}
