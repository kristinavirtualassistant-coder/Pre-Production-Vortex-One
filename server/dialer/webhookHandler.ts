/**
 * Vortex One - Telephony Webhook Ingestion & Idempotency Pipeline
 * Normalizes RingCentral, Twilio, and SIP event streams into authoritative PostgreSQL tables
 */

import { getPgPool, inMemoryStore } from '../db/db';
import { getTelephonyAdapter } from './telephonyAdapter';
import { SuppressionService } from './suppressionService';
import { NormalizedCallEvent } from './types';

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

export class WebhookHandler {
  /**
   * Ingest and normalize an incoming telephony provider webhook
   */
  public static async processWebhook(
    provider: 'ringcentral' = 'ringcentral',
    organizationId: string = 'org_cmc_realty',
    rawPayload: any,
    headers?: Record<string, any>
  ): Promise<WebhookProcessResult> {
    try {
      const adapter = getTelephonyAdapter(provider);
      const normalized = adapter.normalizeWebhookPayload(rawPayload, headers);

      const pool = getPgPool();

      // Step 1: Idempotency Check via processed_events table
      if (pool) {
        try {
          const insertRes = await pool.query(
            `INSERT INTO processed_events (event_id, organization_id, provider, event_type, processed_at)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             ON CONFLICT (event_id) DO NOTHING`,
            [normalized.eventId, organizationId, provider, normalized.eventType]
          );

          // If rowCount is 0, this event was already processed
          if (insertRes.rowCount === 0) {
            return {
              status: 'duplicate_ignored',
              eventId: normalized.eventId,
              telephonyCallId: normalized.telephonyCallId,
              eventType: normalized.eventType,
            };
          }
        } catch (err: any) {
          console.warn('PostgreSQL idempotency check warning:', err.message);
        }
      } else {
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

      // Step 2: Record Call Event into call_event table
      const callEventId = `cevt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      if (pool) {
        try {
          await pool.query(
            `INSERT INTO call_event (id, organization_id, call_id, event_type, payload, occurred_at)
             VALUES ($1, $2, (
               SELECT id FROM call WHERE telephony_call_id = $3 OR id = $3 LIMIT 1
             ), $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [
              callEventId,
              organizationId,
              normalized.telephonyCallId,
              normalized.eventType,
              JSON.stringify(normalized.rawPayload),
              normalized.timestamp,
            ]
          );

          // Step 3: Update Call table status, duration, and recording
          await pool.query(
            `UPDATE call 
             SET status = $1, 
                 disposition = COALESCE($2, disposition),
                 duration_seconds = CASE WHEN $3 > 0 THEN $3 ELSE duration_seconds END,
                 recording_url = COALESCE($4, recording_url),
                 ended_at = CASE WHEN $1 IN ('completed', 'failed', 'busy', 'no-answer', 'voicemail') THEN CURRENT_TIMESTAMP ELSE ended_at END
             WHERE telephony_call_id = $5 OR id = $5`,
            [
              normalized.status,
              normalized.disposition || null,
              normalized.durationSeconds || 0,
              normalized.recordingUrl || null,
              normalized.telephonyCallId,
            ]
          );
        } catch (err: any) {
          console.warn('PostgreSQL call event update warning:', err.message);
        }
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
