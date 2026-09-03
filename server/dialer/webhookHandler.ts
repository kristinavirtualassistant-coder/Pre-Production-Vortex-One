import { requireOrganizationId } from '../services/organizationContext';
/**
 * Vortex One - Telephony Webhook Ingestion & Idempotency Pipeline
 * Normalizes RingCentral, Twilio, and SIP event streams into authoritative PostgreSQL tables
 */

import { getPgPool, inMemoryStore } from '../db/db';
import { getTelephonyAdapter } from './telephonyAdapter';
import { SuppressionService } from './suppressionService';
import { NormalizedCallEvent } from './types';
import { DialerStateTransitionService } from './dialerStateTransitionService';
import { eventTypeForState } from './callStateMachine';

// In-memory idempotency deduplication cache
const processedEventsCache = new Set<string>();

export interface WebhookProcessResult {
  status: 'processed' | 'duplicate_ignored' | 'error';
  eventId: string;
  telephonyCallId: string;
  eventType: string;
  normalizedEvent?: NormalizedCallEvent;
  error?: string;
}

export function verifyWebhookSecret(headers: Record<string, any> = {}): boolean {
  const configured = process.env.RINGCENTRAL_WEBHOOK_SECRET?.trim();
  if (!configured) return process.env.NODE_ENV === 'test';
  const supplied = String(headers['x-vortex-webhook-secret'] || headers['X-Vortex-Webhook-Secret'] || '');
  return supplied.length > 0 && supplied === configured;
}

export class WebhookHandler {
  private static requireTenant(organizationId: string): string {
    return requireOrganizationId(organizationId);
  }
  /**
   * Ingest and normalize an incoming telephony provider webhook
   */
  public static async processWebhook(
    provider: 'ringcentral' = 'ringcentral',
    organizationId: string,
    rawPayload: any,
    headers?: Record<string, any>
  ): Promise<WebhookProcessResult> {
    try {
      const adapter = getTelephonyAdapter(provider);
      const normalized = adapter.normalizeWebhookPayload(rawPayload, headers);

      const pool = getPgPool();

      // Test/local fallback keeps idempotency semantics when PostgreSQL is unavailable.
      // Production always uses the durable call_event primary key below.
      if (!pool) {
        if (processedEventsCache.has(normalized.eventId)) {
          return {
            status: 'duplicate_ignored',
            eventId: normalized.eventId,
            telephonyCallId: normalized.telephonyCallId,
            eventType: normalized.eventType,
          };
        }
        processedEventsCache.add(normalized.eventId);
      }

      // PostgreSQL is authoritative for production call state. The durable transition
      // service locks the call, validates the provider-neutral FSM transition, writes the
      // event, and updates the call in one transaction. Duplicate provider events are
      // harmless because call_event.id is the durable idempotency key.
      if (pool) {
        const callLookup = await pool.query(
          `SELECT id FROM call WHERE organization_id = $1 AND telephony_call_id = $2 LIMIT 1`,
          [organizationId, normalized.telephonyCallId],
        );
        if (!callLookup.rowCount) {
          throw new Error(`Call not found for organization: ${normalized.telephonyCallId}`);
        }

        const transition = await DialerStateTransitionService.transition(pool, {
          organizationId,
          callId: callLookup.rows[0].id,
          eventId: normalized.eventId,
          eventType: normalized.dialerEventType || eventTypeForState(normalized.dialerState || DialerStateTransitionService.normalizeProviderStatus(normalized.status)),
          nextState: normalized.dialerState || DialerStateTransitionService.normalizeProviderStatus(normalized.status),
          payload: normalized.rawPayload,
          occurredAt: normalized.timestamp,
          disposition: normalized.disposition,
          durationSeconds: normalized.durationSeconds,
          recordingUrl: normalized.recordingUrl,
        });

        if (transition.status === 'duplicate_ignored') {
          return {
            status: 'duplicate_ignored',
            eventId: normalized.eventId,
            telephonyCallId: normalized.telephonyCallId,
            eventType: normalized.eventType,
          };
        }

        await pool.query(
          `INSERT INTO processed_events (event_id, organization_id, provider, event_type, processed_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
           ON CONFLICT (event_id) DO NOTHING`,
          [normalized.eventId, organizationId, provider, normalized.eventType],
        );
      }

      // Update inMemoryStore matching call
      const matchCall = inMemoryStore.calls.find(
        (c) => c.id === normalized.telephonyCallId || (c as any).telephony_call_id === normalized.telephonyCallId
      );
      if (matchCall) {
        matchCall.status = normalized.status as any;
        if (normalized.disposition) matchCall.disposition = normalized.disposition as any;
        if (normalized.durationSeconds) matchCall.duration_seconds = normalized.durationSeconds;
      }

      // Step 4: If disposition is Do-Not-Call, auto-register suppression
      if (normalized.disposition === 'do_not_call' && matchCall?.phone_number) {
        await SuppressionService.addSuppression(
          organizationId,
          matchCall.phone_number,
          'Contact verbally requested Do-Not-Call on live call',
          `webhook_${provider}`
        );
      }

      return {
        status: 'processed',
        eventId: normalized.eventId,
        telephonyCallId: normalized.telephonyCallId,
        eventType: normalized.eventType,
        normalizedEvent: normalized,
      };
    } catch (err: any) {
      console.error('WebhookHandler processing error:', err);
      return {
        status: 'error',
        eventId: rawPayload?.eventId || 'unknown',
        telephonyCallId: rawPayload?.telephonyCallId || 'unknown',
        eventType: rawPayload?.eventType || 'unknown',
        error: err.message,
      };
    }
  }
}
