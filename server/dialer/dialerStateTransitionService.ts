import { Pool, PoolClient } from 'pg';
import { DialerCallEventType, DialerCallState, DialerCallStateMachine } from './callStateMachine';
import { CallDisposition } from './types';

export interface StateTransitionInput {
  organizationId: string;
  callId: string;
  eventId: string;
  eventType: DialerCallEventType;
  nextState: DialerCallState;
  payload: Record<string, any>;
  occurredAt: string;
  disposition?: CallDisposition;
  durationSeconds?: number;
  recordingUrl?: string;
}

export interface StateTransitionResult {
  status: 'transitioned' | 'duplicate_ignored';
  callId: string;
  previousState?: DialerCallState;
  currentState?: DialerCallState;
  eventId: string;
}

const dbToState: Record<string, DialerCallState> = {
  queued: 'QUEUED',
  initiated: 'DIALING',
  ringing: 'RINGING',
  'in-progress': 'IN_CALL',
  connected: 'CONNECTED',
  completed: 'COMPLETED',
  busy: 'BUSY',
  'no-answer': 'NO_ANSWER',
  voicemail: 'VOICEMAIL',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
};

const stateToDb: Record<DialerCallState, string> = {
  QUEUED: 'queued',
  DIALING: 'initiated',
  RINGING: 'ringing',
  HUMAN: 'connected',
  CONNECTED: 'connected',
  IN_CALL: 'in-progress',
  WRAP_UP: 'connected',
  DISPOSITIONED: 'connected',
  COMPLETED: 'completed',
  VOICEMAIL: 'voicemail',
  NO_ANSWER: 'no-answer',
  BUSY: 'busy',
  DISCONNECTED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export class DialerStateTransitionService {
  public static normalizeProviderStatus(status: string): DialerCallState {
    switch (status.toLowerCase()) {
      case 'setup':
      case 'initiated':
      case 'dialing': return 'DIALING';
      case 'proceeding':
      case 'ringing': return 'RINGING';
      case 'answered':
      case 'in-progress':
      case 'in_progress':
      case 'connected': return 'IN_CALL';
      case 'busy': return 'BUSY';
      case 'noanswer':
      case 'no-answer':
      case 'no_answer': return 'NO_ANSWER';
      case 'voicemail': return 'VOICEMAIL';
      case 'disconnected': return 'DISCONNECTED';
      case 'completed': return 'COMPLETED';
      case 'cancelled':
      case 'canceled': return 'CANCELLED';
      case 'failed': return 'FAILED';
      default: return 'FAILED';
    }
  }

  public static buildTransitionSql(input: StateTransitionInput): { text: string; values: any[] } {
    const dbStatus = stateToDb[input.nextState];
    const terminal = ['COMPLETED', 'VOICEMAIL', 'NO_ANSWER', 'BUSY', 'DISCONNECTED', 'FAILED', 'CANCELLED'].includes(input.nextState);
    return {
      text: `WITH locked_call AS (\n` +
        `  SELECT id, organization_id, status FROM call WHERE id = $1 AND organization_id = $2 FOR UPDATE\n` +
        `), inserted_event AS (\n` +
        `  INSERT INTO call_event (id, organization_id, call_id, event_type, payload, occurred_at)\n` +
        `  SELECT $3, organization_id, id, $4, $5::jsonb, $6 FROM locked_call\n` +
        `  ON CONFLICT (id) DO NOTHING\n` +
        `  RETURNING call_id\n` +
        `)\n` +
        `UPDATE call SET status = $7, disposition = COALESCE($8, disposition), duration_seconds = CASE WHEN $9 > 0 THEN $9 ELSE duration_seconds END, recording_url = COALESCE($10, recording_url), ended_at = CASE WHEN $11 THEN COALESCE(ended_at, $6::timestamptz) ELSE ended_at END\n` +
        `WHERE id = $1 AND organization_id = $2 AND EXISTS (SELECT 1 FROM inserted_event)\n` +
        `RETURNING id, status`,
      values: [input.callId, input.organizationId, input.eventId, input.eventType, JSON.stringify(input.payload), input.occurredAt, dbStatus, input.disposition || null, input.durationSeconds || 0, input.recordingUrl || null, terminal],
    };
  }

  public static async transition(pool: Pool, input: StateTransitionInput): Promise<StateTransitionResult> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const duplicate = await client.query(
        'SELECT 1 FROM call_event WHERE id = $1 AND organization_id = $2 LIMIT 1',
        [input.eventId, input.organizationId],
      );
      if (duplicate.rowCount) {
        await client.query('ROLLBACK');
        return { status: 'duplicate_ignored', callId: input.callId, eventId: input.eventId };
      }

      const call = await client.query(
        'SELECT id, status FROM call WHERE id = $1 AND organization_id = $2 FOR UPDATE',
        [input.callId, input.organizationId],
      );
      if (!call.rowCount) throw new Error('Call not found for organization');

      const previousState = dbToState[call.rows[0].status];
      if (!previousState) throw new Error(`Unsupported persisted call status: ${call.rows[0].status}`);

      const machine = new DialerCallStateMachine(previousState);
      if (!machine.canTransition(input.nextState)) {
        throw new Error(`Invalid call transition ${previousState} -> ${input.nextState}`);
      }

      await client.query(
        `INSERT INTO call_event (id, organization_id, call_id, event_type, payload, occurred_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [input.eventId, input.organizationId, input.callId, input.eventType, JSON.stringify(input.payload), input.occurredAt],
      );

      await client.query(
        `UPDATE call
         SET status = $1,
             disposition = COALESCE($2, disposition),
             duration_seconds = CASE WHEN $3 > 0 THEN $3 ELSE duration_seconds END,
             recording_url = COALESCE($4, recording_url),
             ended_at = CASE WHEN $5 THEN COALESCE(ended_at, $6) ELSE ended_at END
         WHERE id = $7 AND organization_id = $8`,
        [stateToDb[input.nextState], input.disposition || null, input.durationSeconds || 0, input.recordingUrl || null,
          ['COMPLETED', 'VOICEMAIL', 'NO_ANSWER', 'BUSY', 'DISCONNECTED', 'FAILED', 'CANCELLED'].includes(input.nextState), input.occurredAt,
          input.callId, input.organizationId],
      );

      await client.query('COMMIT');
      return { status: 'transitioned', callId: input.callId, previousState, currentState: input.nextState, eventId: input.eventId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
