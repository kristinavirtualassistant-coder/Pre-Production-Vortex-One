import React, { useState, useEffect } from 'react';
import { VisualWorkflowBuilder } from './VisualWorkflowBuilder';
import {
  GitBranch,
  Play,
  Plus,
  Trash2,
  Copy,
  MoveUp,
  MoveDown,
  Settings,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  BrainCircuit,
  Cpu,
  Building2,
  Users,
  PhoneCall,
  Search,
  Sparkles,
  BarChart3,
  Workflow as WorkflowIcon,
  CheckCheck,
  Save,
  Download,
  Upload,
  RefreshCw,
  Sliders,
  ChevronRight,
  ChevronDown,
  Terminal,
  Layers,
  ArrowRight,
  GripVertical,
  Volume2,
  Check,
  HelpCircle,
  FileCode,
  X,
  Radio,
  Zap,
} from 'lucide-react';
import {
  Workflow,
  WorkflowStep,
  WorkflowStepType,
  AgentDefinition,
  AgentId,
  Task,
} from '../types';

interface WorkflowsViewProps {
  onRunWorkflow?: (prompt: string) => void;
  agents?: AgentDefinition[];
}

// Available Sub-Agent Palette for Drag & Drop
const PALETTE_AGENTS: Array<{
  id: AgentId;
  name: string;
  role: string;
  icon: any;
  color: string;
  badge: string;
  defaultObjective: string;
  defaultType: WorkflowStepType;
}> = [
  {
    id: 'agent_1',
    name: 'Agent 1: Master Orchestrator',
    role: 'Decomposition & Synthesis',
    icon: BrainCircuit,
    color: 'border-cyan-500 bg-cyan-50 text-cyan-700',
    badge: 'Orchestrator',
    defaultObjective: 'Understand intent, plan execution DAG, and coordinate sub-agents.',
    defaultType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_0',
    name: 'Sub-Agent 0: System Reasoning',
    role: 'Hypothesis & Logic',
    icon: Cpu,
    color: 'border-indigo-500 bg-indigo-50 text-indigo-700',
    badge: 'Reasoning',
    defaultObjective: 'Analyze cross-domain dependencies and formulate working hypotheses.',
    defaultType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_1',
    name: 'Sub-Agent 1: Property Cadastre',
    role: 'Parcels, Equity, Absentee',
    icon: Building2,
    color: 'border-blue-500 bg-blue-50 text-blue-700',
    badge: 'Cadastre',
    defaultObjective: 'Identify high-equity absentee and multi-family commercial parcels in target market.',
    defaultType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_2',
    name: 'Sub-Agent 2: Lead & CRM Intel',
    role: 'Scoring & Qualification',
    icon: Users,
    color: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    badge: 'Lead Scoring',
    defaultObjective: 'Calculate explainable 0-100 property management viability scores.',
    defaultType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_3',
    name: 'Sub-Agent 3: Structured Research',
    role: 'Public Records & Grounding',
    icon: Search,
    color: 'border-violet-500 bg-violet-50 text-violet-700',
    badge: 'Research',
    defaultObjective: 'Search county records, tax history, and commercial market rent comparables.',
    defaultType: 'PARALLEL',
  },
  {
    id: 'sub_agent_4',
    name: 'Sub-Agent 4: Normalization & Enrichment',
    role: 'LLC Entity Matching',
    icon: Sparkles,
    color: 'border-amber-500 bg-amber-50 text-amber-700',
    badge: 'Normalization',
    defaultObjective: 'Normalize mailing addresses and resolve corporate LLC/Trust ownership structures.',
    defaultType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_5',
    name: 'Sub-Agent 5: Outreach & TTS Voice',
    role: 'Pitch Briefs & Audio Synthesis',
    icon: PhoneCall,
    color: 'border-rose-500 bg-rose-50 text-rose-700',
    badge: 'Outreach & Audio',
    defaultObjective: 'Synthesize custom objection counters, pitch brief, and audio briefing via Gemini TTS.',
    defaultType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_6',
    name: 'Sub-Agent 6: Analytics & KPIs',
    role: 'Portfolio Metrics & Forecasting',
    icon: BarChart3,
    color: 'border-sky-500 bg-sky-50 text-sky-700',
    badge: 'Analytics',
    defaultObjective: 'Calculate portfolio ROI, cap rates, NOI upside, and management fee projections.',
    defaultType: 'PARALLEL',
  },
  {
    id: 'sub_agent_7',
    name: 'Sub-Agent 7: Compliance & TCPA',
    role: 'DNC Screening & Human Gate',
    icon: ShieldAlert,
    color: 'border-orange-500 bg-orange-50 text-orange-700',
    badge: 'TCPA Gatekeeper',
    defaultObjective: 'Audit calling lists against National DNC registry and enforce human approval sign-off.',
    defaultType: 'HUMAN_APPROVAL',
  },
  {
    id: 'sub_agent_8',
    name: 'Sub-Agent 8: Automation & Sync',
    role: 'CRM & Telephony Dispatch',
    icon: WorkflowIcon,
    color: 'border-teal-500 bg-teal-50 text-teal-700',
    badge: 'Automation',
    defaultObjective: 'Sync approved prospect batches into active dialer queue and CRM records.',
    defaultType: 'SEQUENTIAL',
  },
  {
    id: 'sub_agent_9',
    name: 'Sub-Agent 9: QA & Independent Audit',
    role: 'Hallucination Verification',
    icon: CheckCheck,
    color: 'border-purple-500 bg-purple-50 text-purple-700',
    badge: 'QA Audit',
    defaultObjective: 'Perform independent mathematical validation and factual provenance audit.',
    defaultType: 'SEQUENTIAL',
  },
];

const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    workflow_id: 'wf_01',
    name: 'End-to-End Absentee Portfolio Prospecting DAG',
    description: 'Sequential & Parallel pipeline extracting parcels, normalizing owner entities, scoring management viability, crafting pitch briefs, and auditing with Sub-Agent 9.',
    category: 'prospecting',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    steps: [
      {
        step_id: 'step_1_prop',
        name: 'County Cadastral Parcel Discovery',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_1',
        objective: 'Find multi-family and commercial properties in Orange County with >$1M equity and absentee ownership.',
        dependencies: [],
        requiresApproval: false,
      },
      {
        step_id: 'step_2_norm',
        name: 'Entity & Address Resolution',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_4',
        objective: 'Resolve corporate LLC/Trust ownership records and normalize postal delivery addresses.',
        dependencies: ['step_1_prop'],
        requiresApproval: false,
      },
      {
        step_id: 'step_3_score',
        name: 'Explainable Viability Scoring',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_2',
        objective: 'Calculate 0-100 property management prospect scores with explainable weighted factor breakdowns.',
        dependencies: ['step_2_norm'],
        requiresApproval: false,
      },
      {
        step_id: 'step_4_pitch',
        name: 'Hyper-Personalized Call Pitch Formulation',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_5',
        objective: 'Synthesize custom objection counters, local market rent roll briefs, and owner pitch strategy.',
        dependencies: ['step_3_score'],
        requiresApproval: false,
      },
      {
        step_id: 'step_5_tcpa',
        name: 'TCPA & DNC Legal Compliance Audit',
        type: 'CONDITIONAL',
        assigned_agent: 'sub_agent_7',
        objective: 'Verify National DNC registry and TCPA calling hour constraints before outbound campaign inclusion.',
        dependencies: ['step_4_pitch'],
        requiresApproval: true,
      },
      {
        step_id: 'step_6_qa',
        name: 'Independent QA & Hallucination Audit',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_9',
        objective: 'Perform independent mathematical validation and factual provenance check across all extracted data.',
        dependencies: ['step_5_tcpa'],
        requiresApproval: false,
      },
    ],
  },
  {
    workflow_id: 'wf_02',
    name: 'High-Touch Executive Outbound Briefing & TTS Pipeline',
    description: 'Generates specialized executive call scripts, market comparables, and synthesized voice briefing for top-tier prospects.',
    category: 'outreach',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    steps: [
      {
        step_id: 'step_exec_1',
        name: 'High-Equity Lead Profile Lookup',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_2',
        objective: 'Lookup high-priority qualified lead profile and ownership portfolio holdings for Jonathan Sterling.',
        dependencies: [],
        requiresApproval: false,
      },
      {
        step_id: 'step_exec_2',
        name: 'Public Records & Market Research',
        type: 'PARALLEL',
        assigned_agent: 'sub_agent_3',
        objective: 'Extract recent comparable commercial lease rates along Newport Blvd corridor.',
        dependencies: ['step_exec_1'],
        requiresApproval: false,
      },
      {
        step_id: 'step_exec_3',
        name: 'Audio Strategy Briefing & TTS Synthesis',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_5',
        objective: 'Craft high-converting executive pitch script and generate audio voice briefing using Gemini TTS.',
        dependencies: ['step_exec_1', 'step_exec_2'],
        requiresApproval: false,
      },
      {
        step_id: 'step_exec_4',
        name: 'Verification & Provenance Check',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_9',
        objective: 'Verify factual claims in generated call brief against verified county records.',
        dependencies: ['step_exec_3'],
        requiresApproval: false,
      },
    ],
  },
  {
    workflow_id: 'wf_03',
    name: 'TCPA-Gated Bulk Multi-Family Outreach Campaign',
    description: 'Pre-screens multi-family landlords, requires human sign-off for bulk sequences, and triggers automated CRM actions.',
    category: 'qualification',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    steps: [
      {
        step_id: 'step_bulk_1',
        name: 'Multi-Family Parcel Filter',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_1',
        objective: 'Extract all 4-to-12 unit residential properties with estimated equity >$800K.',
        dependencies: [],
        requiresApproval: false,
      },
      {
        step_id: 'step_bulk_2',
        name: 'Owner Contact Enrichment',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_4',
        objective: 'Resolve mobile and landline numbers for target owner entities.',
        dependencies: ['step_bulk_1'],
        requiresApproval: false,
      },
      {
        step_id: 'step_bulk_3',
        name: 'Compliance Screening & Gatekeeper',
        type: 'HUMAN_APPROVAL',
        assigned_agent: 'sub_agent_7',
        objective: 'Screen for suppression list matches and queue human approval for bulk campaign batch.',
        dependencies: ['step_bulk_2'],
        requiresApproval: true,
      },
      {
        step_id: 'step_bulk_4',
        name: 'Automated CRM Campaign Sync',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_8',
        objective: 'Sync approved contact records to active dialer queue and log audit trail.',
        dependencies: ['step_bulk_3'],
        requiresApproval: false,
      },
    ],
  },
];

const WORKFLOW_TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  category: 'prospecting' | 'qualification' | 'outreach' | 'audit' | 'custom';
  steps: WorkflowStep[];
}> = [
  {
    id: 'tpl_acquisition',
    name: 'Property Acquisition Outreach',
    description: 'End-to-end pipeline for discovering high-equity absentee parcels, resolving LLC ownership, synthesizing tailored outreach pitch scripts, and executing TCPA compliance checks.',
    category: 'outreach',
    steps: [
      {
        step_id: 'step_acq_1',
        name: 'County Cadastral Parcel Discovery',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_1',
        objective: 'Extract multi-family and commercial properties with estimated equity >$1M and absentee ownership.',
        dependencies: [],
        requiresApproval: false,
      },
      {
        step_id: 'step_acq_2',
        name: 'Entity & Address Resolution',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_4',
        objective: 'Resolve corporate LLC/Trust ownership records and normalize postal delivery addresses.',
        dependencies: ['step_acq_1'],
        requiresApproval: false,
      },
      {
        step_id: 'step_acq_3',
        name: 'Hyper-Personalized Pitch Synthesis',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_5',
        objective: 'Synthesize custom objection counters, rent roll briefs, and owner pitch strategy.',
        dependencies: ['step_acq_2'],
        requiresApproval: false,
      },
      {
        step_id: 'step_acq_4',
        name: 'TCPA Compliance & DNC Screening',
        type: 'CONDITIONAL',
        assigned_agent: 'sub_agent_7',
        objective: 'Verify National DNC registry and TCPA calling hour constraints before outbound campaign inclusion.',
        dependencies: ['step_acq_3'],
        requiresApproval: true,
      },
    ],
  },
  {
    id: 'tpl_qualification',
    name: 'Lead Qualification Pipeline',
    description: 'Automated ingestion and scoring pipeline that calculates explainable 0-100 management viability scores, performs independent QA audits, and queues qualified leads into CRM.',
    category: 'qualification',
    steps: [
      {
        step_id: 'step_qual_1',
        name: 'Inbound Lead Ingestion & Normalization',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_4',
        objective: 'Normalize incoming property leads and resolve contact records.',
        dependencies: [],
        requiresApproval: false,
      },
      {
        step_id: 'step_qual_2',
        name: 'Explainable Viability Scoring',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_2',
        objective: 'Calculate 0-100 property management prospect scores with weighted factor breakdown.',
        dependencies: ['step_qual_1'],
        requiresApproval: false,
      },
      {
        step_id: 'step_qual_3',
        name: 'Independent QA & Provenance Audit',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_9',
        objective: 'Perform mathematical validation and factual provenance check across score factors.',
        dependencies: ['step_qual_2'],
        requiresApproval: false,
      },
      {
        step_id: 'step_qual_4',
        name: 'CRM & Dialer Dispatch Sync',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_8',
        objective: 'Sync approved qualified lead records into active dialer queue and CRM database.',
        dependencies: ['step_qual_3'],
        requiresApproval: false,
      },
    ],
  },
  {
    id: 'tpl_noi_analysis',
    name: 'Portfolio NOI & Comps Analysis',
    description: 'Analyzes commercial rental comparables, calculates portfolio cap rates, NOI upside, and management fee projections with Sub-Agent 6 & 9.',
    category: 'prospecting',
    steps: [
      {
        step_id: 'step_noi_1',
        name: 'Property Cadastre Lookup',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_1',
        objective: 'Retrieve multi-family asset valuation and historical tax roll records.',
        dependencies: [],
        requiresApproval: false,
      },
      {
        step_id: 'step_noi_2',
        name: 'Comparable Market Rent Extraction',
        type: 'PARALLEL',
        assigned_agent: 'sub_agent_3',
        objective: 'Search county records and commercial market rent comparables along corridor.',
        dependencies: ['step_noi_1'],
        requiresApproval: false,
      },
      {
        step_id: 'step_noi_3',
        name: 'Analytics & NOI Projection',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_6',
        objective: 'Calculate portfolio ROI, cap rates, NOI upside, and management fee projections.',
        dependencies: ['step_noi_2'],
        requiresApproval: false,
      },
    ],
  },
  {
    id: 'tpl_compliance',
    name: 'TCPA & Compliance Gatekeeper Audit',
    description: 'Strict compliance audit workflow verifying National DNC registry status and enforcing human supervisor sign-off gates.',
    category: 'audit',
    steps: [
      {
        step_id: 'step_comp_1',
        name: 'Contact List Extraction',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_1',
        objective: 'Extract active calling list for campaign audit.',
        dependencies: [],
        requiresApproval: false,
      },
      {
        step_id: 'step_comp_2',
        name: 'DNC Registry Screening',
        type: 'SEQUENTIAL',
        assigned_agent: 'sub_agent_7',
        objective: 'Scrub phone numbers against federal and state DNC suppression lists.',
        dependencies: ['step_comp_1'],
        requiresApproval: false,
      },
      {
        step_id: 'step_comp_3',
        name: 'Human Supervisor Approval Gate',
        type: 'HUMAN_APPROVAL',
        assigned_agent: 'sub_agent_7',
        objective: 'Enforce mandatory human compliance officer sign-off before campaign activation.',
        dependencies: ['step_comp_2'],
        requiresApproval: true,
      },
    ],
  },
];

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({ onRunWorkflow }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>(DEFAULT_WORKFLOWS);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>('wf_01');
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(DEFAULT_WORKFLOWS[0]);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(0);
  const [draggedPaletteAgent, setDraggedPaletteAgent] = useState<typeof PALETTE_AGENTS[0] | null>(null);
  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionRun, setExecutionRun] = useState<{
    status: string;
    completed_steps: number;
    total_steps: number;
    tasks: Task[];
    step_outputs: Record<string, any>;
    activeStepIndex?: number;
  } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [builderMode, setBuilderMode] = useState<'flow' | 'list'>('flow');
  const [viewMode, setViewMode] = useState<'canvas' | 'table' | 'json'>('canvas');
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');

  const handleLoadTemplate = (tpl: typeof WORKFLOW_TEMPLATES[0]) => {
    const newWf: Workflow = {
      workflow_id: `wf_template_${Date.now()}`,
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      steps: JSON.parse(JSON.stringify(tpl.steps)),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setWorkflows((prev) => [newWf, ...prev]);
    setSelectedWorkflowId(newWf.workflow_id);
    setActiveWorkflow(newWf);
    setSelectedStepIndex(0);
    setShowTemplateModal(false);
  };

  // Fetch workflows from backend with resilient retry and fallback
  const fetchWorkflows = async (retryCount = 0) => {
    try {
      const res = await fetch('/api/workflows', {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const seen = new Set<string>();
            const uniqueList: Workflow[] = [];
            for (const item of data) {
              const id = item?.workflow_id || `wf_${Math.random().toString(36).substring(2, 8)}`;
              if (!seen.has(id)) {
                seen.add(id);
                uniqueList.push({ ...item, workflow_id: id });
              }
            }
            setWorkflows(uniqueList);
            setActiveWorkflow((prev) => {
              const currentId = prev?.workflow_id || selectedWorkflowId;
              const found = uniqueList.find((w) => w.workflow_id === currentId) || uniqueList[0];
              return JSON.parse(JSON.stringify(found));
            });
            return;
          }
        }
      }
      if (retryCount < 2) {
        setTimeout(() => fetchWorkflows(retryCount + 1), 1000 * (retryCount + 1));
      }
    } catch (err) {
      if (retryCount < 2) {
        setTimeout(() => fetchWorkflows(retryCount + 1), 1000 * (retryCount + 1));
      } else {
        console.warn('Workflows server sync deferred; running on verified local DAG presets:', err);
      }
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  // Handle selecting a workflow
  const handleSelectWorkflow = (wfId: string) => {
    setSelectedWorkflowId(wfId);
    const found = workflows.find((w) => w.workflow_id === wfId);
    if (found) {
      setActiveWorkflow(JSON.parse(JSON.stringify(found)));
      setSelectedStepIndex(0);
      setExecutionRun(null);
    }
  };

  // Create new blank workflow
  const handleCreateNewWorkflow = () => {
    const newWf: Workflow = {
      workflow_id: `wf_custom_${Date.now()}`,
      name: 'Custom Multi-Agent Sequence Chain',
      description: 'User-defined sequential & parallel sub-agent execution workflow.',
      category: 'custom',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      steps: [
        {
          step_id: `step_${Date.now()}_1`,
          name: 'Parcel Discovery',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_1',
          objective: 'Find properties in Orange County with >$1M equity.',
          dependencies: [],
          requiresApproval: false,
        },
        {
          step_id: `step_${Date.now()}_2`,
          name: 'QA Audit',
          type: 'SEQUENTIAL',
          assigned_agent: 'sub_agent_9',
          objective: 'Validate accuracy of extracted records.',
          dependencies: [],
          requiresApproval: false,
        },
      ],
    };
    setWorkflows((prev) => [newWf, ...prev]);
    setSelectedWorkflowId(newWf.workflow_id);
    setActiveWorkflow(newWf);
    setSelectedStepIndex(0);
    setExecutionRun(null);
  };

  // Save active workflow to backend
  const handleSaveWorkflow = async () => {
    if (!activeWorkflow) return;
    setSaveStatus('saving');
    try {
      const isExisting = workflows.some((w) => w.workflow_id === activeWorkflow.workflow_id);
      const url = isExisting
        ? `/api/workflows/${activeWorkflow.workflow_id}`
        : '/api/workflows';
      const method = isExisting ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeWorkflow),
      });

      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2500);
        fetchWorkflows();
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Error saving workflow:', err);
      setSaveStatus('error');
    }
  };

  // Delete workflow
  const handleDeleteWorkflow = async (id: string) => {
    if (workflows.length <= 1) {
      alert('Cannot delete the last workflow template.');
      return;
    }
    if (!confirm('Are you sure you want to delete this workflow chain?')) return;
    try {
      await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      const remaining = workflows.filter((w) => w.workflow_id !== id);
      setWorkflows(remaining);
      setSelectedWorkflowId(remaining[0].workflow_id);
      setActiveWorkflow(JSON.parse(JSON.stringify(remaining[0])));
      setSelectedStepIndex(0);
    } catch (err) {
      console.error('Error deleting workflow:', err);
    }
  };

  // Add Step from Palette or Click
  const handleAddStep = (agentInfo: typeof PALETTE_AGENTS[0], insertAt?: number) => {
    if (!activeWorkflow) return;
    const newStep: WorkflowStep = {
      step_id: `step_${agentInfo.id}_${Date.now()}`,
      name: agentInfo.name.replace(/.*:\s*/, ''),
      type: agentInfo.defaultType,
      assigned_agent: agentInfo.id,
      objective: agentInfo.defaultObjective,
      dependencies: insertAt !== undefined && insertAt > 0
        ? [activeWorkflow.steps[insertAt - 1].step_id]
        : [],
      requiresApproval: agentInfo.defaultType === 'HUMAN_APPROVAL',
    };

    const newSteps = [...activeWorkflow.steps];
    const targetIdx = insertAt !== undefined ? insertAt : newSteps.length;
    newSteps.splice(targetIdx, 0, newStep);

    setActiveWorkflow({
      ...activeWorkflow,
      steps: newSteps,
      updated_at: new Date().toISOString(),
    });
    setSelectedStepIndex(targetIdx);
  };

  // Reorder Step via Move Up/Down
  const handleMoveStep = (fromIdx: number, toIdx: number) => {
    if (!activeWorkflow) return;
    if (toIdx < 0 || toIdx >= activeWorkflow.steps.length) return;
    const newSteps = [...activeWorkflow.steps];
    const [moved] = newSteps.splice(fromIdx, 1);
    newSteps.splice(toIdx, 0, moved);
    setActiveWorkflow({ ...activeWorkflow, steps: newSteps });
    setSelectedStepIndex(toIdx);
  };

  // Duplicate Step
  const handleDuplicateStep = (idx: number) => {
    if (!activeWorkflow) return;
    const original = activeWorkflow.steps[idx];
    const copy: WorkflowStep = {
      ...original,
      step_id: `step_copy_${Date.now()}`,
      name: `${original.name} (Copy)`,
    };
    const newSteps = [...activeWorkflow.steps];
    newSteps.splice(idx + 1, 0, copy);
    setActiveWorkflow({ ...activeWorkflow, steps: newSteps });
    setSelectedStepIndex(idx + 1);
  };

  // Remove Step
  const handleRemoveStep = (idx: number) => {
    if (!activeWorkflow) return;
    if (activeWorkflow.steps.length <= 1) {
      alert('A workflow must have at least one execution step.');
      return;
    }
    const newSteps = activeWorkflow.steps.filter((_, i) => i !== idx);
    setActiveWorkflow({ ...activeWorkflow, steps: newSteps });
    setSelectedStepIndex(Math.max(0, idx - 1));
  };

  // Update selected step field
  const handleUpdateStep = (field: keyof WorkflowStep, value: any) => {
    if (!activeWorkflow || selectedStepIndex === null) return;
    const newSteps = [...activeWorkflow.steps];
    newSteps[selectedStepIndex] = {
      ...newSteps[selectedStepIndex],
      [field]: value,
    };
    setActiveWorkflow({ ...activeWorkflow, steps: newSteps });
  };

  // HTML5 Drag and Drop Handlers for Palette
  const handlePaletteDragStart = (e: React.DragEvent, agentInfo: typeof PALETTE_AGENTS[0]) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'palette', agentInfo }));
    setDraggedPaletteAgent(agentInfo);
  };

  // HTML5 Drag and Drop Handlers for Canvas Steps Reordering
  const handleStepDragStart = (e: React.DragEvent, idx: number) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'step_reorder', fromIndex: idx }));
    setDraggedStepIndex(idx);
  };

  const handleCanvasDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDropTargetIndex(targetIdx);
  };

  const handleCanvasDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDropTargetIndex(null);
    setDraggedPaletteAgent(null);
    setDraggedStepIndex(null);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);

      if (data.type === 'palette' && data.agentInfo) {
        handleAddStep(data.agentInfo, targetIdx);
      } else if (data.type === 'step_reorder' && typeof data.fromIndex === 'number') {
        handleMoveStep(data.fromIndex, targetIdx);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // Execute the custom workflow sequence live
  const handleExecuteWorkflow = async () => {
    if (!activeWorkflow || activeWorkflow.steps.length === 0) return;
    setIsExecuting(true);
    setExecutionRun({
      status: 'running',
      completed_steps: 0,
      total_steps: activeWorkflow.steps.length,
      tasks: [],
      step_outputs: {},
      activeStepIndex: 0,
    });

    try {
      const res = await fetch('/api/workflows/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: activeWorkflow.workflow_id,
          steps: activeWorkflow.steps,
          organizationId: '',
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setExecutionRun({
          status: data.status || 'completed',
          completed_steps: data.completed_steps || activeWorkflow.steps.length,
          total_steps: activeWorkflow.steps.length,
          tasks: data.tasks || [],
          step_outputs: data.step_outputs || {},
          activeStepIndex: activeWorkflow.steps.length,
        });
      } else {
        setExecutionRun({
          status: 'failed',
          completed_steps: 0,
          total_steps: activeWorkflow.steps.length,
          tasks: [],
          step_outputs: { error: data.error || 'Execution failed' },
        });
      }
    } catch (err: any) {
      setExecutionRun({
        status: 'failed',
        completed_steps: 0,
        total_steps: activeWorkflow.steps.length,
        tasks: [],
        step_outputs: { error: err.message || 'Network error' },
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Export Workflow JSON
  const handleExportJSON = () => {
    if (!activeWorkflow) return;
    const blob = new Blob([JSON.stringify(activeWorkflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeWorkflow.workflow_id || 'workflow'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import Workflow JSON
  const handleImportJSON = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (!parsed.name || !Array.isArray(parsed.steps)) {
        alert('Invalid workflow JSON: Missing "name" or "steps" array.');
        return;
      }
      const imported: Workflow = {
        workflow_id: `wf_imported_${Date.now()}`,
        name: parsed.name,
        description: parsed.description || 'Imported custom workflow chain.',
        category: parsed.category || 'custom',
        steps: parsed.steps,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setWorkflows((prev) => [imported, ...prev]);
      setSelectedWorkflowId(imported.workflow_id);
      setActiveWorkflow(imported);
      setSelectedStepIndex(0);
      setShowImportModal(false);
      setImportJsonText('');
    } catch (err: any) {
      alert(`JSON Parse error: ${err.message}`);
    }
  };

  const selectedStep =
    activeWorkflow && selectedStepIndex !== null && activeWorkflow.steps[selectedStepIndex]
      ? activeWorkflow.steps[selectedStepIndex]
      : null;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Top Banner / Studio Control Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/10">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Visual Multi-Agent Workflow Builder</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 uppercase tracking-wider">
                DAG Orchestration Engine
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Drag and drop specialized sub-agents into custom sequential, parallel, and conditional execution chains.
            </p>
          </div>
        </div>

        {/* Top Action Buttons & View Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Builder Mode Segmented Control */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setBuilderMode('flow')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                builderMode === 'flow'
                  ? 'bg-white text-cyan-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-600" />
              <span>React Flow Canvas</span>
            </button>
            <button
              onClick={() => setBuilderMode('list')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                builderMode === 'list'
                  ? 'bg-white text-cyan-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>Step Sequence List</span>
            </button>
          </div>

          {/* Workflow Selector Dropdown */}
          <select
            value={selectedWorkflowId}
            onChange={(e) => handleSelectWorkflow(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:border-cyan-500"
          >
            {workflows.map((wf) => (
              <option key={wf.workflow_id} value={wf.workflow_id}>
                {wf.name} ({wf.steps.length} steps)
              </option>
            ))}
          </select>

          <button
            onClick={handleCreateNewWorkflow}
            className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3 py-2 rounded-lg transition border border-slate-200 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chain</span>
          </button>

          <button
            onClick={() => setShowTemplateModal(true)}
            className="flex items-center space-x-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 font-semibold text-xs px-3 py-2 rounded-lg transition border border-cyan-200 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
            <span>Templates Library</span>
          </button>

          <button
            onClick={handleSaveWorkflow}
            disabled={saveStatus === 'saving'}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-3 py-2 rounded-lg transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            {saveStatus === 'saving' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : saveStatus === 'saved' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save Chain'}</span>
          </button>

          <button
            onClick={handleExecuteWorkflow}
            disabled={isExecuting || !activeWorkflow || activeWorkflow.steps.length === 0}
            className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isExecuting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isExecuting ? 'Executing Chain...' : 'Run Live Chain'}</span>
          </button>

          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            <button
              onClick={handleExportJSON}
              title="Export Workflow JSON"
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded transition hover:bg-white"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setShowImportModal(true)}
              title="Import Workflow JSON"
              className="p-1.5 text-slate-500 hover:text-slate-800 rounded transition hover:bg-white"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* REACT FLOW CANVAS OR STEP LIST MODE */}
      {builderMode === 'flow' ? (
        <div className="h-[820px] bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <VisualWorkflowBuilder
            initialWorkflow={activeWorkflow || undefined}
            onWorkflowSaved={() => fetchWorkflows()}
            onRunLiveDAG={(steps) => onRunWorkflow && onRunWorkflow(activeWorkflow?.name || 'Execute DAG')}
          />
        </div>
      ) : (
        /* Main 3-Column Layout: Left Palette + Center Visual Canvas + Right Step Configurator */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Draggable Sub-Agent Palette (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Sub-Agent Palette</h2>
            </div>
            <span className="text-[10px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
              Drag to Canvas
            </span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Drag any sub-agent or click <span className="font-semibold text-cyan-700">+ Add</span> to insert into the active execution chain.
          </p>

          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {PALETTE_AGENTS.map((agent) => {
              const Icon = agent.icon;
              return (
                <div
                  key={agent.id}
                  draggable={true}
                  onDragStart={(e) => handlePaletteDragStart(e, agent)}
                  className={`border rounded-lg p-2.5 transition cursor-grab active:cursor-grabbing hover:shadow-xs group ${agent.color} hover:bg-opacity-80`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-1 rounded bg-white shadow-xs">
                        <Icon className="w-3.5 h-3.5 text-slate-800" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 leading-tight">{agent.name}</div>
                        <div className="text-[10px] text-slate-500">{agent.role}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddStep(agent)}
                      title="Add to sequence"
                      className="opacity-0 group-hover:opacity-100 text-[10px] font-bold px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition shrink-0"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                    <span className="truncate max-w-[160px]">{agent.defaultObjective}</span>
                    <span className="font-mono text-[9px] font-semibold px-1 rounded bg-white/70 border border-slate-200">
                      {agent.defaultType}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER COLUMN: Interactive Drag & Drop Workflow Canvas (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          {/* Active Workflow Metadata Card */}
          {activeWorkflow && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={activeWorkflow.name}
                      onChange={(e) =>
                        setActiveWorkflow({ ...activeWorkflow, name: e.target.value })
                      }
                      className="text-sm font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-cyan-500 focus:outline-none w-full"
                      placeholder="Workflow Chain Name"
                    />
                  </div>
                  <input
                    type="text"
                    value={activeWorkflow.description}
                    onChange={(e) =>
                      setActiveWorkflow({ ...activeWorkflow, description: e.target.value })
                    }
                    className="text-xs text-slate-500 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-cyan-500 focus:outline-none w-full"
                    placeholder="Short description of pipeline objective"
                  />
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">
                    {activeWorkflow.steps.length} Steps
                  </span>
                  <button
                    onClick={() => handleDeleteWorkflow(activeWorkflow.workflow_id)}
                    title="Delete Workflow"
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Steps Sequence Flow Canvas */}
          <div className="bg-slate-100/60 border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 min-h-[500px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <WorkflowIcon className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Execution Sequence Chain</h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Drag to reorder • Click step to configure
              </span>
            </div>

            {/* Drop Zone: Top Insertion */}
            <div
              onDragOver={(e) => handleCanvasDragOver(e, 0)}
              onDrop={(e) => handleCanvasDrop(e, 0)}
              className={`py-1.5 text-center border-2 border-dashed rounded-lg text-[10px] font-semibold transition ${
                dropTargetIndex === 0
                  ? 'border-cyan-500 bg-cyan-50 text-cyan-700'
                  : 'border-transparent text-transparent hover:border-slate-300 hover:text-slate-400'
              }`}
            >
              + Drop here to insert at start of chain
            </div>

            {/* Steps Sequence List */}
            {activeWorkflow && activeWorkflow.steps.length > 0 ? (
              <div className="space-y-3">
                {activeWorkflow.steps.map((step, idx) => {
                  const isSelected = selectedStepIndex === idx;
                  const paletteInfo = PALETTE_AGENTS.find((a) => a.id === step.assigned_agent);
                  const Icon = paletteInfo?.icon || WorkflowIcon;

                  // Execution state if live running
                  const isStepRunning = executionRun?.status === 'running' && executionRun?.activeStepIndex === idx;
                  const isStepCompleted =
                    executionRun?.tasks?.[idx]?.status === 'completed' ||
                    (executionRun?.status === 'completed' && idx < (executionRun?.completed_steps || 0));
                  const isStepFailed = executionRun?.tasks?.[idx]?.status === 'failed';

                  return (
                    <React.Fragment key={step.step_id || idx}>
                      {/* Step Card */}
                      <div
                        draggable={true}
                        onDragStart={(e) => handleStepDragStart(e, idx)}
                        onClick={() => setSelectedStepIndex(idx)}
                        className={`bg-white border rounded-xl p-4 transition shadow-xs cursor-pointer relative ${
                          isSelected
                            ? 'border-cyan-500 ring-2 ring-cyan-500/20'
                            : 'border-slate-200 hover:border-slate-300'
                        } ${
                          isStepRunning
                            ? 'ring-2 ring-cyan-400 animate-pulse bg-cyan-50/30'
                            : isStepCompleted
                            ? 'border-emerald-300 bg-emerald-50/20'
                            : isStepFailed
                            ? 'border-rose-300 bg-rose-50/20'
                            : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Drag Handle & Step Number */}
                          <div className="flex items-center space-x-2.5">
                            <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-0.5">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              Step 0{idx + 1}
                            </span>
                            <div className="flex items-center space-x-1.5">
                              <div className="p-1 rounded bg-slate-50 border border-slate-200">
                                <Icon className="w-3.5 h-3.5 text-cyan-700" />
                              </div>
                              <span className="text-xs font-bold text-slate-900">{step.name}</span>
                            </div>
                          </div>

                          {/* Step Type Badge & Status */}
                          <div className="flex items-center space-x-2">
                            {isStepRunning && (
                              <span className="flex items-center space-x-1 text-[10px] font-semibold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Running</span>
                              </span>
                            )}
                            {isStepCompleted && (
                              <span className="flex items-center space-x-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Passed</span>
                              </span>
                            )}
                            {isStepFailed && (
                              <span className="flex items-center space-x-1 text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Failed</span>
                              </span>
                            )}

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                step.type === 'HUMAN_APPROVAL'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : step.type === 'PARALLEL'
                                  ? 'bg-purple-50 text-purple-800 border-purple-300'
                                  : step.type === 'CONDITIONAL'
                                  ? 'bg-blue-50 text-blue-800 border-blue-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {step.type}
                            </span>
                          </div>
                        </div>

                        {/* Step Objective */}
                        <p className="text-xs text-slate-600 mt-2 pl-7 line-clamp-2 leading-relaxed">
                          {step.objective}
                        </p>

                        {/* Bottom Row: Agent Assignment & Reorder Actions */}
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 pl-7">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] text-slate-400">Assigned:</span>
                            <span className="font-semibold text-slate-700">
                              {paletteInfo?.name || step.assigned_agent}
                            </span>
                            {step.requiresApproval && (
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 flex items-center space-x-1">
                                <ShieldAlert className="w-3 h-3" />
                                <span>Requires Human Sign-off</span>
                              </span>
                            )}
                          </div>

                          {/* Quick Controls */}
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveStep(idx, idx - 1);
                              }}
                              disabled={idx === 0}
                              title="Move Up"
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded"
                            >
                              <MoveUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveStep(idx, idx + 1);
                              }}
                              disabled={idx === activeWorkflow.steps.length - 1}
                              title="Move Down"
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 rounded"
                            >
                              <MoveDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateStep(idx);
                              }}
                              title="Duplicate Step"
                              className="p-1 text-slate-400 hover:text-cyan-700 rounded"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveStep(idx);
                              }}
                              title="Delete Step"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Drop Zone: Between Steps */}
                      <div
                        onDragOver={(e) => handleCanvasDragOver(e, idx + 1)}
                        onDrop={(e) => handleCanvasDrop(e, idx + 1)}
                        className={`flex items-center justify-center py-1 transition ${
                          dropTargetIndex === idx + 1
                            ? 'border-2 border-dashed border-cyan-500 bg-cyan-50 rounded-lg text-cyan-700 font-semibold text-[10px]'
                            : ''
                        }`}
                      >
                        <ArrowRight className="w-4 h-4 text-slate-400 transform rotate-90" />
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-slate-300 rounded-xl bg-white space-y-3">
                <GitBranch className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-xs font-semibold text-slate-700">Workflow is empty</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  Drag sub-agents from the left palette onto this canvas to construct your execution sequence.
                </p>
              </div>
            )}
          </div>

          {/* Live Execution Output & Logs Console */}
          {executionRun && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-cyan-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Live Execution Telemetry
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    executionRun.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : executionRun.status === 'running'
                      ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {executionRun.status} ({executionRun.completed_steps}/{executionRun.total_steps} steps)
                </span>
              </div>

              {/* Tasks Execution Summary */}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {executionRun.tasks?.map((t, idx) => (
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
                    <div className="text-slate-600 text-[10px] font-sans">{t.objective}</div>
                    {t.result && (
                      <div className="text-[10px] text-slate-500 bg-white p-2 rounded border border-slate-100 overflow-x-auto">
                        <pre>{JSON.stringify(t.result, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Step Inspector & Parameter Configurator (3 cols) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-cyan-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Step Inspector</h2>
            </div>
            {selectedStep && (
              <span className="text-[10px] font-mono font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded">
                Step 0{(selectedStepIndex || 0) + 1}
              </span>
            )}
          </div>

          {selectedStep ? (
            <div className="space-y-4 text-xs">
              {/* Step Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Step Label</label>
                <input
                  type="text"
                  value={selectedStep.name}
                  onChange={(e) => handleUpdateStep('name', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-cyan-500 text-xs font-medium"
                />
              </div>

              {/* Assigned Agent Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Assigned Sub-Agent</label>
                <select
                  value={selectedStep.assigned_agent}
                  onChange={(e) => handleUpdateStep('assigned_agent', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-cyan-500 text-xs"
                >
                  {PALETTE_AGENTS.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step Execution Mode */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Execution Mode</label>
                <select
                  value={selectedStep.type}
                  onChange={(e) => handleUpdateStep('type', e.target.value as WorkflowStepType)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-cyan-500 text-xs font-mono"
                >
                  <option value="SEQUENTIAL">SEQUENTIAL (Synchronous Chain)</option>
                  <option value="PARALLEL">PARALLEL (Concurrent Branch)</option>
                  <option value="CONDITIONAL">CONDITIONAL (Rules Decision)</option>
                  <option value="HUMAN_APPROVAL">HUMAN_APPROVAL (Governance Sign-off)</option>
                  <option value="RETRY">RETRY (Auto-Backoff Loop)</option>
                </select>
              </div>

              {/* Custom Objective / Prompt */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">Step Objective &amp; Prompt</label>
                <textarea
                  rows={4}
                  value={selectedStep.objective}
                  onChange={(e) => handleUpdateStep('objective', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:border-cyan-500 text-xs leading-relaxed"
                  placeholder="Describe the exact sub-agent directive..."
                />
              </div>

              {/* Governance & Approval Policy */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Governance &amp; Controls</div>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedStep.requiresApproval)}
                    onChange={(e) => handleUpdateStep('requiresApproval', e.target.checked)}
                    className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <span className="text-[11px] font-medium text-slate-700">Require Human Sign-off</span>
                </label>
              </div>

              {/* Step Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => handleDuplicateStep(selectedStepIndex || 0)}
                  className="flex items-center space-x-1 text-slate-600 hover:text-slate-900 text-xs font-semibold py-1.5 px-2.5 rounded bg-slate-100 hover:bg-slate-200 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Duplicate</span>
                </button>

                <button
                  onClick={() => handleRemoveStep(selectedStepIndex || 0)}
                  className="flex items-center space-x-1 text-rose-600 hover:text-rose-700 text-xs font-semibold py-1.5 px-2.5 rounded bg-rose-50 hover:bg-rose-100 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Step</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Settings className="w-6 h-6 mx-auto opacity-50" />
              <p className="text-[11px]">Select a step on the canvas to inspect and configure its parameters.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* JSON Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <FileCode className="w-4 h-4 text-cyan-600" />
                <h3 className="text-sm font-bold text-slate-900">Import Workflow JSON</h3>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste a valid Vortex One workflow definition with `name` and `steps` array.
            </p>

            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-slate-900 font-mono text-xs focus:outline-none focus:border-cyan-500"
              placeholder='{ "name": "Custom DAG", "steps": [...] }'
            />

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImportJSON}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg transition shadow-xs"
              >
                Import Workflow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Workflow Templates Library Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pre-Built Workflow Templates Library</h3>
                  <p className="text-xs text-slate-500">Select a pre-configured multi-agent workflow template to instantly load into the builder.</p>
                </div>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {WORKFLOW_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="border border-slate-200 hover:border-cyan-400 rounded-xl p-4 bg-slate-50 hover:bg-cyan-50/30 transition flex flex-col justify-between space-y-3 group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">
                        {tpl.category}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-slate-500">
                        {tpl.steps.length} Steps
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-cyan-900">{tpl.name}</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{tpl.description}</p>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-200/70">
                    <div className="text-[10px] font-bold uppercase text-slate-400">Included Steps:</div>
                    <div className="space-y-1">
                      {tpl.steps.map((st, idx) => (
                        <div key={idx} className="flex items-center space-x-1.5 text-[11px] text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                          <span className="truncate">{st.name}</span>
                          <span className="text-[9px] font-mono text-slate-400 ml-auto uppercase">({st.type})</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => handleLoadTemplate(tpl)}
                      className="w-full mt-2 py-2 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold transition shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Load Template into Editor</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
              >
                Close Library
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

