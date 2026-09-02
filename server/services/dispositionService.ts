import type { Pool } from 'pg';
import { requireOrganizationId } from './organizationContext';
import type { CallDisposition } from '../dialer/types';

export interface DispositionInput {
  organizationId: string;
  callId: string;
  disposition: CallDisposition;
  note?: string;
  followUpAt?: string;
  createdBy?: string;
}

const NO_RETRY = new Set<CallDisposition>(['do_not_call', 'wrong_number']);

export async function applyCallDisposition(pool: Pool, input: DispositionInput): Promise<void> {
  const organizationId = requireOrganizationId(input.organizationId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const call = await client.query(
      `SELECT id, lead_id, campaign_id, phone_number FROM call WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
      [input.callId, organizationId],
    );
    if (!call.rows.length) throw new Error('Call not found');
    const row = call.rows[0];
    const terminalStatus = NO_RETRY.has(input.disposition) ? 'completed' : 'completed';
    await client.query(
      `UPDATE call SET status = $1, disposition = $2, notes = COALESCE($3, notes), ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE id = $4 AND organization_id = $5`,
      [terminalStatus, input.disposition, input.note || null, input.callId, organizationId],
    );
    if (row.campaign_id) {
      await client.query(
        `UPDATE campaign_contact SET dial_status = $1 WHERE campaign_id = $2 AND organization_id = $3 AND phone_number = $4`,
        [NO_RETRY.has(input.disposition) ? (input.disposition === 'wrong_number' ? 'failed' : 'suppressed') : 'completed', row.campaign_id, organizationId, row.phone_number],
      );
    }
    if (row.lead_id) {
      const stage = input.disposition === 'interested' || input.disposition === 'transferred' ? 'qualified' : input.disposition === 'call_back_later' ? 'outreach_ready' : undefined;
      if (stage) await client.query(`UPDATE leads SET stage = $1, last_activity_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND organization_id = $3`, [stage, row.lead_id, organizationId]);
      await client.query(
        `INSERT INTO activities (id, organization_id, lead_id, activity_type, title, content, metadata, created_by) VALUES ($1,$2,$3,'call','Call disposition: ' || $4,$5,$6,$7)`,
        [`act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, organizationId, row.lead_id, input.disposition, input.note || '', JSON.stringify({ callId: input.callId, disposition: input.disposition }), input.createdBy || null],
      );
      if (input.followUpAt) {
        await client.query(
          `INSERT INTO tasks (id, organization_id, assigned_agent, objective, input, priority, status, created_at) VALUES ($1,$2,$3,$4,$5,'medium','queued',CURRENT_TIMESTAMP)`,
          [`task_followup_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, organizationId, input.createdBy || 'agent_1', `Follow up after ${input.disposition}`, JSON.stringify({ leadId: row.lead_id, callId: input.callId, scheduledAt: input.followUpAt })],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
