import { ParallelCallResult } from './telephonyAdapter';

export interface Agent {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'offline';
  currentSessionId?: string;
}

export class SubAgentPool {
  private agents: Map<string, Agent> = new Map();
  private agentIds: string[] = [];
  private lastIndex: number = 0;

  constructor(initialAgents: Agent[]) {
    initialAgents.forEach((agent) => {
      this.agents.set(agent.id, agent);
      this.agentIds.push(agent.id);
    });
  }

  public getAvailableAgents(): Agent[] {
    return Array.from(this.agents.values()).filter((a) => a.status === 'idle');
  }

  /**
   * Assigns incoming connected call sessions to idle sub-agents via Round-Robin.
   */
  public routeConnectedSession(
    callResult: ParallelCallResult
  ): { assignedAgentId: string; sessionId: string } | null {
    if (!callResult.telephonySessionId || this.agentIds.length === 0) {
      return null;
    }

    const totalAgents = this.agentIds.length;

    for (let i = 0; i < totalAgents; i++) {
      this.lastIndex = (this.lastIndex + 1) % totalAgents;
      const agentId = this.agentIds[this.lastIndex];
      const agent = this.agents.get(agentId);

      if (agent && agent.status === 'idle') {
        agent.status = 'busy';
        agent.currentSessionId = callResult.telephonySessionId;
        this.agents.set(agentId, agent);

        return {
          assignedAgentId: agentId,
          sessionId: callResult.telephonySessionId,
        };
      }
    }

    return null;
  }

  public releaseAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'idle';
      agent.currentSessionId = undefined;
      this.agents.set(agentId, agent);
    }
  }
}
