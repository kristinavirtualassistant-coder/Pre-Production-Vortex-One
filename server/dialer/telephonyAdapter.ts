/**
 * Vortex One - Telephony Adapter
 * Production RingCentral REST & Telephony Session Integration
 */

import { CallStatus, CallDisposition, NormalizedCallEvent } from './types';
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
  status: CallStatus;
  provider: 'ringcentral';
  rawResponse?: any;
  error?: string;
}

export interface TelephonyAdapter {
  providerName: 'ringcentral';
  initiateCall(params: InitiateCallParams): Promise<TelephonyCallResult>;
  terminateCall(telephonyCallId: string): Promise<boolean>;
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
    this.clientId = process.env.RINGCENTRAL_CLIENT_ID || 'ZpcOzDiZ2EKbwxi6XczX32';
    this.clientSecret = process.env.RINGCENTRAL_CLIENT_SECRET || '';
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

  private extractJwtToken(rawJwt?: string): string | null {
    if (!rawJwt) return null;
    const trimmed = rawJwt.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === 'string') return parsed;
        if (parsed.CMC_Auth_KM) return parsed.CMC_Auth_KM;
        if (parsed.jwt) return typeof parsed.jwt === 'string' ? parsed.jwt : (parsed.jwt.CMC_Auth_KM || JSON.stringify(parsed.jwt));
        const firstVal = Object.values(parsed)[0];
        if (typeof firstVal === 'string') return firstVal;
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  public async initiateCall(params: InitiateCallParams): Promise<TelephonyCallResult> {
    try {
      if (!this.platform) {
        this.initSdk();
      }
      if (!this.platform) {
        throw new Error('RingCentral credentials not configured or SDK unavailable');
      }

      // Ensure platform is authenticated
      const isLoggedIn = await this.platform.loggedIn();
      if (!isLoggedIn) {
        const resolvedJwt = this.extractJwtToken(process.env.RINGCENTRAL_JWT);
        if (resolvedJwt) {
          // Modern RingCentral JWT Authentication
          await this.platform.login({
            jwt: resolvedJwt,
          });
        } else if (process.env.RINGCENTRAL_USERNAME && process.env.RINGCENTRAL_PASSWORD) {
          // Password / Extension flow
          await this.platform.login({
            username: process.env.RINGCENTRAL_USERNAME,
            extension: process.env.RINGCENTRAL_EXTENSION,
            password: process.env.RINGCENTRAL_PASSWORD,
          });
        } else {
          throw new Error('RingCentral requires RINGCENTRAL_JWT or RINGCENTRAL_USERNAME/PASSWORD for active dialer authentication');
        }
      }

      // Make the actual REST API call
      const fromPhone = params.fromNumber || process.env.RINGCENTRAL_FROM_NUMBER;
      const response = await this.platform.post('/restapi/v1.0/account/~/telephony/sessions', {
        from: fromPhone ? { phoneNumber: fromPhone } : undefined,
        to: { phoneNumber: params.toNumber },
        direction: 'Outbound',
      });

      const data = await response.json();
      return {
        success: true,
        telephonyCallId: data.telephonySessionId || data.id,
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

  public async terminateCall(telephonyCallId: string): Promise<boolean> {
    try {
      if (!this.platform) this.initSdk();
      if (this.platform) {
        await this.platform.delete(`/restapi/v1.0/account/~/telephony/sessions/${telephonyCallId}`);
        return true;
      }
      return false;
    } catch (err) {
      console.error('RingCentral terminateCall error:', err);
      return false;
    }
  }

  public normalizeWebhookPayload(rawPayload: any, headers?: Record<string, any>): NormalizedCallEvent {
    const body = rawPayload.body || rawPayload;
    const parties = body.parties || [];
    const primaryParty = parties[0] || {};
    const statusCode = primaryParty.status?.code || body.status?.code || 'Disconnected';
    const telephonyCallId = body.telephonySessionId || body.id || `rc_${Date.now()}`;
    const eventId = rawPayload.uuid || rawPayload.eventId || `rc_evt_${telephonyCallId}_${statusCode}_${Date.now()}`;

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
        } else {
          disposition = 'interested';
        }
        break;
      default:
        status = 'completed';
    }

    const durationSeconds = primaryParty.duration || body.duration || 0;
    const recordingUrl = primaryParty.recordings?.[0]?.contentUri || body.recordings?.[0]?.contentUri;

    return {
      eventId,
      telephonyCallId,
      eventType: `ringcentral.telephony_session.${statusCode.toLowerCase()}`,
      status,
      disposition,
      durationSeconds: Number(durationSeconds) || (status === 'completed' ? 75 : 0),
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
