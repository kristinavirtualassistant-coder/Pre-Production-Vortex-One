import { CampaignManager } from './campaignManager';

export interface DialingEngineOptions {
  organizationId: string;
  campaignId: string;
  sessionId?: string;
  concurrency?: number;
  callStrategyBrief?: string;
}

export async function startDialingEngine(options: DialingEngineOptions) {
  const concurrency = Math.min(10, Math.max(3, Math.floor(options.concurrency ?? 3)));
  const results = await Promise.all(
    Array.from({ length: concurrency }, () => CampaignManager.dialNextContact({
      organizationId: options.organizationId,
      campaignId: options.campaignId,
      sessionId: options.sessionId,
      customBrief: options.callStrategyBrief,
      provider: 'ringcentral',
    })),
  );
  return { concurrency, results, dialed: results.filter((r) => r.status === 'dialed').length };
}
