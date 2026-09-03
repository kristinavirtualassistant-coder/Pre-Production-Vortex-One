import { CampaignManager } from './campaignManager';
import { CampaignContactRecord, CallTableRecord } from './types';

export interface DialingEngineOptions {
  organizationId: string;
  campaignId: string;
  sessionId?: string;
  concurrency?: number;
  callStrategyBrief?: string;
}

export interface DialingEngineResult {
  concurrency: number;
  results: DialingEngineContactResult[];
  dialed: number;
}

export type DialingEngineContactResult = {
  status: 'dialed' | 'suppressed' | 'queue_empty';
  contact?: CampaignContactRecord;
  call?: CallTableRecord;
  suppressionReason?: string;
};

async function runDialerWorker(options: DialingEngineOptions): Promise<DialingEngineContactResult[]> {
  const workerResults: DialingEngineContactResult[] = [];

  while (true) {
    const result = await CampaignManager.dialNextContact({
      organizationId: options.organizationId,
      campaignId: options.campaignId,
      sessionId: options.sessionId,
      customBrief: options.callStrategyBrief,
      provider: 'ringcentral',
    });

    workerResults.push(result);

    // An empty queue ends this worker. Suppressed contacts are terminal for
    // this attempt, so continue immediately and let the worker claim another.
    if (result.status === 'queue_empty') return workerResults;
  }
}

export async function startDialingEngine(options: DialingEngineOptions): Promise<DialingEngineResult> {
  const concurrency = Math.min(10, Math.max(3, Math.floor(options.concurrency ?? 3)));
  const workers = await Promise.all(
    Array.from({ length: concurrency }, () => runDialerWorker(options)),
  );
  const results = workers.flat();

  return {
    concurrency,
    results,
    dialed: results.filter((result) => result.status === 'dialed').length,
  };
}
