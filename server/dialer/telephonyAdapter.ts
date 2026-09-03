/**
 * Vortex One - Telephony Adapter
 * Production RingCentral REST & Telephony Session Integration
 */

import { CallStatus, CallDisposition, NormalizedCallEvent } from './types';
import { DialerStateTransitionService } from './dialerStateTransitionService';
import { eventTypeForState } from './callStateMachine';
import { SDK as RingCentralSDK } from '@ringcentral/sdk';

export interface InitiateCallParams {
  organizationId: string;
  campaignId?: string;
  fromNumber?: string;
  toNumber: string;
  contactName: string;
  callStrategyBrief?: string;
  webhookCallbackUrl?: string;
}

export interface TelephonyCallResult {
  success: boolean;
  telephonyCallId: string;
  ringcentralRingoutId?: string;
  telephonySessionId?: string;
  ringcentralPartyId?: string;
  status: CallStatus;
  provider: 'ringcentral';
  rawResponse?: any;
  error?: string;
}

export interface TelephonyAdapter {
  providerName: 'ringcentral';
  initiateCall(params: InitiateCallParams): Promise<TelephonyCallResult>;
  terminateCall(telephonyCallId: string, partyId?: string, ringoutId?: string): Promise<boolean>;
  normalizeWebhookPayload(rawPayload: any, headers?: Record<string, any>): NormalizedCallEvent;
}

/**
 * RingCentral Telephony Adapter
 * Normalizes RingCentral Telephony Sessions and Webhook notifications
 */
export class RingCentralTelephonyAdapter implements TelephonyAdapter {
  public providerName: 'ringcentral' = 'ringcentral';

  private sdk: any;
  private platform: any;
  private clientId?: string;
  private clientSecret?: string;
  private serverUrl: string;

  constructor() {
    this.initSdk();
  }

  private initSdk(): void {
    this.clientId = process.env.RINGCENTRAL_CLIENT_ID?.trim() || undefined;
    this.clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET?.trim() || undefined;
    this.serverUrl = process.env.RINGCENTRAL_SERVER_URL || 'https://platform.ringcentral.com';
    
    // Lazy initialization of SDK
    if (this.clientId) {
      try {
        this.sdk = new RingCentralSDK({
          server: this.serverUrl,
          clientId: this.clientId,
          clientSecret: this.clientSecret || '',
        });
        this.platform = this.sdk.platform();
      } catch (err: any) {
        console.warn('[RingCentral] SDK initialization note:', err.message);
      }
    }
  }


  public async initiateCall(params: InitiateCallParams): Promise<TelephonyCallResult> {
    try {
      if (!this.platform) {
        this.initSdk();
      }
      if (!this.platform) {
        throw new Error('RingCentral credentials not configured or SDK unavailable');
      }

      const jwt = process.env.RINGCENTRAL_JWT?.trim();
      if (!jwt) {
        throw new Error('RingCentral requires RINGCENTRAL_JWT for active dialer authentication');
      }

      // Ensure platform is authenticated
      const isLoggedIn = await this.platform.loggedIn();
      if (!isLoggedIn) {
        await this.platform.login({ jwt });
      }

      const fromPhone = params.fromNumber || process.env.RINGCENTRAL_FROM_NUMBER;
      if (!fromPhone) throw new Error('RINGCENTRAL_FROM_NUMBER is required for RingOut');
      const response = await this.platform.post('/restapi/v1.0/account/~/extension/~/ring-out', {
        from: { phoneNumber: fromPhone },
        to: { phoneNumber: params.toNumber },
        playPrompt: false,
      });
      const data = await response.json();
      const ringoutId = data.id != null ? String(data.id) : '';
      if (!ringoutId) throw new Error('RingCentral RingOut response missing id');
      return {
        success: true,
        telephonyCallId: ringoutId,
        ringcentralRingoutId: ringoutId,
        status: 'initiated',
        provider: 'ringcentral',
        rawResponse: data,
      };
    } catch (error: any) {
      console.error('RingCentral Call Initiation Failed:', error);
      return {
        success: false,
        telephonyCallId: '',
        status: 'failed',
        provider: 'ringcentral',
        error: error.message,
      };
    }
  }

  public async terminateCall(telephonyCallId: string, partyId?: string, ringoutId?: string): Promise<boolean> {
    try {
      if (!this.platform) this.initSdk();
      if (!this.platform) return false;
      if (telephonyCallId && partyId) {
        await this.platform.delete(`/restapi/v1.0/account/~/telephony/sessions/${telephonyCallId}/parties/${partyId}`);
        return true;
      }
      if (ringoutId) {
        await this.platform.delete(`/restapi/v1.0/account/~/extension/~/ring-out/${ringoutId}`);
        return true;
      }
      return false;
    } catch (err) {
      console.error('RingCentral terminateCall error:', err);
      return false;
    }
  }

  public normalizeWebhookPayload(rawPayload: any, headers?: Record<string, any>): NormalizedCallEvent {
    // Accept an already-normalized provider event shape used by internal callers.
    // It still requires explicit provider event and call identifiers; nothing is synthesized.
    if (rawPayload?.telephonyCallId && rawPayload?.eventId && rawPayload?.status) {
      const dialerState = DialerStateTransitionService.normalizeProviderStatus(rawPayload.status);
      return {
        dialerState,
        dialerEventType: eventTypeForState(dialerState),
        eventId: rawPayload.eventId,
        telephonyCallId: rawPayload.telephonyCallId,
        telephonySessionId: rawPayload.telephonySessionId,
        ringcentralPartyId: rawPayload.ringcentralPartyId,
        eventType: `ringcentral.telephony_session.${String(rawPayload.status).toLowerCase()}`,
        status: rawPayload.status,
        durationSeconds: Number(rawPayload.duration_seconds) || 0,
        timestamp: rawPayload.timestamp || new Date().toISOString(),
        rawPayload,
      };
    }

    const body = rawPayload.body || rawPayload;
    const parties = body.parties || [];
    const primaryParty = parties[0] || {};
    const statusCode = primaryParty.status?.code || body.status?.code;
    const telephonyCallId = body.telephonySessionId || body.id;
    const telephonySessionId = body.telephonySessionId;
    const ringcentralPartyId = primaryParty.id;
    const eventId = rawPayload.uuid || rawPayload.eventId;
    if (!telephonyCallId) throw new Error('RingCentral webhook missing telephonySessionId');
    if (!eventId) throw new Error('RingCentral webhook missing provider event UUID');
    if (!statusCode) throw new Error('RingCentral webhook missing party status code');

    let status: CallStatus = 'initiated';
    let disposition: CallDisposition | undefined = undefined;

    switch (statusCode) {
      case 'Setup':
        status = 'initiated';
        break;
      case 'Proceeding':
      case 'Ringing':
        status = 'ringing';
        break;
      case 'Answered':
        status = 'in-progress';
        break;
      case 'Disconnected':
        status = 'completed';
        const reason = primaryParty.status?.reason || body.status?.reason;
        if (reason === 'Busy') {
          status = 'busy';
          disposition = 'busy';
        } else if (reason === 'NoAnswer') {
          status = 'no-answer';
          disposition = 'no_answer';
        } else if (reason === 'Voicemail') {
          status = 'voicemail';
          disposition = 'left_voicemail';
        }
        break;
      default:
        throw new Error(`Unsupported RingCentral telephony status: ${statusCode}`);
    }

    const durationSeconds = primaryParty.duration || body.duration || 0;
    const recordingUrl = primaryParty.recordings?.[0]?.contentUri || body.recordings?.[0]?.contentUri;

    const dialerState = DialerStateTransitionService.normalizeProviderStatus(statusCode);

    return {
      dialerState,
      dialerEventType: eventTypeForState(dialerState),
      eventId,
      telephonyCallId,
      telephonySessionId,
      ringcentralPartyId,
      eventType: `ringcentral.telephony_session.${statusCode.toLowerCase()}`,
      status,
      disposition,
      durationSeconds: Number(durationSeconds) || 0,
      recordingUrl,
      timestamp: body.eventTime || new Date().toISOString(),
      rawPayload,
    };
  }
}

/**
 * Singleton Adapter Resolver for RingCentral Telephony
 */
export function getTelephonyAdapter(provider: string = 'ringcentral'): TelephonyAdapter {
  return new RingCentralTelephonyAdapter();
}
