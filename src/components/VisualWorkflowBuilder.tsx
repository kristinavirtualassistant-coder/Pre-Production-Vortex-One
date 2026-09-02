import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType,
  Connection,
  Edge,
  Node,
  NodeProps,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  BrainCircuit,
  Cpu,
  Building2,
  Users,
  Search,
  Sparkles,
  PhoneCall,
  BarChart3,
  ShieldAlert,
  Workflow as WorkflowIcon,
  CheckCheck,
  Play,
  Save,
  Trash2,
  Copy,
  Plus,
  ArrowRight,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  LayoutGrid,
  Zap,
  ShieldCheck,
  GripVertical,
  HelpCircle,
  FileCode,
  Layers,
  Sparkle,
  X,
  Radio,
  Check,
  ExternalLink,
  ChevronRight,
  Terminal,
  Clock,
  Square,
  Activity,
} from 'lucide-react';

import {
  Workflow,
  WorkflowStep,
  WorkflowStepType,
  AgentId,
  Task,
  WorkflowRun,
} from '../types';
import { useWorkflowRuns } from '../hooks/useWorkflowRuns';

// Palette definitions for dragging into the React Flow Canvas
export const PALETTE_AGENTS_LIST: Array<{
  id: AgentId | 'trigger_start' | 'gate_approval' | 'output_sink';
  nodeType: 'agentNode' | 'triggerNode' | 'gateNode' | 'outputNode';
  name: string;
  role: string;
  category: 'core' | 'intelligence' | 'outreach' | 'governance' | 'system';
  icon: any;
  color: string;
  badge: string;
  defaultObjective: string;
  defaultStepType: WorkflowStepType;
}> = [
  {
    id: 'trigger_start',
    nodeType: 'triggerNode',
    name: 'Workflow Trigger',
    role: 'Entrypoint / Webhook / Batch Input',
    category: 'system',
    icon: Zap,
    color: 'border-amber-500 bg-amber-50 text-amber-800',
    badge: 'Trigger',
    defaultObjective: 'Initiate pipeline on inbound target criteria or batch schedule.',
    defaultStepType: 'SEQUENTIAL',
  },
  {
    id: 'agent_1',
    nodeType: 'agentNode',
    name: 'Agent 1: Master Orchestrator',
    role: 'Decomposition, Planning & Synthesis',
    category: 'core',
    icon: BrainCircuit,
    color: 'border-cyan-500 bg-cyan-50 text-cyan-800',
    badge: 'Orchestrator',
    defaultObjective: 'Analyze user intent, construct DAG plan, and coordinate domain sub-agents.',
    defaultStepType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_0',
    nodeType: 'agentNode',
    name: 'Sub-Agent 0: System Reasoning',
    role: 'Hypothesis Formulation & Graph Logic',
    category: 'core',
    icon: Cpu,
    color: 'border-indigo-500 bg-indigo-50 text-indigo-800',
    badge: 'Reasoning',
    defaultObjective: 'Formulate hypotheses and analyze non-linear cross-domain constraints.',
    defaultStepType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_1',
    nodeType: 'agentNode',
    name: 'Sub-Agent 1: Property Cadastre',
    role: 'Parcels, Equity, Absentee Deeds',
    category: 'intelligence',
    icon: Building2,
    color: 'border-blue-500 bg-blue-50 text-blue-800',
    badge: 'Cadastre',
    defaultObjective: 'Identify high-equity absentee and multi-family commercial parcels in target market.',
    defaultStepType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_4',
    nodeType: 'agentNode',
    name: 'Sub-Agent 4: Entity Normalization',
    role: 'LLC/Trust Entity Resolution',
    category: 'intelligence',
    icon: Sparkles,
    color: 'border-amber-500 bg-amber-50 text-amber-800',
    badge: 'Normalization',
    defaultObjective: 'Resolve corporate LLC/Trust ownership structures and normalize mailing addresses.',
    defaultStepType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_2',
    nodeType: 'agentNode',
    name: 'Sub-Agent 2: Lead & CRM Intel',
    role: 'Scoring & Qualification Factors',
    category: 'intelligence',
    icon: Users,
    color: 'border-emerald-500 bg-emerald-50 text-emerald-800',
    badge: 'Lead Scoring',
    defaultObjective: 'Calculate explainable 0-100 property management viability scores.',
    defaultStepType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_3',
    nodeType: 'agentNode',
    name: 'Sub-Agent 3: Structured Research',
    role: 'Public Records & Comparables',
    category: 'intelligence',
    icon: Search,
    color: 'border-violet-500 bg-violet-50 text-violet-800',
    badge: 'Research',
    defaultObjective: 'Search county records, tax history, and commercial rent roll comparables.',
    defaultStepType: 'PARALLEL',
  },
  {
    id: 'sub_agent_6',
    nodeType: 'agentNode',
    name: 'Sub-Agent 6: Analytics & KPIs',
    role: 'Portfolio ROI & NOI Forecasting',
    category: 'intelligence',
    icon: BarChart3,
    color: 'border-sky-500 bg-sky-50 text-sky-800',
    badge: 'Analytics',
    defaultObjective: 'Calculate portfolio ROI, cap rates, NOI upside, and management fee projections.',
    defaultStepType: 'PARALLEL',
  },
  {
    id: 'sub_agent_5',
    nodeType: 'agentNode',
    name: 'Sub-Agent 5: Outreach & TTS Voice',
    role: 'Pitch Strategy & Voice Briefings',
    category: 'outreach',
    icon: PhoneCall,
    color: 'border-rose-500 bg-rose-50 text-rose-800',
    badge: 'Outreach & Voice',
    defaultObjective: 'Synthesize custom objection counters, pitch brief, and audio briefing via Gemini TTS.',
    defaultStepType: 'SEQUENTIAL',
  },
  {
    id: 'gate_approval',
    nodeType: 'gateNode',
    name: 'Human Sign-Off Gate',
    role: 'TCPA & Policy Review Gate',
    category: 'governance',
    icon: ShieldAlert,
    color: 'border-orange-500 bg-orange-50 text-orange-800',
    badge: 'Approval Gate',
    defaultObjective: 'Pause automation for human administrator sign-off before proceeding.',
    defaultStepType: 'HUMAN_APPROVAL',
  },
  {
    id: 'sub_agent_7',
    nodeType: 'agentNode',
    name: 'Sub-Agent 7: Compliance & TCPA',
    role: 'DNC Registry & Calling Hours',
    category: 'governance',
    icon: ShieldAlert,
    color: 'border-orange-500 bg-orange-50 text-orange-800',
    badge: 'TCPA Gatekeeper',
    defaultObjective: 'Audit calling lists against National DNC registry and TCPA regulations.',
    defaultStepType: 'HUMAN_APPROVAL',
  },
  {
    id: 'sub_agent_8',
    nodeType: 'agentNode',
    name: 'Sub-Agent 8: Automation & Sync',
    role: 'CRM & Telephony Dialer Dispatch',
    category: 'outreach',
    icon: WorkflowIcon,
    color: 'border-teal-500 bg-teal-50 text-teal-800',
    badge: 'Automation',
    defaultObjective: 'Sync approved prospect batches into active dialer queue and CRM records.',
    defaultStepType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_9',
    nodeType: 'agentNode',
    name: 'Sub-Agent 9: QA & Independent Audit',
    role: 'Mathematical Provenance & Hallucination Check',
    category: 'governance',
    icon: CheckCheck,
    color: 'border-purple-500 bg-purple-50 text-purple-800',
    badge: 'QA Audit',
    defaultObjective: 'Perform independent mathematical validation and factual provenance audit.',
    defaultStepType: 'SEQUENTIAL',
  },
  {
    id: 'output_sink',
    nodeType: 'outputNode',
    name: 'Terminal Output & CRM Sync',
    role: 'Completed Artifact Dispatch',
    category: 'system',
    icon: CheckCircle2,
    color: 'border-emerald-500 bg-emerald-50 text-emerald-800',
    badge: 'Output Sink',
    defaultObjective: 'Finalize output dossier and trigger downstream property CRM records.',
    defaultStepType: 'SEQUENTIAL',
  },
];

// Node Data Structure
export interface CustomNodeData extends Record<string, unknown> {
  label: string;
  assignedAgent: AgentId | string;
  stepType: WorkflowStepType;
  objective: string;
  requiresApproval: boolean;
  condition?: string;
  status?: 'idle' | 'running' | 'completed' | 'failed' | 'approval_required';
  executionTimeMs?: number;
  confidence?: number;
  resultSummary?: string;
  error?: string;
  startedAt?: string;
  onUpdate?: (updatedFields: Partial<CustomNodeData>) => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

// -------------------------------------------------------------
// 1. Custom Node Components for React Flow with Color-Coded States
// -------------------------------------------------------------

// Main Sub-Agent Node
const AgentCustomNode: React.FC<NodeProps<Node<CustomNodeData>>> = ({ id, data, selected }) => {
  const agentInfo = PALETTE_AGENTS_LIST.find((a) => a.id === data.assignedAgent);
  const Icon = agentInfo?.icon || WorkflowIcon;

  // Determine dynamic color styling based on status
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';
  const isFailed = data.status === 'failed';
  const isApprovalRequired = data.status === 'approval_required' || (data.requiresApproval && isRunning);

  let borderRingClass = 'border-slate-200 hover:border-slate-300 bg-white shadow-xs';
  let headerBgClass = 'bg-slate-50/80 border-b border-slate-100 text-slate-900';
  let handleColorClass = '!bg-slate-400 hover:!bg-cyan-600';

  if (isRunning) {
    // ACTIVE BLUE / CYAN STATE
    borderRingClass = 'border-cyan-500 ring-4 ring-cyan-500/40 shadow-lg shadow-cyan-500/20 bg-gradient-to-b from-cyan-50/40 via-white to-blue-50/20 animate-pulse';
    headerBgClass = 'bg-gradient-to-r from-cyan-600 to-blue-600 border-b border-cyan-400 text-white';
    handleColorClass = '!bg-cyan-500 !border-2 !border-white';
  } else if (isCompleted) {
    // SUCCESS GREEN / EMERALD STATE
    borderRingClass = 'border-emerald-500 ring-2 ring-emerald-500/30 shadow-md shadow-emerald-500/10 bg-gradient-to-b from-emerald-50/30 via-white to-white';
    headerBgClass = 'bg-emerald-50/90 border-b border-emerald-200 text-emerald-950';
    handleColorClass = '!bg-emerald-500 !border-2 !border-white';
  } else if (isApprovalRequired) {
    // GATE ORANGE / AMBER STATE
    borderRingClass = 'border-amber-500 ring-4 ring-amber-500/40 shadow-lg shadow-amber-500/20 bg-amber-50/40 animate-pulse';
    headerBgClass = 'bg-amber-100/90 border-b border-amber-300 text-amber-950';
    handleColorClass = '!bg-amber-500 !border-2 !border-white';
  } else if (isFailed) {
    // ERROR RED / ROSE STATE
    borderRingClass = 'border-rose-500 ring-4 ring-rose-500/40 shadow-lg shadow-rose-500/20 bg-rose-50/30';
    headerBgClass = 'bg-rose-100/90 border-b border-rose-300 text-rose-950';
    handleColorClass = '!bg-rose-500 !border-2 !border-white';
  } else if (selected) {
    borderRingClass = 'border-cyan-500 ring-4 ring-cyan-500/25 shadow-md bg-white';
  }

  return (
    <div className={`w-76 rounded-xl border-2 transition-all group relative font-sans ${borderRingClass}`}>
      {/* Target Connection Handles (Top & Left) */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className={`!w-3 !h-3 transition-colors ${handleColorClass}`}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className={`!w-3 !h-3 transition-colors ${handleColorClass}`}
      />

      {/* Node Header */}
      <div className={`p-3 rounded-t-[10px] flex items-center justify-between transition-colors ${headerBgClass}`}>
        <div className="flex items-center space-x-2 truncate">
          <div className={`p-1.5 rounded-lg border shadow-2xs shrink-0 ${
            isRunning ? 'bg-white/20 border-white/40 text-white' : isCompleted ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-800'
          }`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className={`text-xs font-bold truncate leading-tight ${isRunning ? 'text-white' : ''}`}>{data.label}</div>
            <div className={`text-[10px] font-mono truncate ${isRunning ? 'text-cyan-100' : 'text-slate-500'}`}>{data.assignedAgent}</div>
          </div>
        </div>

        {/* Real-time Status indicator & Mode Badges */}
        <div className="shrink-0 flex items-center space-x-1">
          {isRunning && (
            <span className="flex items-center space-x-1 text-[9px] font-bold text-white bg-cyan-700/80 px-2 py-0.5 rounded-full border border-white/30 shadow-2xs animate-pulse">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" />
              <span>ACTIVE</span>
            </span>
          )}
          {isCompleted && (
            <span className="flex items-center space-x-1 text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full shadow-2xs">
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
              <span>{data.executionTimeMs ? `${data.executionTimeMs}ms` : 'DONE'}</span>
            </span>
          )}
          {isApprovalRequired && (
            <span className="flex items-center space-x-1 text-[9px] font-bold text-amber-900 bg-amber-200 border border-amber-400 px-2 py-0.5 rounded-full shadow-2xs animate-bounce">
              <ShieldAlert className="w-2.5 h-2.5 text-amber-700 shrink-0" />
              <span>GATE</span>
            </span>
          )}
          {isFailed && (
            <span className="flex items-center space-x-1 text-[9px] font-bold text-rose-800 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded-full shadow-2xs">
              <AlertTriangle className="w-2.5 h-2.5 text-rose-600 shrink-0" />
              <span>FAIL</span>
            </span>
          )}

          {(!data.status || data.status === 'idle') && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider border ${
                data.stepType === 'PARALLEL'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : data.stepType === 'CONDITIONAL'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : data.stepType === 'HUMAN_APPROVAL'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {data.stepType}
            </span>
          )}
        </div>
      </div>

      {/* Active running pulse line */}
      {isRunning && (
        <div className="h-1 w-full bg-cyan-200 overflow-hidden">
          <div className="h-full bg-cyan-600 animate-indeterminate w-1/3 rounded-full" />
        </div>
      )}

      {/* Node Body / Objective & Results */}
      <div className="p-3 space-y-2 text-xs">
        <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/60 p-1.5 rounded border border-slate-100">
          {data.objective || 'No objective configured.'}
        </p>

        {data.requiresApproval && (
          <div className="flex items-center space-x-1.5 text-[10px] font-semibold text-amber-800 bg-amber-50/80 px-2 py-1 rounded border border-amber-200/80">
            <ShieldAlert className="w-3 h-3 text-amber-600 shrink-0" />
            <span>Enforces human admin sign-off</span>
          </div>
        )}

        {/* Live Result Summary Banner */}
        {data.resultSummary && (
          <div className="text-[10px] text-slate-700 bg-emerald-50/60 border border-emerald-200 p-1.5 rounded font-mono truncate flex items-center justify-between">
            <span className="truncate">{data.resultSummary}</span>
            {data.confidence !== undefined && (
              <span className="text-[9px] font-bold text-emerald-800 bg-emerald-200/80 px-1.5 py-0.5 rounded ml-1 shrink-0">
                {Math.round(data.confidence * 100)}% Conf
              </span>
            )}
          </div>
        )}

        {/* Error Banner */}
        {data.error && (
          <div className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 p-1.5 rounded font-mono truncate">
            {data.error}
          </div>
        )}
      </div>

      {/* Source Connection Handles (Bottom & Right) */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className={`!w-3 !h-3 transition-colors ${handleColorClass}`}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className={`!w-3 !h-3 transition-colors ${handleColorClass}`}
      />
    </div>
  );
};

// Trigger Entry Node
const TriggerCustomNode: React.FC<NodeProps<Node<CustomNodeData>>> = ({ data, selected }) => {
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';

  return (
    <div
      className={`w-64 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border-2 transition-all shadow-sm font-sans ${
        isRunning
          ? 'border-cyan-500 ring-4 ring-cyan-500/30 animate-pulse'
          : isCompleted
          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
          : selected
          ? 'border-amber-500 ring-4 ring-amber-500/20'
          : 'border-amber-300 hover:border-amber-400'
      }`}
    >
      <div className="p-3 flex items-center justify-between border-b border-amber-200/60">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-amber-500 text-white shadow-2xs">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-950">{data.label}</div>
            <div className="text-[9px] font-mono text-amber-700">PIPELINE ENTRYPOINT</div>
          </div>
        </div>

        {isCompleted && (
          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-full flex items-center space-x-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
            <span>TRIGGERED</span>
          </span>
        )}
      </div>
      <div className="p-2.5 text-[11px] text-amber-900/80 leading-tight">
        {data.objective || 'List ingestion or scheduled query criteria.'}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="!w-3 !h-3 !bg-amber-600 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!w-3 !h-3 !bg-amber-600 !border-2 !border-white"
      />
    </div>
  );
};

// Gate Approval Node
const GateCustomNode: React.FC<NodeProps<Node<CustomNodeData>>> = ({ data, selected }) => {
  const isRunning = data.status === 'running' || data.status === 'approval_required';
  const isCompleted = data.status === 'completed';

  return (
    <div
      className={`w-64 bg-gradient-to-br from-orange-50 to-rose-50 rounded-xl border-2 transition-all shadow-sm font-sans ${
        isRunning
          ? 'border-amber-500 ring-4 ring-amber-500/40 shadow-lg animate-pulse'
          : isCompleted
          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
          : selected
          ? 'border-orange-500 ring-4 ring-orange-500/20'
          : 'border-orange-300 hover:border-orange-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white"
      />

      <div className="p-3 flex items-center justify-between border-b border-orange-200/60">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-orange-600 text-white shadow-2xs">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-orange-950">{data.label}</div>
            <div className="text-[9px] font-mono text-orange-700">TCPA / HUMAN GATE</div>
          </div>
        </div>

        {isRunning && (
          <span className="text-[9px] font-bold text-amber-900 bg-amber-200 border border-amber-400 px-1.5 py-0.5 rounded-full flex items-center space-x-1 animate-bounce">
            <ShieldAlert className="w-2.5 h-2.5 text-amber-700" />
            <span>PAUSED</span>
          </span>
        )}
        {isCompleted && (
          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-full flex items-center space-x-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
            <span>APPROVED</span>
          </span>
        )}
      </div>
      <div className="p-2.5 text-[11px] text-orange-900/80 leading-tight">
        {data.objective || 'Pauses execution until admin signs off in Approvals Queue.'}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="!w-3 !h-3 !bg-orange-600 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!w-3 !h-3 !bg-orange-600 !border-2 !border-white"
      />
    </div>
  );
};

// Output Sink Node
const OutputCustomNode: React.FC<NodeProps<Node<CustomNodeData>>> = ({ data, selected }) => {
  const isRunning = data.status === 'running';
  const isCompleted = data.status === 'completed';

  return (
    <div
      className={`w-64 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border-2 transition-all shadow-sm font-sans ${
        isRunning
          ? 'border-cyan-500 ring-4 ring-cyan-500/30 animate-pulse'
          : isCompleted
          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
          : selected
          ? 'border-emerald-500 ring-4 ring-emerald-500/20'
          : 'border-emerald-300 hover:border-emerald-400'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!w-3 !h-3 !bg-emerald-500 !border-2 !border-white"
      />

      <div className="p-3 flex items-center justify-between border-b border-emerald-200/60">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-emerald-600 text-white shadow-2xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-emerald-950">{data.label}</div>
            <div className="text-[9px] font-mono text-emerald-700">OUTPUT / CRM DISPATCH</div>
          </div>
        </div>

        {isCompleted && (
          <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-full flex items-center space-x-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
            <span>DISPATCHED</span>
          </span>
        )}
      </div>
      <div className="p-2.5 text-[11px] text-emerald-900/80 leading-tight">
        {data.objective || 'Dispatches outputs into active dialer queue & CRM logs.'}
      </div>
    </div>
  );
};

// Register custom node types
const nodeTypes = {
  agentNode: AgentCustomNode,
  triggerNode: TriggerCustomNode,
  gateNode: GateCustomNode,
  outputNode: OutputCustomNode,
};

// Preset DAG Graphs
const PRESET_DAGS: Record<
  string,
  { name: string; description: string; nodes: Node<CustomNodeData>[]; edges: Edge[] }
> = {
  absentee_prospecting: {
    name: 'Absentee Portfolio Discovery & Scoring DAG',
    description: 'Multi-branch sequential and parallel pipeline identifying absentee owners, scoring viability, synthesizing pitch briefs, and verifying data.',
    nodes: [
      {
        id: 'node_trigger',
        type: 'triggerNode',
        position: { x: 380, y: 30 },
        data: {
          label: 'County Parcel Ingestion Trigger',
          assignedAgent: 'trigger_start',
          stepType: 'SEQUENTIAL',
          objective: 'Ingest Orange County parcels with equity >$1M and multi-property absentee ownership.',
          requiresApproval: false,
        },
      },
      {
        id: 'node_sub1',
        type: 'agentNode',
        position: { x: 360, y: 170 },
        data: {
          label: 'Property Cadastre & Absentee Filter',
          assignedAgent: 'sub_agent_1',
          stepType: 'SEQUENTIAL',
          objective: 'Filter cadastral parcels for corporate LLC and out-of-state owner structures.',
          requiresApproval: false,
        },
      },
      {
        id: 'node_sub4',
        type: 'agentNode',
        position: { x: 360, y: 330 },
        data: {
          label: 'LLC Entity & Address Resolution',
          assignedAgent: 'sub_agent_4',
          stepType: 'SEQUENTIAL',
          objective: 'Match LLC entity members and normalize postal delivery coordinates.',
          requiresApproval: false,
        },
      },
      {
        id: 'node_sub2',
        type: 'agentNode',
        position: { x: 180, y: 490 },
        data: {
          label: 'Explainable Viability Scoring',
          assignedAgent: 'sub_agent_2',
          stepType: 'PARALLEL',
          objective: 'Compute 0-100 property management viability scores with factor breakdowns.',
          requiresApproval: false,
        },
      },
      {
        id: 'node_sub3',
        type: 'agentNode',
        position: { x: 540, y: 490 },
        data: {
          label: 'Market Comparables Research',
          assignedAgent: 'sub_agent_3',
          stepType: 'PARALLEL',
          objective: 'Retrieve recent commercial lease comps and historical tax assessments.',
          requiresApproval: false,
        },
      },
      {
        id: 'node_sub5',
        type: 'agentNode',
        position: { x: 360, y: 660 },
        data: {
          label: 'Pitch Formulation & Voice TTS',
          assignedAgent: 'sub_agent_5',
          stepType: 'SEQUENTIAL',
          objective: 'Synthesize custom objection counters, rent roll analysis, and audio briefing.',
          requiresApproval: false,
        },
      },
      {
        id: 'node_gate7',
        type: 'gateNode',
        position: { x: 375, y: 820 },
        data: {
          label: 'TCPA & Human Sign-Off Gate',
          assignedAgent: 'sub_agent_7',
          stepType: 'HUMAN_APPROVAL',
          objective: 'Verify National DNC registry and require admin sign-off before dialer sync.',
          requiresApproval: true,
        },
      },
      {
        id: 'node_sub9',
        type: 'agentNode',
        position: { x: 360, y: 970 },
        data: {
          label: 'QA Provenance & Math Audit',
          assignedAgent: 'sub_agent_9',
          stepType: 'SEQUENTIAL',
          objective: 'Perform independent mathematical check and source verification against county records.',
          requiresApproval: false,
        },
      },
      {
        id: 'node_output',
        type: 'outputNode',
        position: { x: 375, y: 1130 },
        data: {
          label: 'CRM & Dialer Sync Dispatch',
          assignedAgent: 'output_sink',
          stepType: 'SEQUENTIAL',
          objective: 'Sync approved leads into active dialer queue and record immutable audit trail.',
          requiresApproval: false,
        },
      },
    ],
    edges: [
      {
        id: 'e1',
        source: 'node_trigger',
        target: 'node_sub1',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2' },
        style: { stroke: '#0891b2', strokeWidth: 2 },
      },
      {
        id: 'e2',
        source: 'node_sub1',
        target: 'node_sub4',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2' },
        style: { stroke: '#0891b2', strokeWidth: 2 },
      },
      {
        id: 'e3_left',
        source: 'node_sub4',
        target: 'node_sub2',
        type: 'smoothstep',
        label: 'Parallel Branch A',
        labelStyle: { fontSize: '10px', fill: '#64748b', fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
        style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '4 4' },
      },
      {
        id: 'e3_right',
        source: 'node_sub4',
        target: 'node_sub3',
        type: 'smoothstep',
        label: 'Parallel Branch B',
        labelStyle: { fontSize: '10px', fill: '#64748b', fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8b5cf6' },
        style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '4 4' },
      },
      {
        id: 'e4_left',
        source: 'node_sub2',
        target: 'node_sub5',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2' },
        style: { stroke: '#0891b2', strokeWidth: 2 },
      },
      {
        id: 'e4_right',
        source: 'node_sub3',
        target: 'node_sub5',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2' },
        style: { stroke: '#0891b2', strokeWidth: 2 },
      },
      {
        id: 'e5',
        source: 'node_sub5',
        target: 'node_gate7',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#ea580c' },
        style: { stroke: '#ea580c', strokeWidth: 2 },
      },
      {
        id: 'e6',
        source: 'node_gate7',
        target: 'node_sub9',
        type: 'smoothstep',
        label: 'On Admin Approval',
        labelStyle: { fontSize: '10px', fill: '#ea580c', fontWeight: 600 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2' },
        style: { stroke: '#0891b2', strokeWidth: 2 },
      },
      {
        id: 'e7',
        source: 'node_sub9',
        target: 'node_output',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
        style: { stroke: '#10b981', strokeWidth: 2 },
      },
    ],
  },
  executive_briefing: {
    name: 'Executive Pitch & TTS Voice Audio Briefing Pipeline',
    description: 'High-touch outreach sequence generating customized pitch scripts, objection counters, and audio voice briefings.',
    nodes: [
      {
        id: 'node_exec_trigger',
        type: 'triggerNode',
        position: { x: 380, y: 30 },
        data: {
          label: 'VIP Portfolio Lead Selected',
          assignedAgent: 'trigger_start',
          stepType: 'SEQUENTIAL',
          objective: 'Target lead: Jonathan Sterling (Sterling West Holdings LLC).',
          requiresApproval: false,
        },
      },
      {
        id: 'node_exec_sub2',
        type: 'agentNode',
        position: { x: 360, y: 170 },
        data: {
          label: 'Portfolio Profile & Equity Lookup',
          assignedAgent: 'sub_agent_2',
          stepType: 'SEQUENTIAL',
          objective: 'Lookup property history, estimated equity, and historical management tenure.',
          requiresApproval: false,
        },
      },
      {
        id: 'node_exec_sub5',
        type: 'agentNode',
        position: { x: 360, y: 330 },
        data: {
          label: 'Outreach Pitch & TTS Synthesis',
          assignedAgent: 'sub_agent_5',
          stepType: 'SEQUENTIAL',
          objective: 'Synthesize custom pitch brief and generate realistic agent audio briefing.',
          requiresApproval: false,
        },
      },
      {
        id: 'node_exec_sub9',
        type: 'agentNode',
        position: { x: 360, y: 490 },
        data: {
          label: 'QA Provenance Verification',
          assignedAgent: 'sub_agent_9',
          stepType: 'SEQUENTIAL',
          objective: 'Verify factual statements in pitch brief against official records.',
          requiresApproval: false,
        },
      },
      {
        id: 'node_exec_output',
        type: 'outputNode',
        position: { x: 375, y: 640 },
        data: {
          label: 'Audio Briefing Dossier Ready',
          assignedAgent: 'output_sink',
          stepType: 'SEQUENTIAL',
          objective: 'Present interactive audio player and call sheet to dialer operator.',
          requiresApproval: false,
        },
      },
    ],
    edges: [
      {
        id: 'exec_e1',
        source: 'node_exec_trigger',
        target: 'node_exec_sub2',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2' },
        style: { stroke: '#0891b2', strokeWidth: 2 },
      },
      {
        id: 'exec_e2',
        source: 'node_exec_sub2',
        target: 'node_exec_sub5',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2' },
        style: { stroke: '#0891b2', strokeWidth: 2 },
      },
      {
        id: 'exec_e3',
        source: 'node_exec_sub5',
        target: 'node_exec_sub9',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2' },
        style: { stroke: '#0891b2', strokeWidth: 2 },
      },
      {
        id: 'exec_e4',
        source: 'node_exec_sub9',
        target: 'node_exec_output',
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
        style: { stroke: '#10b981', strokeWidth: 2 },
      },
    ],
  },
};

// -------------------------------------------------------------
// 2. Main Builder Component Inner Content
// -------------------------------------------------------------

interface VisualWorkflowBuilderProps {
  initialWorkflow?: Workflow;
  onWorkflowSaved?: (wf: Workflow) => void;
  onRunLiveDAG?: (steps: WorkflowStep[]) => void;
  onStateUpdate?: (run: WorkflowRun) => void;
}

const VisualWorkflowBuilderInner: React.FC<VisualWorkflowBuilderProps> = ({
  initialWorkflow,
  onWorkflowSaved,
  onRunLiveDAG,
  onStateUpdate,
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow();

  // Active DAG state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<CustomNodeData>>(
    PRESET_DAGS.absentee_prospecting.nodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    PRESET_DAGS.absentee_prospecting.edges
  );

  const [workflowTitle, setWorkflowTitle] = useState<string>(
    initialWorkflow?.name || 'Absentee Portfolio Discovery & Scoring DAG'
  );
  const [workflowDesc, setWorkflowDesc] = useState<string>(
    initialWorkflow?.description || 'Custom defined visual multi-agent workflow DAG.'
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'palette' | 'presets' | 'execution'>('palette');
  const [isLiveRunning, setIsLiveRunning] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [executionStartTime, setExecutionStartTime] = useState<number | null>(null);
  const [liveDurationMs, setLiveDurationMs] = useState<number>(0);
  const [currentActiveStepName, setCurrentActiveStepName] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Real-time run state polling & synchronization using SWR
  const [selectedRunId, setSelectedRunId] = useState<string>('live');
  const [isAutoPolling, setIsAutoPolling] = useState<boolean>(true);

  const {
    runs: availableRuns,
    isLoading: isPollingLoading,
    refresh: fetchRunsTelemetry,
  } = useWorkflowRuns({
    limit: 10,
    refreshInterval: 2500,
    enabled: isAutoPolling && !isLiveRunning,
  });

  // Live timer tick during execution
  useEffect(() => {
    let interval: any = null;
    if (isLiveRunning && executionStartTime) {
      interval = setInterval(() => {
        setLiveDurationMs(Date.now() - executionStartTime);
      }, 50);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isLiveRunning, executionStartTime]);

  // Helper to dynamically color edges according to connected node statuses
  const updateEdgesForNodeStatuses = useCallback(
    (currentNodes: Node<CustomNodeData>[], currentEdges: Edge[]): Edge[] => {
      const nodeStatusMap: Record<string, string> = {};
      currentNodes.forEach((n) => {
        nodeStatusMap[n.id] = n.data.status || 'idle';
      });

      return currentEdges.map((edge) => {
        const srcStatus = nodeStatusMap[edge.source] || 'idle';
        const tgtStatus = nodeStatusMap[edge.target] || 'idle';

        if (srcStatus === 'running' || tgtStatus === 'running') {
          return {
            ...edge,
            animated: true,
            style: {
              ...edge.style,
              stroke: '#06b6d4',
              strokeWidth: 3,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#06b6d4',
            },
          };
        } else if (srcStatus === 'completed' && (tgtStatus === 'completed' || tgtStatus === 'running')) {
          return {
            ...edge,
            animated: tgtStatus === 'running',
            style: {
              ...edge.style,
              stroke: '#10b981',
              strokeWidth: 2.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#10b981',
            },
          };
        } else if (srcStatus === 'failed' || tgtStatus === 'failed') {
          return {
            ...edge,
            animated: false,
            style: {
              ...edge.style,
              stroke: '#f43f5e',
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#f43f5e',
            },
          };
        } else {
          return {
            ...edge,
            animated: false,
            style: {
              ...edge.style,
              stroke: '#94a3b8',
              strokeWidth: 1.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#94a3b8',
            },
          };
        }
      });
    },
    []
  );

  // Execution Telemetry State
  const [executionTelemetry, setExecutionTelemetry] = useState<{
    status: 'idle' | 'running' | 'completed' | 'failed';
    completedSteps: number;
    totalSteps: number;
    tasks: Task[];
    stepOutputs: Record<string, any>;
  }>({
    status: 'idle',
    completedSteps: 0,
    totalSteps: 0,
    tasks: [],
    stepOutputs: {},
  });

  // Apply a WorkflowRun snapshot to current React Flow canvas nodes & edges
  const applyWorkflowRunToCanvas = useCallback(
    (run: WorkflowRun) => {
      const nodeStates = run.node_states || {};

      setNodes((currentNodes) => {
        const updated = currentNodes.map((n) => {
          // Find matching state by node id, or by assignedAgent, or by step key
          const directMatch = nodeStates[n.id];
          const agentMatch = Object.values(nodeStates).find(
            (ns: any) => ns?.agentId === n.data.assignedAgent
          );
          const matched: any = directMatch || agentMatch;

          if (matched) {
            return {
              ...n,
              data: {
                ...n.data,
                status: matched.status,
                executionTimeMs: matched.executionTimeMs,
                confidence: matched.confidence,
                resultSummary: matched.resultSummary,
                error: matched.error,
              },
            };
          }
          return n;
        });

        // Update edge styles to reflect node statuses
        setEdges((eds) => updateEdgesForNodeStatuses(updated, eds));
        return updated;
      });

      // Update telemetry card
      setExecutionTelemetry({
        status: run.status === 'running' ? 'running' : run.status === 'completed' ? 'completed' : run.status === 'failed' ? 'failed' : 'idle',
        completedSteps: run.completed_steps || 0,
        totalSteps: run.total_steps || run.tasks?.length || 1,
        tasks: run.tasks || [],
        stepOutputs: run.step_outputs || {},
      });

      // Notify consumer callback if subscribed
      if (onStateUpdate) {
        onStateUpdate(run);
      }
    },
    [onStateUpdate, updateEdgesForNodeStatuses, setEdges, setNodes]
  );

  // Automatically apply selected run or live active run to canvas when SWR delivers fresh data
  useEffect(() => {
    if (isLiveRunning || availableRuns.length === 0) return;

    if (selectedRunId === 'live') {
      const activeRun = availableRuns.find(
        (r: WorkflowRun) => r.status === 'running' || r.status === 'paused_approval'
      );
      if (activeRun) {
        applyWorkflowRunToCanvas(activeRun);
      }
    } else {
      const targetRun = availableRuns.find((r: WorkflowRun) => r.run_id === selectedRunId);
      if (targetRun) {
        applyWorkflowRunToCanvas(targetRun);
      }
    }
  }, [availableRuns, selectedRunId, isLiveRunning, applyWorkflowRunToCanvas]);

  // Handle manual selection of a specific run from the dropdown
  const handleSelectRun = (runId: string) => {
    setSelectedRunId(runId);
    if (runId === 'live') {
      const activeRun = availableRuns.find((r) => r.status === 'running' || r.status === 'paused_approval');
      if (activeRun) {
        applyWorkflowRunToCanvas(activeRun);
      }
    } else {
      const targetRun = availableRuns.find((r) => r.run_id === runId);
      if (targetRun) {
        applyWorkflowRunToCanvas(targetRun);
      }
    }
  };

  // Connect edges
  const onConnect = useCallback(
    (params: Connection) => {
      const isParallel = params.source?.includes('sub4') || params.target?.includes('sub3');
      const newEdge: Edge = {
        ...params,
        id: `e_${params.source}_${params.target}_${Date.now()}`,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isParallel ? '#8b5cf6' : '#0891b2',
        },
        style: {
          stroke: isParallel ? '#8b5cf6' : '#0891b2',
          strokeWidth: 2,
          strokeDasharray: isParallel ? '4 4' : undefined,
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  // Handle edge selection
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  // Drag over canvas handler
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Drop onto canvas handler
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const dataStr = event.dataTransfer.getData('application/json');
      if (!dataStr) return;

      try {
        const item = JSON.parse(dataStr);
        if (!item || !item.nodeType) return;

        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNodeId = `node_${item.id}_${Date.now()}`;
        const newNode: Node<CustomNodeData> = {
          id: newNodeId,
          type: item.nodeType,
          position,
          data: {
            label: item.name.replace(/.*:\s*/, ''),
            assignedAgent: item.id,
            stepType: item.defaultStepType || 'SEQUENTIAL',
            objective: item.defaultObjective || 'Execute sub-agent task',
            requiresApproval: item.defaultStepType === 'HUMAN_APPROVAL',
            status: 'idle',
          },
        };

        setNodes((nds) => nds.concat(newNode));
        setSelectedNodeId(newNodeId);
      } catch (err) {
        console.error('Error dropping node:', err);
      }
    },
    [screenToFlowPosition, setNodes]
  );

  // Add node via click
  const handleAddNodeFromPalette = (item: typeof PALETTE_AGENTS_LIST[0]) => {
    const existingCount = nodes.length;
    const xPos = 250 + (existingCount % 3) * 160;
    const yPos = 100 + Math.floor(existingCount / 3) * 140;

    const newNodeId = `node_${item.id}_${Date.now()}`;
    const newNode: Node<CustomNodeData> = {
      id: newNodeId,
      type: item.nodeType,
      position: { x: xPos, y: yPos },
      data: {
        label: item.name.replace(/.*:\s*/, ''),
        assignedAgent: item.id,
        stepType: item.defaultStepType || 'SEQUENTIAL',
        objective: item.defaultObjective || 'Execute sub-agent task',
        requiresApproval: item.defaultStepType === 'HUMAN_APPROVAL',
        status: 'idle',
      },
    };

    setNodes((nds) => nds.concat(newNode));
    setSelectedNodeId(newNodeId);
  };

  // Delete selected node
  const handleDeleteSelected = () => {
    if (selectedNodeId) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
      );
      setSelectedNodeId(null);
    } else if (selectedEdgeId) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  };

  // Duplicate selected node
  const handleDuplicateSelected = () => {
    if (!selectedNodeId) return;
    const original = nodes.find((n) => n.id === selectedNodeId);
    if (!original) return;

    const newNodeId = `node_copy_${Date.now()}`;
    const newNode: Node<CustomNodeData> = {
      ...original,
      id: newNodeId,
      position: { x: original.position.x + 40, y: original.position.y + 40 },
      data: {
        ...original.data,
        label: `${original.data.label} (Copy)`,
        status: 'idle',
      },
    };

    setNodes((nds) => nds.concat(newNode));
    setSelectedNodeId(newNodeId);
  };

  // Auto Layout Nodes (Hierarchical Layered Layout)
  const handleAutoLayout = () => {
    // Basic topological ordering layout
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};

    nodes.forEach((n) => {
      inDegree[n.id] = 0;
      adj[n.id] = [];
    });

    edges.forEach((e) => {
      if (inDegree[e.target] !== undefined) inDegree[e.target]++;
      if (adj[e.source]) adj[e.source].push(e.target);
    });

    // Layer assignment
    const layers: string[][] = [];
    let currentLayer = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);

    const visited = new Set<string>();

    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      currentLayer.forEach((id) => visited.add(id));

      const nextLayer: string[] = [];
      currentLayer.forEach((u) => {
        (adj[u] || []).forEach((v) => {
          if (!visited.has(v) && !nextLayer.includes(v)) {
            nextLayer.push(v);
          }
        });
      });
      currentLayer = nextLayer;
      if (layers.length > 20) break; // Avoid infinite loop on cycles
    }

    // Assign any unvisited nodes to final layer
    const unvisited = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
    if (unvisited.length > 0) layers.push(unvisited);

    // Compute coordinates
    const updatedNodes = nodes.map((node) => {
      let layerIdx = layers.findIndex((l) => l.includes(node.id));
      if (layerIdx === -1) layerIdx = 0;
      const indexInLayer = layers[layerIdx].indexOf(node.id);
      const totalInLayer = layers[layerIdx].length;

      const layerWidth = totalInLayer * 320;
      const x = 400 - layerWidth / 2 + indexInLayer * 320;
      const y = 50 + layerIdx * 160;

      return {
        ...node,
        position: { x, y },
      };
    });

    setNodes(updatedNodes);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  };

  // Compile React Flow Graph into executable WorkflowStep[] DAG definition
  const compileGraphToWorkflowSteps = (): WorkflowStep[] => {
    // Find dependencies per node
    const incomingEdges: Record<string, string[]> = {};
    edges.forEach((e) => {
      if (!incomingEdges[e.target]) incomingEdges[e.target] = [];
      incomingEdges[e.target].push(e.source);
    });

    // Convert nodes to steps
    return nodes
      .filter((n) => n.type === 'agentNode' || n.type === 'gateNode')
      .map((n, idx) => {
        const directDeps = (incomingEdges[n.id] || []).filter(
          (srcId) => nodes.find((node) => node.id === srcId)?.type !== 'triggerNode'
        );

        return {
          step_id: n.id,
          name: n.data.label || `Step ${idx + 1}`,
          type: n.data.stepType || 'SEQUENTIAL',
          assigned_agent: (n.data.assignedAgent as AgentId) || 'sub_agent_1',
          objective: n.data.objective || 'Execute sub-agent task',
          dependencies: directDeps,
          requiresApproval: Boolean(n.data.requiresApproval),
        };
      });
  };

  // Save compiled workflow to backend
  const handleSaveWorkflowDAG = async () => {
    setSaveStatus('saving');
    const steps = compileGraphToWorkflowSteps();
    const wfPayload: Workflow = {
      workflow_id: initialWorkflow?.workflow_id || `wf_dag_${Date.now()}`,
      name: workflowTitle,
      description: workflowDesc,
      category: 'custom',
      steps,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wfPayload),
      });

      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
        if (onWorkflowSaved) onWorkflowSaved(wfPayload);
      }
    } catch (err) {
      console.error('Error saving DAG workflow:', err);
      setSaveStatus('idle');
    }
  };

  // Abort Live Pipeline Run
  const handleAbortLiveDAG = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLiveRunning(false);
    setCurrentActiveStepName(null);
    setExecutionTelemetry((prev) => ({
      ...prev,
      status: 'failed',
      stepOutputs: { ...prev.stepOutputs, info: 'Execution cancelled by user.' },
    }));
  };

  // Execute Live Pipeline across React Flow Canvas with Real-Time SSE Updates
  const handleRunLiveDAG = async () => {
    const steps = compileGraphToWorkflowSteps();
    if (steps.length === 0) {
      alert('Graph contains no executable agent steps.');
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLiveRunning(true);
    setActiveTab('execution');
    setExecutionStartTime(Date.now());
    setLiveDurationMs(0);
    setCurrentActiveStepName('Initializing DAG Pipeline...');

    // 1. Reset all node statuses to idle
    let currentNodesState: Node<CustomNodeData>[] = nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        status: (n.type === 'triggerNode' ? 'completed' : 'idle') as CustomNodeData['status'],
        executionTimeMs: undefined,
        resultSummary: undefined,
        error: undefined,
        confidence: undefined,
      },
    }));

    setNodes(currentNodesState);
    setEdges((eds) => updateEdgesForNodeStatuses(currentNodesState, eds));

    setExecutionTelemetry({
      status: 'running',
      completedSteps: 0,
      totalSteps: steps.length,
      tasks: [],
      stepOutputs: {},
    });

    try {
      // 2. Stream execution events from SSE endpoint
      const res = await fetch('/api/workflows/execute/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          workflow_id: 'custom_dag_run',
          steps,
          organizationId: '',
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server execution returned status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const eventBlocks = buffer.split('\n\n');
        buffer = eventBlocks.pop() || '';

        for (const block of eventBlocks) {
          if (!block.trim()) continue;

          const eventMatch = block.match(/^event:\s*(\w+)/m);
          const dataMatch = block.match(/^data:\s*(.*)$/m);

          if (!eventMatch || !dataMatch) continue;

          const eventName = eventMatch[1];
          let eventPayload: any = {};
          try {
            eventPayload = JSON.parse(dataMatch[1]);
          } catch (e) {
            console.error('Failed to parse SSE JSON:', dataMatch[1], e);
            continue;
          }

          if (eventName === 'step_start') {
            // STEP STARTED -> Set node state to ACTIVE (BLUE)
            setCurrentActiveStepName(eventPayload.name || eventPayload.assigned_agent);
            currentNodesState = currentNodesState.map((n) => {
              const isTarget =
                n.id === eventPayload.step_id ||
                n.data.assignedAgent === eventPayload.assigned_agent;
              if (isTarget) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    status: 'running' as const,
                    startedAt: eventPayload.started_at,
                    error: undefined,
                  },
                };
              }
              return n;
            });
            setNodes(currentNodesState);
            setEdges((eds) => updateEdgesForNodeStatuses(currentNodesState, eds));
          } else if (eventName === 'step_approval_required') {
            // STEP APPROVAL REQUIRED -> Set node state to GATE (ORANGE / AMBER)
            setCurrentActiveStepName(`Waiting on Human Approval: ${eventPayload.name}`);
            currentNodesState = currentNodesState.map((n) => {
              const isTarget =
                n.id === eventPayload.step_id ||
                n.data.assignedAgent === eventPayload.assigned_agent;
              if (isTarget) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    status: 'approval_required' as const,
                    resultSummary: 'Paused for TCPA / Human Sign-off',
                  },
                };
              }
              return n;
            });
            setNodes(currentNodesState);
            setEdges((eds) => updateEdgesForNodeStatuses(currentNodesState, eds));
          } else if (eventName === 'step_completed') {
            // STEP COMPLETED -> Set node state to SUCCESS (GREEN)
            currentNodesState = currentNodesState.map((n) => {
              const isTarget =
                n.id === eventPayload.step_id ||
                n.data.assignedAgent === eventPayload.assigned_agent;
              if (isTarget) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    status: 'completed' as const,
                    executionTimeMs: eventPayload.latency_ms,
                    confidence: eventPayload.confidence,
                    resultSummary: eventPayload.summary
                      ? `Outputs: ${eventPayload.summary}`
                      : 'Step outputs verified.',
                  },
                };
              }
              return n;
            });
            setNodes(currentNodesState);
            setEdges((eds) => updateEdgesForNodeStatuses(currentNodesState, eds));

            // Record task in telemetry
            setExecutionTelemetry((prev) => {
              const newTasks = [
                ...prev.tasks,
                {
                  task_id: `task_${eventPayload.step_id}_${Date.now()}`,
                  parent_task_id: null,
                  assigned_agent: eventPayload.assigned_agent,
                  objective: eventPayload.name,
                  input: {},
                  status: 'completed' as const,
                  result: eventPayload.result,
                  confidence: eventPayload.confidence || 0.96,
                  executionTimeMs: eventPayload.latency_ms,
                  created_at: new Date().toISOString(),
                  completed_at: eventPayload.completed_at || new Date().toISOString(),
                },
              ];
              return {
                ...prev,
                completedSteps: (eventPayload.step_index ?? 0) + 1,
                tasks: newTasks,
                stepOutputs: {
                  ...prev.stepOutputs,
                  [eventPayload.step_id]: eventPayload.result,
                },
              };
            });
          } else if (eventName === 'step_failed') {
            // STEP FAILED -> Set node state to ERROR (RED)
            currentNodesState = currentNodesState.map((n) => {
              const isTarget =
                n.id === eventPayload.step_id ||
                n.data.assignedAgent === eventPayload.assigned_agent;
              if (isTarget) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    status: 'failed' as const,
                    error: eventPayload.error || 'Execution encountered an error',
                    executionTimeMs: eventPayload.latency_ms,
                  },
                };
              }
              return n;
            });
            setNodes(currentNodesState);
            setEdges((eds) => updateEdgesForNodeStatuses(currentNodesState, eds));
          } else if (eventName === 'workflow_completed') {
            // WORKFLOW FINISHED
            setCurrentActiveStepName(null);

            // Also mark output sink node as completed
            currentNodesState = currentNodesState.map((n) => {
              if (n.type === 'outputNode') {
                return {
                  ...n,
                  data: { ...n.data, status: 'completed' as const },
                };
              }
              return n;
            });
            setNodes(currentNodesState);
            setEdges((eds) => updateEdgesForNodeStatuses(currentNodesState, eds));

            setExecutionTelemetry((prev) => ({
              ...prev,
              status: eventPayload.status === 'completed' ? 'completed' : 'failed',
              completedSteps: eventPayload.completed_steps || steps.length,
              totalSteps: steps.length,
              tasks: eventPayload.tasks && eventPayload.tasks.length > 0 ? eventPayload.tasks : prev.tasks,
              stepOutputs: eventPayload.step_outputs || prev.stepOutputs,
            }));
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Live DAG execution aborted by user.');
        return;
      }
      console.error('DAG Run error, falling back to batch execute:', err);
      try {
        // Fallback standard batch execution if SSE disconnects
        const fallbackRes = await fetch('/api/workflows/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow_id: 'custom_dag_run',
            steps,
            organizationId: '',
          }),
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackRes.ok && fallbackData.tasks) {
          setNodes((nds) =>
            nds.map((n) => {
              const matchingTask = fallbackData.tasks.find(
                (t: Task) => t.assigned_agent === n.data.assignedAgent
              );
              if (matchingTask) {
                const summaryKeys = Object.keys(matchingTask.result || {}).slice(0, 3).join(', ');
                return {
                  ...n,
                  data: {
                    ...n.data,
                    status: matchingTask.status === 'completed' ? 'completed' : 'failed',
                    executionTimeMs: matchingTask.executionTimeMs,
                    resultSummary: summaryKeys ? `Outputs: ${summaryKeys}` : 'Execution completed.',
                  },
                };
              }
              return n;
            })
          );
          setExecutionTelemetry({
            status: fallbackData.status === 'completed' ? 'completed' : 'failed',
            completedSteps: fallbackData.completed_steps || steps.length,
            totalSteps: steps.length,
            tasks: fallbackData.tasks || [],
            stepOutputs: fallbackData.step_outputs || {},
          });
        }
      } catch (fallbackErr: any) {
        setExecutionTelemetry((prev) => ({
          ...prev,
          status: 'failed',
          stepOutputs: { error: fallbackErr.message || 'Network error during execution' },
        }));
      }
    } finally {
      setIsLiveRunning(false);
      abortControllerRef.current = null;
    }
  };

  // Load Preset DAG
  const handleLoadPreset = (key: string) => {
    const preset = PRESET_DAGS[key];
    if (!preset) return;
    setWorkflowTitle(preset.name);
    setWorkflowDesc(preset.description);
    setNodes(preset.nodes);
    setEdges(preset.edges);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  };

  // Clear Canvas
  const handleClearCanvas = () => {
    if (!confirm('Clear all nodes and connectors from the canvas?')) return;
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  // Selected Node Details
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Update selected node fields
  const handleUpdateSelectedNode = (fields: Partial<CustomNodeData>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              ...fields,
            },
          };
        }
        return n;
      })
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-50 relative overflow-hidden font-sans select-none">
      {/* Top Studio Control Bar */}
      <div className="h-16 bg-white border-b border-slate-200 px-5 flex items-center justify-between z-10 shrink-0 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/10">
            <WorkflowIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={workflowTitle}
                onChange={(e) => setWorkflowTitle(e.target.value)}
                className="font-bold text-slate-900 text-sm bg-transparent hover:bg-slate-50 border border-transparent hover:border-slate-300 focus:border-cyan-500 rounded px-1.5 py-0.5 focus:outline-none transition w-80 truncate"
              />
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 uppercase">
                React Flow DAG
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate max-w-lg pl-1.5">{workflowDesc}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Polling & Telemetry Status Chip */}
          <div className="flex items-center space-x-1.5 border border-slate-200 rounded-lg bg-slate-50 p-1 text-xs">
            <button
              onClick={() => setIsAutoPolling(!isAutoPolling)}
              title="Toggle 3s real-time state polling"
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                isAutoPolling
                  ? 'bg-cyan-50 border border-cyan-300 text-cyan-800'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isAutoPolling ? 'bg-cyan-500 animate-ping' : 'bg-slate-400'}`} />
              <span>Poll: {isAutoPolling ? 'ON' : 'OFF'}</span>
            </button>

            <button
              onClick={() => fetchRunsTelemetry()}
              disabled={isPollingLoading}
              title="Poll /api/runs immediately"
              className="p-1 text-slate-500 hover:text-slate-900 rounded transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPollingLoading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>

            {/* Run Selection Dropdown */}
            {availableRuns.length > 0 && (
              <select
                value={selectedRunId}
                onChange={(e) => handleSelectRun(e.target.value)}
                className="text-[11px] font-semibold bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-cyan-500 max-w-[140px] truncate"
              >
                <option value="live">⚡ Live Active Run</option>
                {availableRuns.map((r) => (
                  <option key={r.run_id} value={r.run_id}>
                    {r.name} ({r.status})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Quick preset selector */}
          <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50 p-0.5 text-xs">
            <button
              onClick={() => handleLoadPreset('absentee_prospecting')}
              className="px-2.5 py-1 rounded text-slate-700 hover:text-cyan-800 hover:bg-white font-medium transition cursor-pointer"
            >
              Preset: Absentee
            </button>
            <button
              onClick={() => handleLoadPreset('executive_briefing')}
              className="px-2.5 py-1 rounded text-slate-700 hover:text-cyan-800 hover:bg-white font-medium transition cursor-pointer"
            >
              Preset: Audio TTS
            </button>
          </div>

          <button
            onClick={handleAutoLayout}
            title="Auto-organize nodes into hierarchical DAG layers"
            className="flex items-center space-x-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs px-3 py-2 rounded-lg border border-slate-200 shadow-2xs transition cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-cyan-600" />
            <span>Auto Layout</span>
          </button>

          <button
            onClick={handleSaveWorkflowDAG}
            disabled={saveStatus === 'saving'}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {saveStatus === 'saving' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : 'Save DAG'}</span>
          </button>

          <button
            onClick={handleRunLiveDAG}
            disabled={isLiveRunning || nodes.length === 0}
            className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {isLiveRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isLiveRunning ? 'Executing Live DAG...' : 'Execute Live DAG'}</span>
          </button>
        </div>
      </div>

      {/* Workspace Area: Left Draggable Palette + Center React Flow Canvas + Right Inspector */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT PALETTE / PRESETS SIDEBAR */}
        <div className="w-72 bg-white border-r border-slate-200 flex flex-col z-10 shrink-0 shadow-xs">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/70 p-1">
            <button
              onClick={() => setActiveTab('palette')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${
                activeTab === 'palette'
                  ? 'bg-white text-cyan-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Agents Palette
            </button>
            <button
              onClick={() => setActiveTab('execution')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition flex items-center justify-center space-x-1 ${
                activeTab === 'execution'
                  ? 'bg-white text-cyan-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Terminal className="w-3 h-3" />
              <span>Telemetry</span>
              {executionTelemetry.tasks.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping ml-1" />
              )}
            </button>
          </div>

          {activeTab === 'palette' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-1">
                <span>DRAG NODES TO CANVAS</span>
                <span className="font-mono text-[10px] text-cyan-700 font-bold">{PALETTE_AGENTS_LIST.length} Available</span>
              </div>

              {/* Grouped Agent Palette Items */}
              <div className="space-y-2">
                {PALETTE_AGENTS_LIST.map((agent) => {
                  const Icon = agent.icon;
                  return (
                    <div
                      key={agent.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('application/json', JSON.stringify(agent));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      className={`p-2.5 rounded-xl border bg-white hover:bg-slate-50 transition cursor-grab active:cursor-grabbing group hover:shadow-xs border-slate-200 hover:border-cyan-400`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2 truncate">
                          <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 group-hover:border-cyan-300">
                            <Icon className="w-3.5 h-3.5 text-slate-800" />
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-900 truncate leading-tight">
                              {agent.name}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">{agent.role}</div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleAddNodeFromPalette(agent)}
                          title="Click to add onto canvas"
                          className="opacity-0 group-hover:opacity-100 text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100 transition shrink-0"
                        >
                          + Add
                        </button>
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate max-w-[150px]">{agent.defaultObjective}</span>
                        <span className="font-mono text-[9px] font-semibold px-1 rounded bg-slate-100 text-slate-600">
                          {agent.defaultStepType}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'execution' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-800">Telemetry Logs</span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    executionTelemetry.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : executionTelemetry.status === 'running'
                      ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {executionTelemetry.status} ({executionTelemetry.completedSteps}/{executionTelemetry.totalSteps})
                </span>
              </div>

              {executionTelemetry.tasks.length > 0 ? (
                <div className="space-y-2">
                  {executionTelemetry.tasks.map((t, idx) => (
                    <div
                      key={t.task_id || idx}
                      className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 space-y-1 font-mono"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-cyan-800">{t.assigned_agent}</span>
                        <span className="text-slate-400 text-[10px]">
                          {t.executionTimeMs ? `${t.executionTimeMs}ms` : 'Completed'}
                        </span>
                      </div>
                      <div className="text-slate-600 text-[10px] font-sans line-clamp-2">{t.objective}</div>
                      {t.result && (
                        <div className="text-[9px] text-slate-600 bg-white p-1.5 rounded border border-slate-100 overflow-x-auto max-h-24">
                          <pre>{JSON.stringify(t.result, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-slate-400 space-y-2">
                  <Terminal className="w-6 h-6 mx-auto text-slate-300" />
                  <p>No active execution telemetry.</p>
                  <p className="text-[10px] text-slate-400">Click &quot;Execute Live DAG&quot; to run the compiled pipeline.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER REACT FLOW CANVAS */}
        <div ref={reactFlowWrapper} className="flex-1 h-full w-full relative bg-slate-100">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid={true}
            snapGrid={[15, 15]}
            defaultEdgeOptions={{
              type: 'smoothstep',
              markerEnd: { type: MarkerType.ArrowClosed, color: '#0891b2' },
              style: { stroke: '#0891b2', strokeWidth: 2 },
            }}
          >
            <Background color="#cbd5e1" gap={20} size={1.5} variant={BackgroundVariant.Dots} />
            <Controls className="!bg-white !border-slate-200 !shadow-md !rounded-xl" />
            <MiniMap
              nodeStrokeColor="#94a3b8"
              nodeColor="#f8fafc"
              className="!bg-white !border !border-slate-200 !rounded-xl !shadow-md"
            />

            {/* Top-Left Live Status & Legend Panel */}
            <Panel position="top-left" className="space-y-2 pointer-events-auto max-w-md">
              {/* Color Code Legend */}
              <div className="bg-white/95 backdrop-blur-xs border border-slate-200/90 rounded-xl p-2.5 shadow-sm text-xs space-y-1.5 font-sans">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">
                  <span>Node State Legend</span>
                  <span className="font-mono text-[9px] text-cyan-700">Real-Time</span>
                </div>
                <div className="flex items-center space-x-3 text-[11px]">
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 ring-2 ring-cyan-200 animate-pulse" />
                    <span className="font-semibold text-slate-700">Active</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
                    <span className="font-semibold text-slate-700">Success</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-200" />
                    <span className="font-semibold text-slate-700">Gate</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-200" />
                    <span className="font-semibold text-slate-700">Failed</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                    <span className="text-slate-400">Idle</span>
                  </div>
                </div>
              </div>

              {/* Live Execution Progress Ribbon */}
              {(isLiveRunning || executionTelemetry.status !== 'idle') && (
                <div className={`p-3 rounded-xl border shadow-md font-sans transition-all ${
                  isLiveRunning
                    ? 'bg-gradient-to-r from-slate-900 to-cyan-950 border-cyan-500 text-white'
                    : executionTelemetry.status === 'completed'
                    ? 'bg-emerald-950/90 border-emerald-500 text-white'
                    : 'bg-rose-950/90 border-rose-500 text-white'
                }`}>
                  <div className="flex items-center justify-between space-x-3 mb-2">
                    <div className="flex items-center space-x-2 truncate">
                      {isLiveRunning ? (
                        <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-300 animate-spin shrink-0">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </div>
                      ) : executionTelemetry.status === 'completed' ? (
                        <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-300 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="p-1 rounded-md bg-rose-500/20 text-rose-300 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="truncate">
                        <div className="text-xs font-bold truncate">
                          {isLiveRunning
                            ? currentActiveStepName || 'Executing Workflow Pipeline...'
                            : executionTelemetry.status === 'completed'
                            ? 'DAG Execution Completed Successfully'
                            : 'DAG Execution Failed'}
                        </div>
                        <div className="text-[10px] text-slate-300 font-mono flex items-center space-x-2">
                          <span>
                            {executionTelemetry.completedSteps} / {executionTelemetry.totalSteps} Steps Complete
                          </span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Clock className="w-2.5 h-2.5" />
                            <span>{(liveDurationMs / 1000).toFixed(2)}s</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {isLiveRunning && (
                      <button
                        onClick={handleAbortLiveDAG}
                        className="px-2 py-1 rounded bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] font-bold shrink-0 transition flex items-center space-x-1 cursor-pointer"
                      >
                        <Square className="w-2.5 h-2.5 fill-white" />
                        <span>Stop</span>
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 rounded-full ${
                        executionTelemetry.status === 'failed'
                          ? 'bg-rose-400'
                          : 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                      }`}
                      style={{
                        width: `${
                          executionTelemetry.totalSteps > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (executionTelemetry.completedSteps / executionTelemetry.totalSteps) * 100
                                )
                              )
                            : isLiveRunning
                            ? 20
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </Panel>

            {/* Quick Canvas Toolbar Panel */}
            <Panel position="top-right" className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-sm flex items-center space-x-1">
              <button
                onClick={() => fitView({ padding: 0.2, duration: 300 })}
                title="Fit to screen"
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg text-xs font-semibold flex items-center space-x-1"
              >
                <span>Fit View</span>
              </button>

              <div className="h-4 w-px bg-slate-200 mx-1" />

              <button
                onClick={handleDuplicateSelected}
                disabled={!selectedNodeId}
                title="Duplicate Node"
                className="p-1.5 text-slate-600 hover:text-cyan-700 hover:bg-slate-100 rounded-lg disabled:opacity-30"
              >
                <Copy className="w-4 h-4" />
              </button>

              <button
                onClick={handleDeleteSelected}
                disabled={!selectedNodeId && !selectedEdgeId}
                title="Delete Selected Item"
                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-slate-100 rounded-lg disabled:opacity-30"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-slate-200 mx-1" />

              <button
                onClick={handleClearCanvas}
                title="Clear all"
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg text-xs"
              >
                Clear
              </button>
            </Panel>
          </ReactFlow>
        </div>

        {/* RIGHT INSPECTOR PANEL FOR SELECTED NODE / EDGE */}
        {selectedNode && (
          <div className="w-80 bg-white border-l border-slate-200 p-4 flex flex-col justify-between z-10 shrink-0 shadow-xs overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Node Inspector
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Node Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Node Label</label>
                <input
                  type="text"
                  value={selectedNode.data.label}
                  onChange={(e) => handleUpdateSelectedNode({ label: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs font-semibold focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Assigned Agent */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Assigned Agent</label>
                <select
                  value={selectedNode.data.assignedAgent}
                  onChange={(e) => handleUpdateSelectedNode({ assignedAgent: e.target.value as AgentId })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:border-cyan-500"
                >
                  {PALETTE_AGENTS_LIST.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step Execution Mode */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Execution Mode</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['SEQUENTIAL', 'PARALLEL', 'CONDITIONAL', 'HUMAN_APPROVAL'] as WorkflowStepType[]).map(
                    (mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          handleUpdateSelectedNode({
                            stepType: mode,
                            requiresApproval: mode === 'HUMAN_APPROVAL' ? true : selectedNode.data.requiresApproval,
                          })
                        }
                        className={`text-[10px] font-bold py-1.5 px-2 rounded-lg border text-center transition ${
                          selectedNode.data.stepType === mode
                            ? 'bg-cyan-50 text-cyan-800 border-cyan-400 font-bold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {mode}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Objective Directive */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Task Objective &amp; Prompt</label>
                <textarea
                  rows={4}
                  value={selectedNode.data.objective}
                  onChange={(e) => handleUpdateSelectedNode({ objective: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 text-xs focus:outline-none focus:border-cyan-500 leading-relaxed font-sans"
                  placeholder="Define specific operational parameters for this sub-agent..."
                />
              </div>

              {/* Human Approval Sign-off Gatekeeper */}
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-900">Governance Gate</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(selectedNode.data.requiresApproval)}
                    onChange={(e) =>
                      handleUpdateSelectedNode({ requiresApproval: e.target.checked })
                    }
                    className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
                  />
                </div>
                <p className="text-[10px] text-amber-800 leading-relaxed">
                  Require human administrator review in the Approvals queue before downstream nodes execute.
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handleDuplicateSelected}
                className="flex items-center space-x-1 text-xs text-slate-600 hover:text-cyan-700 font-semibold"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Clone</span>
              </button>

              <button
                onClick={handleDeleteSelected}
                className="flex items-center space-x-1 text-xs text-rose-600 hover:text-rose-700 font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        )}

        {selectedEdgeId && (
          <div className="w-80 bg-white border-l border-slate-200 p-4 flex flex-col justify-between z-10 shrink-0 shadow-xs">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <ArrowRight className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Connector Edge
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedEdgeId(null)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-xs text-slate-600 space-y-2">
                <p className="leading-relaxed">
                  Connector line controls execution flow between predecessor and successor sub-agent nodes.
                </p>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px]">
                  ID: {selectedEdgeId}
                </div>
              </div>
            </div>

            <button
              onClick={handleDeleteSelected}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Connector</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const VisualWorkflowBuilder: React.FC<VisualWorkflowBuilderProps> = (props) => {
  return (
    <ReactFlowProvider>
      <VisualWorkflowBuilderInner {...props} />
    </ReactFlowProvider>
  );
};
