import { SDK } from '@ringcentral/sdk';

export interface CallPayload {
  to: string;
  leadId: string;
  campaignId: string;
}

export interface ParallelCallResult {
  leadId: string;
  to: string;
  telephonySessionId?: string;
  status: 'initiated' | 'failed';
  error?: string;
}

export class TelephonyAdapter {
  private rcsdk: SDK;
  private platform: any;

  constructor() {
    this.rcsdk = new SDK({
      server: process.env.RINGCENTRAL_SERVER_URL || SDK.server.sandbox,
      clientId: process.env.RINGCENTRAL_CLIENT_ID || '',
      clientSecret: process.env.RINGCENTRAL_CLIENT_SECRET || '',
    });
    this.platform = this.rcsdk.platform();
  }

  /**
   * Initializes platform authentication using OAuth/JWT.
   */
  public async initialize(): Promise<void> {
    if (process.env.RINGCENTRAL_JWT) {
      await this.platform.login({ jwt: process.env.RINGCENTRAL_JWT });
    } else {
      await this.platform.login({
        username: process.env.RINGCENTRAL_USERNAME,
        extension: process.env.RINGCENTRAL_EXTENSION || '',
        password: process.env.RINGCENTRAL_PASSWORD,
      });
    }
  }

  /**
   * Initiates simultaneous outbound call sessions across multiple lead targets.
   */
  public async makeParallelCalls(
    fromPhoneNumber: string,
    targets: CallPayload[]
  ): Promise<ParallelCallResult[]> {
    const dispatchPromises = targets.map(async (target) => {
      try {
        const response = await this.platform.post(
          '/restapi/v1.0/account/~/extension/~/telephony/sessions',
          {
            direction: 'Outbound',
            from: { phoneNumber: fromPhoneNumber },
            to: { phoneNumber: target.to },
            telephonyFields: {
              metadata: {
                leadId: target.leadId,
                campaignId: target.campaignId,
              },
            },
          }
        );

        const data = await response.json();
        return {
          leadId: target.leadId,
          to: target.to,
          telephonySessionId: data.id,
          status: 'initiated' as const,
        };
      } catch (err: any) {
        return {
          leadId: target.leadId,
          to: target.to,
          status: 'failed' as const,
          error: err?.message || 'Failed to dispatch RingCentral session',
        };
      }
    });

    return Promise.all(dispatchPromises);
  }
}
