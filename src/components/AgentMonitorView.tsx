import React, { useState, useEffect } from 'react';
import {
  Bot,
  BrainCircuit,
  Cpu,
  Building2,
  UserCheck,
  Search,
  Sparkles,
  PhoneCall,
  BarChart3,
  ShieldAlert,
  Workflow as WorkflowIcon,
  CheckCheck,
  Wrench,
  Shield,
  Zap,
  Activity,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Layers,
  ArrowRight,
  Terminal,
  ShieldCheck,
  FileText,
  MessageSquare,
  Send,
  User,
  Radio,
} from 'lucide-react';
import { AgentDefinition, WorkflowRun, Task, AgentId } from '../types';
import { useWorkflowRuns, useAgentTelemetry } from '../hooks/useWorkflowRuns';

interface AgentMonitorViewProps {
  agents: AgentDefinition[];
  onSelectAgent?: (agent: AgentDefinition) => void;
  initialSelectedAgentId?: string;
}

export const AgentMonitorView: React.FC<AgentMonitorViewProps> = ({
  agents,
  onSelectAgent,
  initialSelectedAgentId,
}) => {
  const [selectedAgent, setSelectedAgent] = useState<AgentDefinition>(() => {
    if (initialSelectedAgentId) {
      const match = agents.find((a) => a.id === initialSelectedAgentId);
      if (match) return match;
    }
    return agents[0] || ({} as AgentDefinition);
  });

  useEffect(() => {
    if (initialSelectedAgentId) {
      const match = agents.find((a) => a.id === initialSelectedAgentId);
      if (match) {
        setSelectedAgent(match);
      }
    }
  }, [initialSelectedAgentId, agents]);
  const [filterRole, setFilterRole] = useState<string>('all');
  const [isAutoPolling, setIsAutoPolling] = useState<boolean>(true);
  const [selectedRunTab, setSelectedRunTab] = useState<'all' | 'running' | 'completed' | 'paused_approval'>('all');
  const [monitorTab, setMonitorTab] = useState<'fleet' | 'peer_logs'>('fleet');

  const [p2pLogs, setP2pLogs] = useState<any[]>([
    {
      id: 'p2p-1',
      sequence: 1,
      sender: 'orchestrator_agent',
      senderName: 'Master Orchestrator',
      receiver: 'sub_agent_1',
      receiverName: 'Sub-Agent 1 (County Assessor)',
      action: 'PARCEL_QUERY_REQUEST',
      payload: { county: 'Orange', parcelId: 'APN-8849-012', depth: 'full_tax_roll' },
      status: 'acknowledged',
      latencyMs: 124,
      confidence: 0.98,
      timestamp: new Date(Date.now() - 45000).toLocaleTimeString(),
    },
    {
      id: 'p2p-2',
      sequence: 2,
      sender: 'sub_agent_1',
      senderName: 'Sub-Agent 1 (County Assessor)',
      receiver: 'sub_agent_2',
      receiverName: 'Sub-Agent 2 (GIS Spatial)',
      action: 'GIS_BOUNDING_BOX_SYNC',
      payload: { coordinates: '33.8353° N, 117.9145° W', radiusMiles: 5.0 },
      status: 'completed',
      latencyMs: 89,
      confidence: 0.99,
      timestamp: new Date(Date.now() - 32000).toLocaleTimeString(),
    },
    {
      id: 'p2p-3',
      sequence: 3,
      sender: 'sub_agent_2',
      senderName: 'Sub-Agent 2 (GIS Spatial)',
      receiver: 'sub_agent_3',
      receiverName: 'Sub-Agent 3 (Skip Tracer)',
      action: 'OWNER_CONTACT_VERIFY',
      payload: { ownerName: 'Sterling Vance Trust', llcState: 'Delaware' },
      status: 'completed',
      latencyMs: 215,
      confidence: 0.95,
      timestamp: new Date(Date.now() - 20000).toLocaleTimeString(),
    },
    {
      id: 'p2p-4',
      sequence: 4,
      sender: 'sub_agent_3',
      senderName: 'Sub-Agent 3 (Skip Tracer)',
      receiver: 'sub_agent_7',
      receiverName: 'Sub-Agent 7 (Underwriter)',
      action: 'UNDERWRITING_VALUATION_HANDOFF',
      payload: { estimatedArv: 1450000, currentDebt: 620000, equityRatio: 0.57 },
      status: 'completed',
      latencyMs: 162,
      confidence: 0.96,
      timestamp: new Date(Date.now() - 10000).toLocaleTimeString(),
    },
    {
      id: 'p2p-5',
      sequence: 5,
      sender: 'sub_agent_7',
      senderName: 'Sub-Agent 7 (Underwriter)',
      receiver: 'sub_agent_9',
      receiverName: 'Sub-Agent 9 (Outreach Dispatcher)',
      action: 'DISPATCH_SMS_CAMPAIGN_READY',
      payload: { campaignId: 'camp-902', targetPhone: '714-555-0199', template: 'Absentee Owner Offer' },
      status: 'delivered',
      latencyMs: 95,
      confidence: 0.99,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [p2pFilterAgent, setP2pFilterAgent] = useState<string>('all');

  const simulateP2pHandoff = () => {
    const randomSenders = [
      { id: 'orchestrator_agent', name: 'Master Orchestrator' },
      { id: 'sub_agent_3', name: 'Sub-Agent 3 (Skip Tracer)' },
      { id: 'sub_agent_7', name: 'Sub-Agent 7 (Underwriter)' }
    ];
    const randomReceivers = [
      { id: 'sub_agent_9', name: 'Sub-Agent 9 (Outreach Dispatcher)' },
      { id: 'sub_agent_5', name: 'Sub-Agent 5 (Compliance Guard)' },
      { id: 'sub_agent_4', name: 'Sub-Agent 4 (Lead Scorer)' }
    ];
    const sender = randomSenders[Math.floor(Math.random() * randomSenders.length)];
    const receiver = randomReceivers[Math.floor(Math.random() * randomReceivers.length)];
    const actions = ['DEEP_ENRICHMENT_SYNC', 'BULK_LEAD_REINDEX', 'COMPLIANCE_CLEARANCE_CHECK', 'SMS_OUTREACH_DISPATCH'];
    const action = actions[Math.floor(Math.random() * actions.length)];

    const newLog = {
      id: `p2p-${Date.now()}`,
      sequence: p2pLogs.length + 1,
      sender: sender.id,
      senderName: sender.name,
      receiver: receiver.id,
      receiverName: receiver.name,
      action,
      payload: { timestamp: new Date().toISOString(), trigger: 'Live Agent DAG Execution', status: 'hand-off dispatched' },
      status: 'completed',
      latencyMs: Math.floor(70 + Math.random() * 180),
      confidence: Number((0.92 + Math.random() * 0.07).toFixed(2)),
      timestamp: new Date().toLocaleTimeString(),
    };
    setP2pLogs([newLog, ...p2pLogs]);
  };

  const [messagesMap, setMessagesMap] = useState<Record<string, { id: string; sender: 'user' | 'agent'; text: string; timestamp: string }[]>>({
    orchestrator_agent: [
      { id: 'm1', sender: 'agent', text: 'Orchestrator active. Awaiting strategic instructions or pipeline adjustments.', timestamp: '12:00 PM' }
    ]
  });
  const [inputMessage, setInputMessage] = useState('');
  const [isAgentTyping, setIsAgentTyping] = useState(false);

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim()) return;

    const userText = inputMessage.trim();
    const agentId = selectedAgent.id;
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user' as const,
      text: userText,
      timestamp: nowStr,
    };

    setMessagesMap((prev) => ({
      ...prev,
      [agentId]: [...(prev[agentId] || [{ id: 'init', sender: 'agent', text: `${selectedAgent.name} online and listening.`, timestamp: nowStr }]), newMsg],
    }));

    setInputMessage('');
    setIsAgentTyping(true);

    setTimeout(() => {
      const responseText = `[Instruction Acknowledged] Directive received by ${selectedAgent.name}. Adjusting tool execution parameters, re-indexing records, and updating telemetry.`;
      const agentMsg = {
        id: `msg-res-${Date.now()}`,
        sender: 'agent' as const,
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessagesMap((prev) => ({
        ...prev,
        [agentId]: [...(prev[agentId] || []), agentMsg],
      }));
      setIsAgentTyping(false);
    }, 1200);
  };

  // SWR-based polling synchronization with /api/runs and /api/tasks
  const {
    runs,
    isLoading: isRunsLoading,
    isValidating: isRunsValidating,
    refresh: refreshRuns,
  } = useWorkflowRuns({
    limit: 20,
    refreshInterval: 2500,
    enabled: isAutoPolling,
  });

  const {
    tasks,
    isLoading: isTasksLoading,
    refresh: refreshTasks,
  } = useAgentTelemetry({
    refreshInterval: 2500,
    enabled: isAutoPolling,
  });

  const roleIcons: Record<string, any> = {
    orchestrator: BrainCircuit,
    reasoning: Cpu,
    property: Building2,
    crm_lead: UserCheck,
    research: Search,
    enrichment: Sparkles,
    outreach: PhoneCall,
    analytics: BarChart3,
    compliance: ShieldAlert,
    automation: WorkflowIcon,
    qa_audit: CheckCheck,
    custom: Bot,
  };

  const isLoading = isRunsLoading || isRunsValidating || isTasksLoading;

  const handleManualRefresh = () => {
    refreshRuns();
    refreshTasks();
  };

  // Derive active workflow run (if any is currently executing or paused)
  const activeRuns = runs.filter((r) => r.status === 'running' || r.status === 'paused_approval');
  const completedRuns = runs.filter((r) => r.status === 'completed');
  const failedRuns = runs.filter((r) => r.status === 'failed');

  const [statusOverrides, setStatusOverrides] = useState<Record<string, boolean>>({});
  const [pingLatency, setPingLatency] = useState<Record<string, number>>({});
  const [isPinging, setIsPinging] = useState<boolean>(false);

  const toggleAgentAvailability = (agentId: string) => {
    setStatusOverrides((prev) => {
      const current = prev[agentId] !== undefined ? prev[agentId] : true;
      return { ...prev, [agentId]: !current };
    });
  };

  const isAgentOnline = (agentId: string) => {
    if (statusOverrides[agentId] !== undefined) {
      return statusOverrides[agentId];
    }
    const agent = agents.find((a) => a.id === agentId);
    return agent ? agent.enabled !== false : true;
  };

  const handlePingAgent = (agentId: string) => {
    setIsPinging(true);
    setTimeout(() => {
      const simulatedLatency = Math.floor(Math.random() * 12) + 4; // 4ms - 15ms
      setPingLatency((prev) => ({ ...prev, [agentId]: simulatedLatency }));
      setIsPinging(false);
    }, 280);
  };

  // Map each agent to their real-time execution & online/offline status
  const getAgentLiveStatus = (agentId: AgentId | string) => {
    const online = isAgentOnline(agentId);

    if (!online) {
      return {
        state: 'offline' as const,
        isOnline: false,
        label: 'Offline • Standby',
        shortLabel: 'OFFLINE',
        runId: undefined,
        stepName: 'Cluster Standby / Maintenance Mode',
        colorClass: 'bg-slate-400 text-white border-slate-500',
        badgeClass: 'bg-slate-100 text-slate-500 border-slate-300',
        dotClass: 'bg-slate-400 ring-2 ring-slate-200',
      };
    }

    // 1. Check if any active workflow run is currently executing this agent
    const currentActiveRun = activeRuns.find(
      (r) => r.status === 'running' && r.current_agent_id === agentId
    );
    if (currentActiveRun) {
      return {
        state: 'running' as const,
        isOnline: true,
        label: 'Online • Executing Step',
        shortLabel: 'EXECUTING',
        runId: currentActiveRun.run_id,
        stepName: currentActiveRun.current_step_name || 'Active Task',
        colorClass: 'bg-blue-500 text-white border-blue-600 animate-pulse',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        dotClass: 'bg-blue-500 animate-ping ring-2 ring-blue-400/40',
      };
    }

    // 2. Check if waiting on human gate
    const gateRun = activeRuns.find(
      (r) => r.status === 'paused_approval' && r.current_agent_id === agentId
    );
    if (gateRun) {
      return {
        state: 'paused_approval' as const,
        isOnline: true,
        label: 'Online • Gate Pending',
        shortLabel: 'GATE PENDING',
        runId: gateRun.run_id,
        stepName: gateRun.current_step_name || 'Compliance Gate',
        colorClass: 'bg-amber-500 text-white border-amber-600',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500 ring-2 ring-amber-400/40',
      };
    }

    // 3. Check most recent task for this agent
    const agentTasks = tasks.filter((t) => t.assigned_agent === agentId);
    if (agentTasks.length > 0) {
      const latestTask = agentTasks[0];
      if (latestTask.status === 'failed') {
        return {
          state: 'failed' as const,
          isOnline: true,
          label: 'Online • Last Task Failed',
          shortLabel: 'FAILED',
          runId: latestTask.task_id,
          stepName: latestTask.objective,
          colorClass: 'bg-rose-500 text-white border-rose-600',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
          dotClass: 'bg-rose-500 ring-2 ring-rose-300',
        };
      }
      return {
        state: 'completed' as const,
        isOnline: true,
        label: 'Online • Ready for DAG',
        shortLabel: 'ONLINE • READY',
        runId: latestTask.task_id,
        stepName: 'Ready for Next Workflow DAG',
        colorClass: 'bg-emerald-500 text-white border-emerald-600',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500 animate-pulse ring-2 ring-emerald-400/40',
      };
    }

    return {
      state: 'idle' as const,
      isOnline: true,
      label: 'Online • Ready',
      shortLabel: 'ONLINE • READY',
      runId: undefined,
      stepName: 'Idle / Ready for Dispatch',
      colorClass: 'bg-emerald-500 text-white border-emerald-600',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500 animate-pulse ring-2 ring-emerald-400/40',
    };
  };

  const onlineAgentsCount = agents.filter((a) => isAgentOnline(a.id)).length;
  const offlineAgentsCount = agents.length - onlineAgentsCount;

  const filteredAgents = filterRole === 'all'
    ? agents
    : filterRole === 'online'
    ? agents.filter((a) => isAgentOnline(a.id))
    : filterRole === 'offline'
    ? agents.filter((a) => !isAgentOnline(a.id))
    : agents.filter((a) => a.role === filterRole);

  const selectedAgentStatus = getAgentLiveStatus(selectedAgent.id);
  const selectedAgentTasks = tasks.filter((t) => t.assigned_agent === selectedAgent.id);

  const filteredRuns = selectedRunTab === 'all'
    ? runs
    : runs.filter((r) => r.status === selectedRunTab);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Real-time Observability Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/15">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Agent Fleet Monitor &amp; Live Telemetry</h1>
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>SSE / Polling Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time state synchronization across Master Orchestrator, Sub-Agents 0–9, and multi-node DAG workflows.
            </p>
          </div>
        </div>

        {/* Polling & Refresh Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAutoPolling(!isAutoPolling)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-2 transition cursor-pointer ${
              isAutoPolling
                ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${isAutoPolling ? 'text-cyan-600 animate-pulse' : 'text-slate-400'}`} />
            <span>Auto-Poll (2.5s): {isAutoPolling ? 'ON' : 'PAUSED'}</span>
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white flex items-center space-x-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh State</span>
          </button>

          <div className="text-right hidden sm:block text-[11px] text-slate-500 font-mono">
            SWR Polling: {isAutoPolling ? 'Active' : 'Paused'}
          </div>
        </div>
      </div>

      {/* Monitor Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setMonitorTab('fleet')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
            monitorTab === 'fleet'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>Fleet Inspector &amp; DAG Runs</span>
        </button>

        <button
          onClick={() => setMonitorTab('peer_logs')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-2 ${
            monitorTab === 'peer_logs'
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <BrainCircuit className="w-4 h-4" />
          <span>Peer-to-Peer Agent Logs (P2P Sequence)</span>
        </button>
      </div>

      {monitorTab === 'peer_logs' ? (
        <div className="space-y-6">
          {/* P2P Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Peer-to-Peer Agent Message Passing &amp; Hand-Off Stream</h3>
                <p className="text-xs text-slate-500">Sequential message log and telemetry hand-offs across multi-agent DAG pipelines.</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <select
                value={p2pFilterAgent}
                onChange={(e) => setP2pFilterAgent(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-cyan-600"
              >
                <option value="all">All Agent Senders ({p2pLogs.length})</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>

              <button
                onClick={simulateP2pHandoff}
                className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer flex items-center space-x-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Simulate P2P Hand-Off</span>
              </button>
            </div>
          </div>

          {/* Sequential Flow Diagram / Timeline View */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Sequential Message Flow &amp; Protocol Hand-Offs</h3>

            <div className="space-y-4 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-slate-200">
              {p2pLogs
                .filter((log) => p2pFilterAgent === 'all' || log.sender === p2pFilterAgent || log.receiver === p2pFilterAgent)
                .map((log) => (
                  <div key={log.id} className="relative flex items-start space-x-4 pl-2">
                    <div className="w-9 h-9 rounded-full bg-cyan-600 text-white flex items-center justify-center font-bold text-xs shrink-0 z-10 shadow-sm font-mono">
                      #{log.sequence}
                    </div>

                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div className="flex items-center space-x-2 text-xs font-semibold">
                          <span className="px-2.5 py-0.5 rounded-lg bg-cyan-100 text-cyan-800 font-bold flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{log.senderName}</span>
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                          <span className="px-2.5 py-0.5 rounded-lg bg-purple-100 text-purple-800 font-bold flex items-center space-x-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>{log.receiverName}</span>
                          </span>
                        </div>

                        <div className="flex items-center space-x-3 text-xs">
                          <span className="font-mono text-slate-500">{log.timestamp}</span>
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold uppercase text-[10px]">
                            {log.status}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 font-medium">Protocol Action:</span>{' '}
                          <strong className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">{log.action}</strong>
                        </div>
                        <div className="flex items-center space-x-4 text-slate-500 text-[11px]">
                          <span>Latency: <strong className="text-slate-900">{log.latencyMs}ms</strong></span>
                          <span>Confidence: <strong className="text-emerald-600">{Math.round(log.confidence * 100)}%</strong></span>
                        </div>
                      </div>

                      <div className="bg-slate-900 text-slate-200 rounded-lg p-3 font-mono text-[11px] overflow-x-auto space-y-1">
                        <div className="text-slate-400 text-[10px] uppercase font-bold">Inter-Agent Payload JSON:</div>
                        <pre className="text-cyan-400">{JSON.stringify(log.payload, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Fleet Telemetry Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Fleet Registered</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{agents.length} <span className="text-xs font-normal text-slate-500">Agents</span></p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600">
            <Bot className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between col-span-2 sm:col-span-1 border-l-4 border-l-emerald-500">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Orchestration Health</p>
            <div className="flex items-center space-x-1.5 mt-0.5">
              <span className="text-xl font-black text-emerald-600">
                {onlineAgentsCount}/{agents.length}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 uppercase">
                {Math.round((onlineAgentsCount / (agents.length || 1)) * 100)}% Online
              </span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active DAG Runs</p>
            <p className="text-xl font-black text-blue-600 mt-0.5">
              {activeRuns.length} <span className="text-xs font-medium text-slate-500">Executing</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Play className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Completed DAGs</p>
            <p className="text-xl font-black text-emerald-600 mt-0.5">{completedRuns.length} <span className="text-xs font-medium text-slate-500">Runs</span></p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tasks Executed</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{tasks.length} <span className="text-xs font-medium text-slate-500">Recorded</span></p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Live Workflow Runs Section (Displays color-coded workflow node status) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="flex items-center space-x-2">
            <WorkflowIcon className="w-4 h-4 text-cyan-600" />
            <h2 className="text-sm font-bold text-slate-900">Real-Time Workflow Runs &amp; Node State Stream</h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              {runs.length} Runs
            </span>
          </div>

          <div className="flex items-center space-x-1.5 text-xs">
            <button
              onClick={() => setSelectedRunTab('all')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                selectedRunTab === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({runs.length})
            </button>
            <button
              onClick={() => setSelectedRunTab('running')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                selectedRunTab === 'running' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Active ({activeRuns.length})
            </button>
            <button
              onClick={() => setSelectedRunTab('completed')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                selectedRunTab === 'completed' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Completed ({completedRuns.length})
            </button>
          </div>
        </div>

        {/* Workflow Runs Cards List */}
        {filteredRuns.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No workflow runs recorded in this state filter. Execute a workflow from Visual Builder to stream events.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredRuns.map((run) => {
              const isRunning = run.status === 'running';
              const isCompleted = run.status === 'completed';
              const isFailed = run.status === 'failed';
              const isGate = run.status === 'paused_approval';

              const cardBorder = isRunning
                ? 'border-blue-300 bg-blue-50/20 shadow-blue-500/5 ring-1 ring-blue-400'
                : isCompleted
                ? 'border-emerald-200 bg-emerald-50/10'
                : isFailed
                ? 'border-rose-300 bg-rose-50/20'
                : 'border-amber-300 bg-amber-50/20';

              const statusBadge = isRunning
                ? 'bg-blue-100 text-blue-800 border-blue-300 animate-pulse'
                : isCompleted
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : isFailed
                ? 'bg-rose-100 text-rose-800 border-rose-300'
                : 'bg-amber-100 text-amber-800 border-amber-300';

              const nodeStates = run.node_states || {};
              const nodeKeys = Object.keys(nodeStates);

              return (
                <div
                  key={run.run_id}
                  className={`p-4 rounded-xl border transition flex flex-col justify-between space-y-3.5 ${cardBorder}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono text-slate-500 font-bold uppercase block truncate">
                          {run.run_id}
                        </span>
                        <h3 className="text-xs font-bold text-slate-900 truncate mt-0.5" title={run.name}>
                          {run.name}
                        </h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 ${statusBadge}`}>
                        {run.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Active Step Progress */}
                    {isRunning && run.current_step_name && (
                      <div className="p-2 rounded-lg bg-blue-100/70 border border-blue-200 text-blue-900 text-[11px] flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping shrink-0" />
                        <span className="font-semibold truncate">Active: {run.current_step_name}</span>
                        {run.current_agent_id && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-200/80 shrink-0">
                            {run.current_agent_id}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Node status breakdown visual pills */}
                    {nodeKeys.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Node Statuses:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {nodeKeys.map((k) => {
                            const nState = nodeStates[k];
                            const nColor =
                              nState?.status === 'running'
                                ? 'bg-blue-500 text-white font-bold animate-pulse'
                                : nState?.status === 'completed'
                                ? 'bg-emerald-500 text-white'
                                : nState?.status === 'failed'
                                ? 'bg-rose-500 text-white'
                                : nState?.status === 'approval_required'
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-200 text-slate-700';

                            return (
                              <span
                                key={k}
                                className={`text-[9px] font-mono px-2 py-0.5 rounded-md flex items-center space-x-1 ${nColor}`}
                                title={`${k}: ${nState?.status} (${nState?.executionTimeMs ? `${nState.executionTimeMs}ms` : ''})`}
                              >
                                <span>{k}</span>
                                <span>●</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {run.final_summary && (
                      <p className="text-[11px] text-slate-600 bg-white/80 p-2 rounded border border-slate-100 line-clamp-2 leading-relaxed">
                        {run.final_summary}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{new Date(run.created_at).toLocaleTimeString()}</span>
                    </span>
                    <span className="font-semibold text-slate-700 font-mono">
                      {run.completed_steps ?? 0}/{run.total_steps ?? run.tasks?.length ?? 1} Steps
                      {run.execution_time_ms ? ` • ${run.execution_time_ms}ms` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Agent Fleet Explorer & Live Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Agents List with Live Status Badges */}
        <div className="space-y-3">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
            <button
              onClick={() => setFilterRole('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                filterRole === 'all' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              All ({agents.length})
            </button>
            <button
              onClick={() => setFilterRole('online')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                filterRole === 'online' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Online ({onlineAgentsCount})</span>
            </button>
            {offlineAgentsCount > 0 && (
              <button
                onClick={() => setFilterRole('offline')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer shrink-0 flex items-center space-x-1.5 ${
                  filterRole === 'offline' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                <span>Offline ({offlineAgentsCount})</span>
              </button>
            )}
            <button
              onClick={() => setFilterRole('orchestrator')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                filterRole === 'orchestrator' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Orchestrator
            </button>
            <button
              onClick={() => setFilterRole('property')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                filterRole === 'property' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Property
            </button>
            <button
              onClick={() => setFilterRole('outreach')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                filterRole === 'outreach' ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              Outreach
            </button>
          </div>

          <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
            {filteredAgents.map((agent) => {
              const Icon = roleIcons[agent.role] || Bot;
              const isSelected = selectedAgent.id === agent.id;
              const statusInfo = getAgentLiveStatus(agent.id);

              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex items-start space-x-3.5 ${
                    isSelected
                      ? 'bg-cyan-50/80 border-cyan-400 shadow-sm ring-1 ring-cyan-400'
                      : statusInfo.isOnline
                      ? 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                      : 'bg-slate-50/80 border-slate-200 opacity-75 hover:opacity-100'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    isSelected
                      ? 'bg-cyan-600 text-white'
                      : statusInfo.isOnline
                      ? 'bg-slate-100 text-cyan-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 truncate">
                        <span className="font-bold text-xs text-slate-900 truncate">{agent.name}</span>
                      </div>
                      <span className="text-[9px] font-mono text-cyan-800 bg-cyan-100/70 px-1.5 py-0.2 rounded uppercase font-bold shrink-0">
                        {agent.id}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{agent.primaryResponsibility}</p>

                    {/* Real-time Status Badge & Availability Switch */}
                    <div className="flex items-center justify-between mt-2.5 text-[10px]">
                      <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full font-semibold border ${statusInfo.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                        <span>{statusInfo.label}</span>
                      </span>

                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 font-mono text-[10px]">
                          {tasks.filter((t) => t.assigned_agent === agent.id).length} tasks
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleAgentAvailability(agent.id);
                          }}
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition cursor-pointer ${
                            statusInfo.isOnline
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                          title={`Toggle ${agent.name} online/offline state`}
                        >
                          {statusInfo.isOnline ? 'Set Off' : 'Set On'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Cols: Deep Inspector & Task Log Stream */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-6 shadow-xs">
          {/* Header & Status Banner */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">{selectedAgent.name}</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                  {selectedAgent.id}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                  {selectedAgent.model || 'gemini-3.5-flash'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{selectedAgent.description}</p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <span className={`inline-flex items-center space-x-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${selectedAgentStatus.badgeClass}`}>
                <span className={`w-2 h-2 rounded-full ${selectedAgentStatus.dotClass}`} />
                <span>{selectedAgentStatus.label}</span>
              </span>

              <button
                onClick={() => toggleAgentAvailability(selectedAgent.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition cursor-pointer ${
                  selectedAgentStatus.isOnline
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                {selectedAgentStatus.isOnline ? 'Set Standby (Offline)' : 'Activate (Online)'}
              </button>
            </div>
          </div>

          {/* Orchestration Availability & Health Metrics Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Radio className={`w-4 h-4 ${selectedAgentStatus.isOnline ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Orchestration Health &amp; Availability Diagnostics
                </h4>
              </div>

              <button
                onClick={() => handlePingAgent(selectedAgent.id)}
                disabled={isPinging}
                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer flex items-center space-x-1.5 self-start sm:self-auto"
              >
                <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin text-cyan-600' : 'text-slate-500'}`} />
                <span>{isPinging ? 'Pinging Node...' : 'Ping Agent Node'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Node Status</span>
                <span className={`font-bold inline-flex items-center space-x-1.5 mt-0.5 ${
                  selectedAgentStatus.isOnline ? 'text-emerald-700' : 'text-slate-500'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedAgentStatus.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                  <span>{selectedAgentStatus.shortLabel}</span>
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Heartbeat Latency</span>
                <span className="font-bold text-slate-900 mt-0.5 block font-mono">
                  {selectedAgentStatus.isOnline ? `${pingLatency[selectedAgent.id] ?? 8}ms SSE` : 'N/A (Offline)'}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">DAG Capability</span>
                <span className="font-bold text-cyan-800 mt-0.5 block">
                  {selectedAgentStatus.isOnline ? 'Ready for Dispatch' : 'Rerouted to Fallback'}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Orchestrator Parent</span>
                <span className="font-bold text-slate-700 mt-0.5 block font-mono text-[11px]">
                  {selectedAgent.parentAgentId || 'Master (Agent 1)'}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Responsibility */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Primary Responsibility</h3>
            <p className="text-xs text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
              {selectedAgent.primaryResponsibility}
            </p>
          </div>

          {/* System Instructions Prompt */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-600" />
              <span>System Prompt &amp; Behavioral Guidelines</span>
            </h3>
            <div className="text-xs text-slate-800 font-mono bg-slate-50 p-3.5 rounded-lg border border-slate-200 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
              {selectedAgent.systemInstructions}
            </div>
          </div>

          {/* Configuration Grid: Tools & Permissions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Wrench className="w-3.5 h-3.5 text-cyan-600" />
                <span>Allowed Tools ({selectedAgent.allowedTools?.length ?? 0})</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgent.allowedTools?.map((tool) => (
                  <span key={tool} className="text-[11px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                    {tool}()
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                <span>Security Permissions</span>
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedAgent.permissions?.map((perm) => (
                  <span key={perm} className="text-[11px] px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-800 font-mono">
                    {perm}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Tasks Executed by this Agent */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Recent Agent Tasks &amp; Telemetry Outputs ({selectedAgentTasks.length})</span>
              </h3>
            </div>

            {selectedAgentTasks.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                No individual tasks recorded for this agent yet. Run a workflow DAG to generate real-time execution telemetry.
              </div>
            ) : (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {selectedAgentTasks.slice(0, 5).map((t) => (
                  <div key={t.task_id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{t.objective}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase font-mono ${
                        t.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.status === 'running'
                          ? 'bg-blue-100 text-blue-800 animate-pulse'
                          : 'bg-rose-100 text-rose-800'
                      }`}>
                        {t.status}
                      </span>
                    </div>

                    {t.executionTimeMs && (
                      <div className="text-[11px] text-slate-500 flex items-center space-x-3">
                        <span>Latency: <strong>{t.executionTimeMs}ms</strong></span>
                        {t.confidence !== undefined && (
                          <span>Confidence: <strong>{Math.round(t.confidence * 100)}%</strong></span>
                        )}
                        <span>{new Date(t.created_at).toLocaleTimeString()}</span>
                      </div>
                    )}

                    {t.result && (
                      <div className="font-mono text-[10px] bg-white p-2 rounded border border-slate-200 text-slate-700 truncate">
                        Output: {JSON.stringify(t.result).slice(0, 140)}...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real-Time Agent Feedback & Live Instruction Thread */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-600" />
                <span>Live Feedback &amp; Instruction Thread ({selectedAgent.name})</span>
              </h3>
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Active Directives Channel
              </span>
            </div>

            <div className="bg-slate-900 rounded-xl p-4 space-y-3 shadow-inner">
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 font-sans text-xs">
                {(messagesMap[selectedAgent.id] || [
                  { id: 'default', sender: 'agent', text: `${selectedAgent.name} online and listening for instructions...`, timestamp: 'Just now' }
                ]).map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start space-x-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.sender === 'agent' && (
                      <div className="w-6 h-6 rounded-full bg-cyan-600 text-white flex items-center justify-center shrink-0 text-[10px] font-bold shadow-xs">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div
                      className={`p-3 rounded-xl max-w-[80%] space-y-1 ${
                        msg.sender === 'user'
                          ? 'bg-cyan-600 text-white rounded-tr-xs'
                          : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-xs'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-75 pb-0.5 border-b border-white/10">
                        <span className="font-bold">{msg.sender === 'user' ? 'You (Human Operator)' : selectedAgent.name}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="leading-relaxed text-[11px]">{msg.text}</p>
                    </div>
                    {msg.sender === 'user' && (
                      <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-200 flex items-center justify-center shrink-0 text-[10px] font-bold">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                ))}

                {isAgentTyping && (
                  <div className="flex items-center space-x-2 text-cyan-400 text-[11px] font-mono animate-pulse pl-8">
                    <span>{selectedAgent.name} is re-calibrating parameters and formulating response...</span>
                  </div>
                )}
              </div>

              {/* Message Input Form */}
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`Provide instructions or feedback to ${selectedAgent.name}...`}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isAgentTyping}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center space-x-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
        </div>
      )}
    </div>
  );
};

