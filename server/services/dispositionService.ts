import type { Pool } from 'pg';
import { requireOrganizationId } from './organizationContext';
import type { CallDisposition } from '../dialer/types';
import { normalizePhoneNumber } from '../dialer/suppressionService';

export interface DispositionInput {
  organizationId: string;
  callId: string;
  disposition: CallDisposition;
  note?: string;
  followUpAt?: string;
  createdBy?: string;
}

export interface DispositionResult {
  status: 'applied' | 'duplicate_ignored';
  callId: string;
  disposition: CallDisposition;
  followUpTaskId?: string;
}

const VALID_DISPOSITIONS = new Set<CallDisposition>([
  'interested', 'not_interested', 'call_back_later', 'wrong_number',
  'do_not_call', 'left_voicemail', 'no_answer', 'busy', 'gatekeeper_block', 'transferred',
]);

const NO_RETRY = new Set<CallDisposition>(['do_not_call', 'wrong_number']);

function validateFollowUp(input: DispositionInput): void {
  if (input.disposition === 'call_back_later' && !input.followUpAt) {
    throw new Error('followUpAt is required for call_back_later');
  }
  if (input.followUpAt && !Number.isFinite(Date.parse(input.followUpAt))) {
    throw new Error('followUpAt must be a valid timestamp');
  }
}

export async function applyCallDisposition(pool: Pool, input: DispositionInput): Promise<DispositionResult> {
  const organizationId = requireOrganizationId(input.organizationId);
  if (!VALID_DISPOSITIONS.has(input.disposition)) throw new Error(`Invalid call disposition: ${input.disposition}`);
  validateFollowUp(input);

  const client = await pool.connect();
  const dispositionEventId = `disposition:${input.callId}`;
  let followUpTaskId: string | undefined;

  try {
    await client.query('BEGIN');

    const call = await client.query(
      `SELECT c.id, c.lead_id, c.campaign_id, c.phone_number, l.assigned_agent
       FROM call c
       LEFT JOIN leads l ON l.id = c.lead_id AND l.organization_id = c.organization_id
       WHERE c.id = $1 AND c.organization_id = $2
       FOR UPDATE`,
      [input.callId, organizationId],
    );
    if (!call.rows.length) throw new Error('Call not found');
    const row = call.rows[0];

    const existingEvent = await client.query(
      `SELECT 1 FROM call_event WHERE id = $1 AND organization_id = $2 LIMIT 1`,
      [dispositionEventId, organizationId],
    );
    if (existingEvent.rowCount) {
      await client.query('ROLLBACK');
      return { status: 'duplicate_ignored', callId: input.callId, disposition: input.disposition };
    }

    await client.query(
      `INSERT INTO call_event (id, organization_id, call_id, event_type, payload, occurred_at)
       VALUES ($1, $2, $3, 'disposition.applied', $4::jsonb, CURRENT_TIMESTAMP)`,
      [dispositionEventId, organizationId, input.callId, JSON.stringify({
        disposition: input.disposition,
        note: input.note || null,
        followUpAt: input.followUpAt || null,
        createdBy: input.createdBy || null,
      })],
    );

    await client.query(
      `UPDATE call
       SET status = 'completed', disposition = $1, notes = COALESCE($2, notes), ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
       WHERE id = $3 AND organization_id = $4`,
      [input.disposition, input.note || null, input.callId, organizationId],
    );

    if (row.campaign_id) {
      const campaignDialStatus = NO_RETRY.has(input.disposition)
        ? (input.disposition === 'do_not_call' ? 'suppressed' : 'failed')
        : 'completed';
      await client.query(
        `UPDATE campaign_contact
         SET dial_status = $1
         WHERE campaign_id = $2 AND organization_id = $3
           AND regexp_replace(phone_number, '\\D', '', 'g') = regexp_replace($4, '\\D', '', 'g')`,
        [campaignDialStatus, row.campaign_id, organizationId, row.phone_number],
      );
    }

    if (input.disposition === 'do_not_call') {
      const normalizedPhone = normalizePhoneNumber(row.phone_number);
      if (normalizedPhone) {
        await client.query(
          `INSERT INTO suppression_record (id, organization_id, phone_number, reason, source, suppressed_at)
           VALUES ($1, $2, $3, 'Requested DNC', 'call_disposition', CURRENT_TIMESTAMP)
           ON CONFLICT (organization_id, phone_number)
           DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source, suppressed_at = EXCLUDED.suppressed_at`,
          [`suppression:disposition:${input.callId}`, organizationId, normalizedPhone],
        );
      }
    }

    if (row.lead_id) {
      const leadStage = input.disposition === 'interested' || input.disposition === 'transferred'
        ? 'qualified'
        : input.disposition === 'call_back_later'
          ? 'outreach_ready'
          : undefined;
      const nextAction = input.followUpAt
        ? `follow_up_at:${new Date(input.followUpAt).toISOString()}`
        : input.disposition === 'do_not_call'
          ? 'do_not_contact'
          : undefined;
      const dncUpdate = input.disposition === 'do_not_call' ? ', dnc_compliant = FALSE' : '';
      if (leadStage || nextAction || input.disposition === 'do_not_call') {
        await client.query(
          `UPDATE leads
           SET stage = COALESCE($1, stage),
               next_recommended_action = COALESCE($2, next_recommended_action),
               last_activity_date = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP${dncUpdate}
           WHERE id = $3 AND organization_id = $4`,
          [leadStage || null, nextAction || null, row.lead_id, organizationId],
        );
      }

      await client.query(
        `INSERT INTO activities (id, organization_id, lead_id, activity_type, title, content, metadata, created_by)
         VALUES ($1, $2, $3, 'call', $4, $5, $6::jsonb, $7)`,
        [
          `activity:disposition:${input.callId}`,
          organizationId,
          row.lead_id,
          `Call disposition: ${input.disposition}`,
          input.note || '',
          JSON.stringify({ callId: input.callId, disposition: input.disposition, followUpAt: input.followUpAt || null }),
          input.createdBy || row.assigned_agent || null,
        ],
      );

      if (input.followUpAt) {
        followUpTaskId = `task:followup:${input.callId}`;
        await client.query(
          `INSERT INTO tasks (id, organization_id, assigned_agent, objective, input, priority, status, created_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, 'medium', 'queued', CURRENT_TIMESTAMP)
           ON CONFLICT (id) DO NOTHING`,
          [
            followUpTaskId,
            organizationId,
            input.createdBy || row.assigned_agent,
            `Follow up after ${input.disposition}`,
            JSON.stringify({ leadId: row.lead_id, callId: input.callId, scheduledAt: new Date(input.followUpAt).toISOString() }),
          ],
        );
      }
    }

    await client.query('COMMIT');
    return { status: 'applied', callId: input.callId, disposition: input.disposition, followUpTaskId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
