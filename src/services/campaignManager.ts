// campaignManager.ts
import { TelephonyAdapter, CallPayload } from './telephonyAdapter';
import { SubAgentPool } from './subAgents';
import { SuppressionService } from './suppressionService';

export interface Lead {
  id: string;
  phone: string;
  name: string;
}

export class CampaignManager {
  private adapter: TelephonyAdapter;
  private agentPool: SubAgentPool;
  private suppressionService: SuppressionService;

  constructor(
    adapter: TelephonyAdapter,
    agentPool: SubAgentPool,
    suppressionService: SuppressionService
  ) {
    this.adapter = adapter;
    this.agentPool = agentPool;
    this.suppressionService = suppressionService;
  }

  /**
   * Evaluates leads against DNC rules, matches available agent capacity, and dispatches parallel calls.
   */
  public async executeDialingBatch(
    campaignId: string,
    fromNumber: string,
    rawLeads: Lead[],
    dialRatioMultiplier: number = 3
  ): Promise<void> {
    // 1. Enforce TCPA Compliance / DNC Suppression
    const compliantLeads = this.suppressionService.filterCompliantLeads(rawLeads);

    // 2. Determine target batch size based on available agent capacity
    const availableAgents = this.agentPool.getAvailableAgents();
    const batchCapacity = availableAgents.length * dialRatioMultiplier;

    const leadsToDial = compliantLeads.slice(0, batchCapacity);
    if (leadsToDial.length === 0) return;

    const targetPayloads: CallPayload[] = leadsToDial.map((lead) => ({
      to: lead.phone,
      leadId: lead.id,
      campaignId,
    }));

    // 3. Dispatch parallel calls via TelephonyAdapter
    console.log(`[CampaignManager] Dispatching batch of ${leadsToDial.length} calls for campaign ${campaignId}`);
    const results = await this.adapter.makeParallelCalls(fromNumber, targetPayloads);

    // 4. Handle early wins and route connected sessions
    let routedCount = 0;
    for (const result of results) {
      if (result.status === 'initiated') {
        const route = this.agentPool.routeConnectedSession(result);
        if (route) routedCount++;
      }
    }
    console.log(`[CampaignManager] Batch complete. ${routedCount} sessions routed to sub-agents.`);
  }
}
