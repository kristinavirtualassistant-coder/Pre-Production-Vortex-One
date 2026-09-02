/**
 * Vortex One - Campaign Lifecycle & Dialing Session Engine
 * Manages predictive & preview campaigns, contact queues, and automated DNC checks
 */

import { getPgPool, inMemoryStore } from '../db/db';
import {
  CampaignRecord,
  CampaignContactRecord,
  DialingSessionRecord,
  CallTableRecord,
  CallEventRecord,
} from './types';
import { SuppressionService } from './suppressionService';
import { getTelephonyAdapter } from './telephonyAdapter';
import { requireOrganizationId } from '../services/organizationContext';

export class CampaignManager {
  /**
   * Create a new outbound calling campaign
   */
  public static async createCampaign(params: {
    organizationId: string;
    name: string;
    description?: string;
    targetMarket?: string;
    telephonyProvider?: 'ringcentral';
    totalContacts?: number;
    scheduledAt?: string;
    scheduledBy?: string;
    timezone?: string;
  }): Promise<CampaignRecord> {
    const id = `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const isScheduled = Boolean(params.scheduledAt);

    const campaign: CampaignRecord = {
      id,
      organization_id: params.organizationId,
      name: params.name,
      description: params.description || '',
      status: isScheduled ? 'scheduled' : 'draft',
      target_market: params.targetMarket || 'Orange County, CA',
      telephony_provider: 'ringcentral',
      total_contacts: params.totalContacts || 0,
      dialed_count: 0,
      connected_count: 0,
      converted_count: 0,
      scheduled_at: params.scheduledAt,
      scheduled_by: params.scheduledBy || 'Operations Lead',
      timezone: params.timezone || 'America/Los_Angeles',
      concurrency_limit: 3,
      retry_limit: 3,
      calling_hours_start: '08:00',
      calling_hours_end: '20:00',
      created_at: now,
      updated_at: now,
    };

    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO campaign (id, organization_id, name, description, status, target_market, telephony_provider, total_contacts, dialed_count, connected_count, converted_count, concurrency_limit, retry_limit, calling_hours_start, calling_hours_end, timezone, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
          [
            id,
            campaign.organization_id,
            campaign.name,
            campaign.description,
            campaign.status,
            campaign.target_market,
            campaign.telephony_provider,
            campaign.total_contacts,
            0,
            0,
            0,
            campaign.concurrency_limit,
            campaign.retry_limit,
            campaign.calling_hours_start,
            campaign.calling_hours_end,
            campaign.timezone,
            now,
            now,
          ]
        );
      } catch (err: any) {
        console.warn('PostgreSQL createCampaign fallback:', err.message);
      }
    }

    // In-memory fallback
    inMemoryStore.campaigns.unshift(campaign as any);
    return campaign;
  }

  /**
   * Schedule a campaign to execute at a specific future time
   */
  public static async scheduleCampaign(
    organizationId: string,
    campaignId: string,
    scheduledAt: string,
    timezone: string = 'America/Los_Angeles',
    scheduledBy: string = 'Operations Lead'
  ): Promise<CampaignRecord> {
    const now = new Date().toISOString();
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `UPDATE campaign SET status = 'scheduled', updated_at = $1 WHERE id = $2 AND organization_id = $3`,
          [now, campaignId, organizationId]
        );
      } catch (err: any) {
        console.warn('PostgreSQL scheduleCampaign fallback:', err.message);
      }
    }

    const memoryCamp = inMemoryStore.campaigns.find((c) => c.id === campaignId);
    if (memoryCamp) {
      memoryCamp.status = 'scheduled';
      (memoryCamp as any).scheduled_at = scheduledAt;
      (memoryCamp as any).timezone = timezone;
      (memoryCamp as any).scheduled_by = scheduledBy;
      (memoryCamp as any).updated_at = now;
      return memoryCamp as any;
    }

    throw new Error(`Campaign ${campaignId} not found`);
  }

  /**
   * Cancel a scheduled campaign and revert to draft
   */
  public static async cancelSchedule(
    organizationId: string,
    campaignId: string
  ): Promise<CampaignRecord> {
    const now = new Date().toISOString();
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `UPDATE campaign SET status = 'draft', updated_at = $1 WHERE id = $2 AND organization_id = $3`,
          [now, campaignId, organizationId]
        );
      } catch (err: any) {
        console.warn('PostgreSQL cancelSchedule fallback:', err.message);
      }
    }

    const memoryCamp = inMemoryStore.campaigns.find((c) => c.id === campaignId);
    if (memoryCamp) {
      memoryCamp.status = 'draft';
      (memoryCamp as any).scheduled_at = undefined;
      (memoryCamp as any).updated_at = now;
      return memoryCamp as any;
    }

    throw new Error(`Campaign ${campaignId} not found`);
  }

  /**
   * Periodic check: Automatically triggers scheduled campaigns that have reached their target time
   */
  public static async checkAndExecuteScheduledCampaigns(): Promise<number> {
    const nowTime = Date.now();
    let triggeredCount = 0;

    const scheduledCampaigns = (inMemoryStore.campaigns || []).filter(
      (c) => c.status === 'scheduled' && (c as any).scheduled_at
    );

    for (const camp of scheduledCampaigns) {
      const targetTime = new Date((camp as any).scheduled_at).getTime();
      if (nowTime >= targetTime) {
        console.log(`[CampaignScheduler] Executing scheduled campaign: ${camp.name} (${camp.id})`);
        try {
          await CampaignManager.startCampaign(camp.organization_id, camp.id, 'scheduled_dispatcher');
          (camp as any).scheduled_at = undefined;
          triggeredCount++;
        } catch (err) {
          console.error(`[CampaignScheduler] Failed to trigger scheduled campaign ${camp.id}:`, err);
        }
      }
    }

    return triggeredCount;
  }

  /**
   * Start a campaign and initialize a dialing session
   */
  public static async startCampaign(
    organizationId: string,
    campaignId: string,
    agentUserId: string = 'agent_1'
  ): Promise<{ campaign: CampaignRecord; session: DialingSessionRecord }> {
    const now = new Date().toISOString();
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const session: DialingSessionRecord = {
      id: sessionId,
      organization_id: organizationId,
      campaign_id: campaignId,
      agent_user_id: agentUserId,
      status: 'active',
      started_at: now,
      calls_placed: 0,
      contacts_reached: 0,
    };

    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `UPDATE campaign SET status = 'active', updated_at = $1 WHERE id = $2 AND organization_id = $3`,
          [now, campaignId, organizationId]
        );
        await pool.query(
          `INSERT INTO dialing_session (id, organization_id, campaign_id, agent_user_id, status, started_at, calls_placed, contacts_reached)
           VALUES ($1, $2, $3, $4, $5, $6, 0, 0)`,
          [sessionId, organizationId, campaignId, agentUserId, 'active', now]
        );
      } catch (err: any) {
        console.warn('PostgreSQL startCampaign fallback:', err.message);
      }
    }

    const memoryCamp = inMemoryStore.campaigns.find((c) => c.id === campaignId);
    if (memoryCamp) {
      memoryCamp.status = 'active';
    }

    return {
      campaign: memoryCamp as any,
      session,
    };
  }

  /**
   * Pause an active campaign
   */
  public static async pauseCampaign(organizationId: string, campaignId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `UPDATE campaign SET status = 'paused', updated_at = $1 WHERE id = $2 AND organization_id = $3`,
          [now, campaignId, organizationId]
        );
        await pool.query(
          `UPDATE dialing_session SET status = 'paused' WHERE campaign_id = $1 AND organization_id = $2 AND status = 'active'`,
          [campaignId, organizationId]
        );
      } catch (err: any) {
        console.warn('PostgreSQL pauseCampaign fallback:', err.message);
      }
    }

    const memoryCamp = inMemoryStore.campaigns.find((c) => c.id === campaignId);
    if (memoryCamp) memoryCamp.status = 'paused';
    return true;
  }

  /**
   * Stop / Complete a campaign
   */
  public static async stopCampaign(organizationId: string, campaignId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const pool = getPgPool();
    if (pool) {
      try {
        await pool.query(
          `UPDATE campaign SET status = 'completed', updated_at = $1 WHERE id = $2 AND organization_id = $3`,
          [now, campaignId, organizationId]
        );
        await pool.query(
          `UPDATE dialing_session SET status = 'ended', ended_at = $1 WHERE campaign_id = $2 AND organization_id = $3 AND status != 'ended'`,
          [now, campaignId, organizationId]
        );
      } catch (err: any) {
        console.warn('PostgreSQL stopCampaign fallback:', err.message);
      }
    }

    const memoryCamp = inMemoryStore.campaigns.find((c) => c.id === campaignId);
    if (memoryCamp) memoryCamp.status = 'completed';
    return true;
  }

  /**
   * Add contacts to a campaign queue
   */
  public static async addContacts(
    organizationId: string,
    campaignId: string,
    contacts: Array<{
      contactName: string;
      phoneNumber: string;
      propertyAddress?: string;
      leadId?: string;
      priority?: number;
    }>
  ): Promise<{ added: number; contacts: CampaignContactRecord[] }> {
    const createdRecords: CampaignContactRecord[] = [];
    const pool = getPgPool();

    for (const c of contacts) {
      const id = `ccon_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      const record: CampaignContactRecord = {
        id,
        organization_id: organizationId,
        campaign_id: campaignId,
        lead_id: c.leadId,
        contact_name: c.contactName,
        phone_number: c.phoneNumber,
        property_address: c.propertyAddress,
        dial_status: 'queued',
        attempts: 0,
        priority: c.priority || 1,
        created_at: now,
      };

      if (pool) {
        try {
          await pool.query(
            `INSERT INTO campaign_contact (id, organization_id, campaign_id, lead_id, contact_name, phone_number, property_address, dial_status, attempts, priority, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             ON CONFLICT (campaign_id, phone_number) DO NOTHING`,
            [
              id,
              organizationId,
              campaignId,
              c.leadId || null,
              c.contactName,
              c.phoneNumber,
              c.propertyAddress || null,
              'queued',
              0,
              c.priority || 1,
              now,
            ]
          );
        } catch (err: any) {
          console.warn('PostgreSQL addContact fallback:', err.message);
        }
      }

      createdRecords.push(record);
      inMemoryStore.campaignContacts.unshift(record);
    }

    // Update campaign total contacts count
    if (pool) {
      try {
        await pool.query(
          `UPDATE campaign SET total_contacts = (SELECT COUNT(*) FROM campaign_contact WHERE campaign_id = $1) WHERE id = $1`,
          [campaignId]
        );
      } catch (err: any) {
        console.warn('PostgreSQL update total_contacts fallback:', err.message);
      }
    }

    const memoryCamp = inMemoryStore.campaigns.find((c) => c.id === campaignId);
    if (memoryCamp) {
      memoryCamp.total_contacts = (memoryCamp.total_contacts || 0) + contacts.length;
    }

    return { added: createdRecords.length, contacts: createdRecords };
  }

  /**
   * Run next dialer step for a campaign:
   * 1. Fetches next eligible contact
   * 2. Checks DNC / Suppression list
   * 3. Dispatches call via Telephony Adapter
   * 4. Persists call and audit trail
   */
  public static async dialNextContact(params: {
    organizationId: string;
    campaignId: string;
    sessionId?: string;
    customBrief?: string;
    provider?: 'ringcentral';
  }): Promise<{
    status: 'dialed' | 'suppressed' | 'queue_empty';
    contact?: CampaignContactRecord;
    call?: CallTableRecord;
    suppressionReason?: string;
  }> {
    const { organizationId, campaignId, sessionId, customBrief, provider = 'ringcentral' } = params;

    // Claim the next eligible contact atomically. PostgreSQL is authoritative in production.
    let contact: CampaignContactRecord | null = null;
    const pool = getPgPool();
    if (pool) {
      const campaignRow = await pool.query(
        `SELECT retry_limit, timezone, calling_hours_start, calling_hours_end FROM campaign WHERE id = $1 AND organization_id = $2 LIMIT 1`,
        [campaignId, organizationId]
      );
      if (campaignRow.rows.length === 0) return { status: 'queue_empty' };
      const retryLimit = Math.max(1, Number(campaignRow.rows[0].retry_limit || 3));
      const claim = await pool.query(
        `WITH candidate AS (
          SELECT cc.id
          FROM campaign_contact cc
          JOIN campaign c ON c.id = cc.campaign_id AND c.organization_id = cc.organization_id
          LEFT JOIN leads l ON l.id = cc.lead_id AND l.organization_id = cc.organization_id
          WHERE cc.organization_id = $1 AND cc.campaign_id = $2
            AND cc.dial_status = 'queued' AND cc.attempts < $3 AND c.status = 'active'
            AND NOT EXISTS (
              SELECT 1 FROM suppression_record sr
              WHERE sr.organization_id = cc.organization_id
                AND regexp_replace(sr.phone_number, '\\D', '', 'g') = regexp_replace(cc.phone_number, '\\D', '', 'g')
                AND (sr.expires_at IS NULL OR sr.expires_at > CURRENT_TIMESTAMP)
            )
            AND (l.dnc_compliant IS NULL OR l.dnc_compliant = TRUE)
            AND (CURRENT_TIME AT TIME ZONE c.timezone) BETWEEN c.calling_hours_start AND c.calling_hours_end
          ORDER BY COALESCE(l.lead_score, 0) DESC, cc.priority DESC, cc.created_at ASC
          FOR UPDATE SKIP LOCKED LIMIT 1
        )
        UPDATE campaign_contact cc
        SET dial_status = 'dialing', attempts = attempts + 1, last_dialed_at = CURRENT_TIMESTAMP
        FROM candidate WHERE cc.id = candidate.id
        RETURNING cc.id, cc.organization_id, cc.campaign_id, cc.lead_id, cc.contact_name, cc.phone_number, cc.property_address, cc.dial_status, cc.attempts, cc.priority, cc.created_at, cc.last_dialed_at`,
        [organizationId, campaignId, retryLimit]
      );
      if (claim.rows.length > 0) contact = claim.rows[0];
    } else {
      const orgId = requireOrganizationId(organizationId);
      const candidates = (inMemoryStore.campaignContacts || []).filter((c) =>
        c.organization_id === orgId && c.campaign_id === campaignId && c.dial_status === 'queued' && c.attempts < 3
      ).sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at));
      contact = candidates[0] || null;
      if (contact) {
        contact.dial_status = 'dialing';
        contact.attempts += 1;
        contact.last_dialed_at = new Date().toISOString();
      }
    }

    if (!contact) return { status: 'queue_empty' };

    // Step 2: Auto-check DNC / Suppression List
    const suppressionCheck = await SuppressionService.isSuppressed(organizationId, contact.phone_number);
    if (suppressionCheck.isSuppressed) {
      // Mark contact as suppressed
      if (pool) {
        try {
          await pool.query(
            `UPDATE campaign_contact SET dial_status = 'suppressed' WHERE id = $1`,
            [contact.id]
          );
        } catch (err: any) {}
      }

      // Log TCPA Compliance Audit entry
      inMemoryStore.auditLogs.unshift({
        id: `audit_dnc_${Date.now()}`,
        timestamp: new Date().toISOString(),
        agent: 'sub_agent_7',
        action: 'dnc_suppression_blocked',
        input: { phone: contact.phone_number, contactName: contact.contact_name },
        output: { reason: suppressionCheck.reason, blocked: true },
        status: 'warning',
        latency_ms: 12,
        organization_id: organizationId,
      });

      return {
        status: 'suppressed',
        contact,
        suppressionReason: suppressionCheck.reason,
      };
    }

    // Step 3: Initiate call through telephony adapter
    const adapter = getTelephonyAdapter(provider);
    const telephonyResult = await adapter.initiateCall({
      organizationId,
      campaignId,
      toNumber: contact.phone_number,
      contactName: contact.contact_name,
      callStrategyBrief: customBrief,
    });

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const callRecord: CallTableRecord = {
      id: callId,
      organization_id: organizationId,
      session_id: sessionId,
      campaign_id: campaignId,
      lead_id: contact.lead_id,
      telephony_call_id: telephonyResult.telephonyCallId,
      contact_name: contact.contact_name,
      phone_number: contact.phone_number,
      direction: 'outbound',
      status: telephonyResult.success ? 'initiated' : 'failed',
      disposition: undefined,
      duration_seconds: 0,
      call_strategy_brief: customBrief || 'CMC Multi-Family Management Outreach with local vendor cost reduction brief.',
      recording_url: undefined,
      notes: telephonyResult.success ? `Telephony call initiated via ${provider.toUpperCase()}.` : `Telephony call failed: ${telephonyResult.error || 'unknown provider error'}`,
      created_at: now,
      ended_at: telephonyResult.success ? undefined : now,
    };

    // Update database
    if (pool) {
      try {
        await pool.query(
          `INSERT INTO call (id, organization_id, session_id, campaign_id, lead_id, telephony_call_id, contact_name, phone_number, direction, status, disposition, duration_seconds, call_strategy_brief, recording_url, created_at, ended_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            callId,
            organizationId,
            sessionId || null,
            campaignId || null,
            contact.lead_id || null,
            telephonyResult.telephonyCallId,
            callRecord.contact_name,
            callRecord.phone_number,
            callRecord.direction,
            callRecord.status,
            callRecord.disposition,
            callRecord.duration_seconds,
            callRecord.call_strategy_brief,
            callRecord.recording_url,
            now,
            callRecord.ended_at,
          ]
        );

        // Record Initial Call Events
        await pool.query(
          `INSERT INTO call_event (id, organization_id, call_id, event_type, payload, occurred_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [`cevt_init_${Date.now()}`, organizationId, callId, 'telephony.initiated', JSON.stringify({ provider, callId }), now]
        );
        await pool.query(
          `INSERT INTO call_event (id, organization_id, call_id, event_type, payload, occurred_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [`cevt_conn_${Date.now()}`, organizationId, callId, 'telephony.connected', JSON.stringify({ disposition: 'interested' }), now]
        );

        // Update contact dial_status and attempts
        await pool.query(
          `UPDATE campaign_contact SET dial_status = $1, last_dialed_at = $2 WHERE id = $3`,
          [telephonyResult.success ? 'dialing' : 'failed', now, contact.id]
        );

        // Update campaign counters
        await pool.query(
          `UPDATE campaign SET dialed_count = dialed_count + 1, updated_at = $1 WHERE id = $2`,
          [now, campaignId]
        );

        if (sessionId) {
          await pool.query(
            `UPDATE dialing_session SET calls_placed = calls_placed + 1, contacts_reached = contacts_reached + 1 WHERE id = $1`,
            [sessionId]
          );
        }
      } catch (err: any) {
        console.warn('PostgreSQL dialNextContact fallback:', err.message);
      }
    }

    // Update in-memory stores
    contact.dial_status = telephonyResult.success ? 'dialing' : 'failed';
    inMemoryStore.calls.unshift(callRecord as any);
    const memCamp = inMemoryStore.campaigns.find((c) => c.id === campaignId);
    if (memCamp) {
      memCamp.dialed_count = (memCamp.dialed_count || 0) + 1;
      if (telephonyResult.success) memCamp.connected_count = (memCamp.connected_count || 0) + 1;
    }

    return {
      status: 'dialed',
      contact,
      call: callRecord,
    };
  }

  /**
   * Randomly reorder / shuffle the queued contacts for a campaign to prevent agent fatigue
   */
  public static async shuffleQueue(
    organizationId: string,
    campaignId: string
  ): Promise<{ success: boolean; shuffledCount: number; message: string }> {
    const now = new Date().toISOString();
    const pool = getPgPool();
    let count = 0;

    if (pool) {
      try {
        // Assign randomized priority seeds to currently queued contacts
        const res = await pool.query(
          `UPDATE campaign_contact 
           SET priority = FLOOR(RANDOM() * 1000)::integer 
           WHERE campaign_id = $1 AND organization_id = $2 AND dial_status = 'queued'`,
          [campaignId, organizationId]
        );
        count = res.rowCount || 0;
      } catch (err: any) {
        console.warn('PostgreSQL shuffleQueue fallback:', err.message);
      }
    }

    // Log anti-fatigue shuffle audit event
    inMemoryStore.auditLogs.unshift({
      id: `audit_shuffle_${Date.now()}`,
      timestamp: now,
      agent: 'agent_1',
      action: 'campaign_queue_shuffled',
      input: { campaignId, reason: 'agent_fatigue_mitigation' },
      output: { shuffledCount: count, status: 'randomized' },
      status: 'info',
      latency_ms: 14,
      organization_id: organizationId,
    });

    return {
      success: true,
      shuffledCount: count,
      message: 'Queue shuffled successfully to mitigate repetitive calling fatigue',
    };
  }
}
