import React from 'react';
import {
  BrainCircuit,
  Building2,
  Users,
  PhoneCall,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Database,
  Layers,
  Sparkles,
  TrendingUp,
  Megaphone,
  CheckSquare,
  Activity,
  AlertCircle,
  Lightbulb,
  BookOpen,
  Mail,
  HelpCircle,
  SlidersHorizontal,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  X,
  GripVertical,
  Cpu,
} from 'lucide-react';
import { AgentDefinition, Property, LeadRecord, DialerCampaign, Task, ApprovalRequest } from '../types';
import { PropertyTaskScheduler } from './PropertyTaskScheduler';
import { PropertyTrendChart } from './PropertyTrendChart';
import { RecentActivitySidebar } from './RecentActivitySidebar';
import { DashboardCustomizerModal } from './DashboardCustomizerModal';
import { DashboardCalendarView } from './DashboardCalendarView';
import { SystemResourceMonitorModal } from './SystemResourceMonitorModal';
import { Tooltip, InfoTooltip, GLOSSARY } from './Tooltip';

interface DashboardViewProps {
  agents: AgentDefinition[];
  properties: Property[];
  leads: LeadRecord[];
  campaigns: DialerCampaign[];
  tasks: Task[];
  approvals: ApprovalRequest[];
  onNavigate: (view: string) => void;
  onRunPreset: (prompt: string) => void;
  onRefreshData?: () => void;
  onOpenHelp?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  agents,
  properties,
  leads,
  campaigns,
  tasks,
  approvals,
  onNavigate,
  onRunPreset,
  onRefreshData,
  onOpenHelp,
}) => {
  // Dynamic KPI Data Calculations
  const totalProperties = properties.length;
  const totalValuation = properties.reduce((acc, p) => acc + (p.estimated_value || 0), 0);
  const totalEquity = properties.reduce((acc, p) => acc + (p.estimated_equity || 0), 0);
  const totalUnits = properties.reduce((acc, p) => acc + (p.units_count || 1), 0);
  const absenteeProperties = properties.filter((p) => p.is_absentee_owner).length;

  const totalLeads = leads.length;
  const activeLeads = leads.filter((l) => l.stage !== 'lost' && l.classification !== 'disqualified').length;
  const highPriorityLeads = leads.filter(
    (l) => l.classification === 'high_priority' || (l.lead_score && l.lead_score >= 80)
  ).length;
  const qualifiedLeads = leads.filter(
    (l) => l.stage === 'qualified' || l.stage === 'outreach_ready' || l.stage === 'contacted'
  ).length;
  const avgLeadScore =
    leads.length > 0
      ? Math.round(leads.reduce((acc, l) => acc + (l.lead_score || 0), 0) / leads.length)
      : 0;

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const totalContactsTargeted = campaigns.reduce((acc, c) => acc + (c.total_contacts || 0), 0);
  const totalDialed = campaigns.reduce((acc, c) => acc + (c.dialed_count || 0), 0);
  const totalConverted = campaigns.reduce((acc, c) => acc + (c.converted_count || 0), 0);
  const conversionRate = totalDialed > 0 ? ((totalConverted / totalDialed) * 100).toFixed(1) : '0.0';

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const highRiskApprovals = pendingApprovals.filter(
    (a) => a.risk_level === 'high' || a.risk_level === 'critical'
  ).length;
  const totalApproved = approvals.filter((a) => a.status === 'approved').length;

  // Dashboard layout customization & drag-and-drop state
  const [moduleOrder, setModuleOrder] = React.useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vortex_one_dashboard_module_order');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return ['metrics', 'trendAndActivity', 'taskScheduler', 'presets', 'fleetAndTasks'];
  });

  const [hiddenModules, setHiddenModules] = React.useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('vortex_one_dashboard_hidden_modules');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
  });

  const [isCustomizerOpen, setIsCustomizerOpen] = React.useState(false);
  const [isResourceMonitorOpen, setIsResourceMonitorOpen] = React.useState(false);
  const [draggedModuleId, setDraggedModuleId] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      localStorage.setItem('vortex_one_dashboard_module_order', JSON.stringify(moduleOrder));
    } catch (e) {}
  }, [moduleOrder]);

  React.useEffect(() => {
    try {
      localStorage.setItem('vortex_one_dashboard_hidden_modules', JSON.stringify(hiddenModules));
    } catch (e) {}
  }, [hiddenModules]);

  const moveModule = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...moduleOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;
    setModuleOrder(newOrder);
  };

  const toggleVisibility = (id: string) => {
    setHiddenModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetLayout = () => {
    setModuleOrder(['metrics', 'trendAndActivity', 'taskScheduler', 'presets', 'fleetAndTasks']);
    setHiddenModules({});
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedModuleId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedModuleId || draggedModuleId === targetId) return;
    const newOrder = [...moduleOrder];
    const draggedIdx = newOrder.indexOf(draggedModuleId);
    const targetIdx = newOrder.indexOf(targetId);
    if (draggedIdx !== -1 && targetIdx !== -1) {
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedModuleId);
      setModuleOrder(newOrder);
    }
    setDraggedModuleId(null);
  };

  const moduleMeta: Record<string, { title: string; desc: string }> = {
    metrics: { title: 'Executive Portfolio KPIs', desc: 'Summary metrics for properties, active leads, campaigns, and approvals.' },
    trendAndActivity: { title: 'D3 Trend Chart & Recent Activity', desc: '30-day property discovery vs skip trace chart and real-time agent activity sidebar.' },
    taskScheduler: { title: 'Background Task Scheduler', desc: '24-hour automated refresh controls for selected property records.' },
    presets: { title: 'Fast Multi-Agent Dispatch Presets', desc: 'Pre-configured AI agent orchestration workflows.' },
    fleetAndTasks: { title: 'Agent Fleet Monitor & Recent Tasks', desc: 'Hierarchical Sub-Agent 0-9 status and Cloud SQL audit stream.' },
  };

  const presetWorkflows = [
    {
      title: 'Orange County Absentee Owner Prospecting',
      description: 'Agent 1 coordinates Sub-Agent 1 (Property), 4 (Enrichment), 2 (Lead Scoring), and 9 (QA) to find high-equity multi-family prospects.',
      prompt: 'Find property owners in Orange County who own multiple properties with >$1M equity and identify the best prospects for property management.',
      icon: Building2,
      color: 'from-blue-500/20 to-cyan-500/20 border-cyan-500/30 text-cyan-400',
    },
    {
      title: 'Absentee Landlord Call Strategy & Brief',
      description: 'Agent 1 directs Sub-Agent 5 (Outreach) to generate high-conversion management pitches, objection handling, and audio briefings.',
      prompt: 'Generate an executive outreach call strategy and pitch brief for Jonathan Sterling of Sterling West Holdings LLC regarding the 6-unit Newport Blvd asset.',
      icon: PhoneCall,
      color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400',
    },
    {
      title: 'Comprehensive Portfolio Compliance & QA Audit',
      description: 'Audit existing CRM leads against TCPA suppression records and verify calculation hashes via Sub-Agent 7 & 9.',
      prompt: 'Run an independent compliance audit and QA verification across all current Orange County leads to ensure TCPA adherence and provenance validation.',
      icon: ShieldCheck,
      color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / System Status */}
      <div id="dashboard-top-banner" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-1">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Vortex One Command Center</h1>
              <Tooltip
                content="Vortex One operates 10 specialized autonomous sub-agents organized in a hierarchical orchestrator structure, each handling property lookup, scoring, audio briefs, or compliance."
                position="bottom"
              >
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 rounded flex items-center space-x-1 cursor-help">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  <span>All {agents.length} Agents Active</span>
                </span>
              </Tooltip>
            </div>
            <p className="text-xs text-slate-500">
              Hierarchical Multi-Agent AI OS coordinating specialized sub-agents for property intelligence, CRM qualification, and dialer outreach.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Tooltip
              content="Open the Multi-Agent Prompt Studio to trigger custom tasks, multi-agent DAG pipelines, or pre-built acquisition workflows."
              position="bottom"
            >
              <button
                id="dashboard-launch-studio-btn"
                onClick={() => onNavigate('studio')}
                className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-xs cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>Launch Multi-Agent Studio</span>
              </button>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Quick-Start: The 4-Step Acquisition Loop */}
      <div id="dashboard-acquisition-loop-card" className="bg-gradient-to-r from-slate-900 to-cyan-950 rounded-2xl p-5 text-white shadow-md border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold tracking-tight text-white">The Vortex One 4-Step Workflow</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">
                  Easy Guide
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Follow this simple 4-step sequence from raw public property search to verified lead outreach.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsResourceMonitorOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-sm cursor-pointer shrink-0"
              title="Open System Resource Monitor & Real-Time Load Spikes"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>System Resource Monitor</span>
            </button>

            <button
              onClick={() => setIsCustomizerOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/10 cursor-pointer shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-300" />
              <span>Customize Layout</span>
            </button>

            {onOpenHelp && (
              <Tooltip
                content="Open the complete 60-second interactive visual walkthrough and searchable jargon buster definitions."
                position="left"
              >
                <button
                  onClick={onOpenHelp}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/10 cursor-pointer shrink-0"
                >
                  <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Open Jargon Buster &amp; Full Guide</span>
                </button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* 4 Step Horizontal Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Step 1: Search Real Properties */}
          <Tooltip
            content="Search live county GIS parcels and public roll records across California by APN or street address. All records retain exact legal provenance."
            position="top"
          >
            <div
              onClick={() => onNavigate('properties')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 rounded-xl p-3.5 transition cursor-pointer group flex flex-col justify-between h-full"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-md bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono font-medium">
                    {totalProperties} Parcels
                  </span>
                </div>
                <h3 className="font-bold text-xs text-white group-hover:text-cyan-300 transition flex items-center space-x-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>Search Real Properties</span>
                </h3>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Search public records across California &amp; Orange County by APN, Address, or Owner.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-blue-300 font-semibold group-hover:text-white">
                <span>Search Parcels</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </Tooltip>

          {/* Step 2: Score Leads */}
          <Tooltip
            content="Sub-Agent 2 Lead Scoring calculates a composite acquisition score (0-100) combining estimated equity, absentee distance, and tax status."
            position="top"
          >
            <div
              onClick={() => onNavigate('leads')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-400/50 rounded-xl p-3.5 transition cursor-pointer group flex flex-col justify-between h-full"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <span className="text-[10px] text-emerald-300 font-mono font-medium">
                    {highPriorityLeads} Priority
                  </span>
                </div>
                <h3 className="font-bold text-xs text-white group-hover:text-emerald-300 transition flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>AI Scores Leads (0-100)</span>
                </h3>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Sub-Agent 2 automatically ranks prospects by equity &amp; absentee ownership.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-emerald-300 font-semibold group-hover:text-white">
                <span>View Scored Leads</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </Tooltip>

          {/* Step 3: Outreach Templates */}
          <Tooltip
            content="Sub-Agent 5 generates tailored Email, SMS, and cold-call scripts injected with exact property values, unit counts, and tax history."
            position="top"
          >
            <div
              onClick={() => onNavigate('studio')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/50 rounded-xl p-3.5 transition cursor-pointer group flex flex-col justify-between h-full"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-md bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono font-medium">
                    Omnichannel
                  </span>
                </div>
                <h3 className="font-bold text-xs text-white group-hover:text-cyan-300 transition flex items-center space-x-1">
                  <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Draft Smart Outreach</span>
                </h3>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Auto-fill Email, SMS, and Call Scripts with real owner and assessor merge variables.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-cyan-300 font-semibold group-hover:text-white">
                <span>Open Templates</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </Tooltip>

          {/* Step 4: Human Approvals */}
          <Tooltip
            content="Mandatory human sign-off gate for high-risk actions. No automated phone calls or mass campaigns can be dispatched without explicit broker approval."
            position="top"
          >
            <div
              onClick={() => onNavigate('approvals')}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/50 rounded-xl p-3.5 transition cursor-pointer group flex flex-col justify-between h-full"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-md bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold flex items-center justify-center">
                    4
                  </span>
                  <span className="text-[10px] text-amber-300 font-mono font-medium">
                    {pendingApprovals.length} Pending
                  </span>
                </div>
                <h3 className="font-bold text-xs text-white group-hover:text-amber-300 transition flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Human Approval Sign-off</span>
                </h3>
                <p className="text-[11px] text-slate-300 leading-tight">
                  Review and approve all outgoing campaigns before a single message or call is sent.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-amber-300 font-semibold group-hover:text-white">
                <span>Review Approvals</span>
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </Tooltip>
        </div>
      </div>

      {/* Top High-Level Summary Section / KPI Cards Grid */}
      <div id="dashboard-kpi-summary-section" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-600" />
            <span>Executive Portfolio KPIs &amp; Live Telemetry</span>
          </h2>
          <span className="text-[11px] text-slate-400 font-medium">Click any KPI card to drill down into records</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Properties Under Management */}
          <div
            id="kpi-properties-under-management"
            onClick={() => onNavigate('properties')}
            className="bg-white border border-slate-200 hover:border-cyan-500 rounded-xl p-5 shadow-xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-700 group-hover:text-cyan-700 transition">
                    Properties Managed
                  </span>
                  <InfoTooltip
                    text="Total real estate parcels retrieved from authoritative public assessor records and stored in the database."
                    position="top"
                  />
                </div>
                <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 group-hover:scale-105 transition">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-slate-900 tracking-tight group-hover:text-cyan-800 transition">
                  {totalProperties}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {totalUnits > 0 ? `(${totalUnits} units)` : 'assets'}
                </span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>Portfolio Value:</span>
                    <InfoTooltip text="Combined estimated market valuation across all managed property parcels." />
                  </span>
                  <span className="font-semibold text-slate-900">
                    ${(totalValuation / 1000000).toFixed(2)}M
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>Estimated Equity:</span>
                    <InfoTooltip text={GLOSSARY.EQUITY} />
                  </span>
                  <span className="font-semibold text-cyan-700">
                    ${(totalEquity / 1000000).toFixed(2)}M
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>Absentee Owners:</span>
                    <InfoTooltip text={GLOSSARY.ABSENTEE} />
                  </span>
                  <span className="font-medium text-slate-700">
                    {absenteeProperties} ({totalProperties > 0 ? Math.round((absenteeProperties / totalProperties) * 100) : 0}%)
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-cyan-700 font-semibold group-hover:text-cyan-800">
              <span>Inspect Properties</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
          </div>

          {/* KPI 2: Active Leads */}
          <div
            id="kpi-active-leads"
            onClick={() => onNavigate('leads')}
            className="bg-white border border-slate-200 hover:border-emerald-500 rounded-xl p-5 shadow-xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-700 group-hover:text-emerald-700 transition">
                    Active Leads
                  </span>
                  <InfoTooltip
                    text="Property owners evaluated and ranked by Sub-Agent 2 Lead Scoring engine based on acquisition potential."
                    position="top"
                  />
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-slate-900 tracking-tight group-hover:text-emerald-800 transition">
                  {activeLeads}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  / {totalLeads} total
                </span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>High Priority (Score &gt;80):</span>
                    <InfoTooltip text={GLOSSARY.LEAD_SCORE} />
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {highPriorityLeads} leads
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>Outreach Ready:</span>
                    <InfoTooltip text="Leads with verified phone numbers, confirmed non-DNC status, and generated outreach briefing." />
                  </span>
                  <span className="font-semibold text-slate-900">
                    {qualifiedLeads} leads
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>Avg Quality Score:</span>
                    <InfoTooltip text="Mean acquisition propensity score across all active leads in CRM." />
                  </span>
                  <span className="font-medium text-slate-700">
                    {avgLeadScore}/100
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-emerald-700 font-semibold group-hover:text-emerald-800">
              <span>View Lead Pipeline</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
          </div>

          {/* KPI 3: Total Outreach Campaigns */}
          <div
            id="kpi-total-outreach-campaigns"
            onClick={() => onNavigate('dialer')}
            className="bg-white border border-slate-200 hover:border-purple-500 rounded-xl p-5 shadow-xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-700 group-hover:text-purple-700 transition">
                    Outreach Campaigns
                  </span>
                  <InfoTooltip
                    text="TCPA-compliant automated telephony and messaging campaigns managed by Sub-Agent 6."
                    position="top"
                  />
                </div>
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 group-hover:scale-105 transition">
                  <PhoneCall className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-bold text-slate-900 tracking-tight group-hover:text-purple-800 transition">
                  {totalCampaigns}
                </span>
                <span className="text-xs font-semibold text-purple-700">
                  ({activeCampaigns} active)
                </span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>Target Contacts:</span>
                    <InfoTooltip text="Total verified owners assigned to dialer queues across active campaigns." />
                  </span>
                  <span className="font-semibold text-slate-900">
                    {totalContactsTargeted} contacts
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>Calls Dialed:</span>
                    <InfoTooltip text="Outbound phone calls placed with real-time audio transcripts." />
                  </span>
                  <span className="font-semibold text-purple-700">
                    {totalDialed} placed
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>Conversion Rate:</span>
                    <InfoTooltip text="Percentage of contacted owners who agreed to an appraisal or listing appointment." />
                  </span>
                  <span className="font-medium text-slate-700">
                    {conversionRate}% ({totalConverted} won)
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-purple-700 font-semibold group-hover:text-purple-800">
              <span>Open Dialer &amp; Campaigns</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
          </div>

          {/* KPI 4: Pending Approvals */}
          <div
            id="kpi-pending-approvals"
            onClick={() => onNavigate('approvals')}
            className={`bg-white border ${
              pendingApprovals.length > 0
                ? 'border-amber-300 hover:border-amber-500'
                : 'border-slate-200 hover:border-emerald-500'
            } rounded-xl p-5 shadow-xs hover:shadow-md transition cursor-pointer group flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-slate-700 group-hover:text-amber-700 transition">
                    Pending Approvals
                  </span>
                  <InfoTooltip
                    text={GLOSSARY.HUMAN_APPROVAL}
                    position="top"
                  />
                </div>
                <div
                  className={`w-8 h-8 rounded-lg ${
                    pendingApprovals.length > 0
                      ? 'bg-amber-50 border border-amber-200 text-amber-600'
                      : 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                  } flex items-center justify-center group-hover:scale-105 transition`}
                >
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline space-x-2">
                <span
                  className={`text-3xl font-bold ${
                    pendingApprovals.length > 0 ? 'text-amber-600' : 'text-slate-900'
                  } tracking-tight`}
                >
                  {pendingApprovals.length}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    pendingApprovals.length > 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {pendingApprovals.length > 0 ? 'Action Required' : 'All Clear'}
                </span>
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-100 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>High / Critical Risk:</span>
                    <InfoTooltip text="Actions touching live telephony or bulk outreach queues requiring executive broker sign-off." />
                  </span>
                  <span
                    className={`font-semibold ${
                      highRiskApprovals > 0 ? 'text-amber-700' : 'text-slate-700'
                    }`}
                  >
                    {highRiskApprovals} requests
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>Approved to Date:</span>
                    <InfoTooltip text="Historical total of approved governance decisions securely logged to audit ledger." />
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {totalApproved} actions
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 flex items-center space-x-1">
                    <span>Governance Status:</span>
                    <InfoTooltip text="Human-in-the-loop safety protocol is enforced across all 10 autonomous sub-agents." />
                  </span>
                  <span className="font-medium text-slate-700">
                    Human-in-the-Loop Active
                  </span>
                </div>
              </div>
            </div>
            <div
              className={`mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between text-[11px] ${
                pendingApprovals.length > 0 ? 'text-amber-700' : 'text-slate-600'
              } font-semibold group-hover:text-amber-800`}
            >
              <span>{pendingApprovals.length > 0 ? 'Review Governance Queue' : 'Inspect Audit History'}</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
            </div>
          </div>
        </div>
      </div>

      {/* D3.js Visualization Trend Line & Recent Agent Activity Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PropertyTrendChart
            propertiesCount={properties.length}
            leadsCount={leads.length}
          />
        </div>
        <div className="lg:col-span-1">
          <RecentActivitySidebar
            tasks={tasks}
            agents={agents}
            properties={properties}
            leads={leads}
          />
        </div>
      </div>

      {/* Background Task Scheduler: 24-Hour Automated Refresh for Selected Property Records */}
      <PropertyTaskScheduler
        properties={properties}
        onRefreshData={onRefreshData}
      />

      {/* Interactive Task & Agent Action Calendar View */}
      <DashboardCalendarView
        tasks={tasks}
        campaigns={campaigns}
        leads={leads}
      />

      {/* Preset Multi-Agent Workflows */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <span>Fast Multi-Agent Dispatch Presets</span>
            <InfoTooltip text="Pre-configured multi-agent orchestration pipelines that trigger specialized sub-agents sequentially to accomplish specific acquisition goals." />
          </h2>
          <span className="text-xs text-slate-500">Executed by Agent 1 Master Orchestrator</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {presetWorkflows.map((preset, idx) => {
            const Icon = preset.icon;
            return (
              <Tooltip
                key={idx}
                content={`Click to execute preset: "${preset.title}". Sub-Agents will automatically coordinate to ingest, score, and draft outreach.`}
                position="top"
              >
                <div
                  className="bg-white border border-slate-200 hover:border-cyan-500 rounded-xl p-4 flex flex-col justify-between transition group cursor-pointer shadow-xs hover:shadow-md h-full"
                  onClick={() => onRunPreset(preset.prompt)}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 rounded-lg bg-cyan-50 border border-cyan-100 text-cyan-700">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">Preset 0{idx + 1}</span>
                    </div>
                    <h3 className="font-semibold text-sm text-slate-900 group-hover:text-cyan-700 transition">
                      {preset.title}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-cyan-700 font-semibold">
                    <span>Execute Pipeline</span>
                    <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
                  </div>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>

      {/* Agent Fleet Grid & Recent Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Agent Fleet Status */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <BrainCircuit className="w-4 h-4 text-cyan-600" />
              <span>Hierarchical Agent Fleet Monitor</span>
              <InfoTooltip text="Live telemetry across Sub-Agents 0 through 9 running specialized cognitive tasks in parallel." />
            </h2>
            <button
              onClick={() => onNavigate('agents')}
              className="text-xs text-cyan-700 hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
            >
              <span>View All Agents</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {agents.slice(0, 8).map((agent) => (
              <Tooltip
                key={agent.id}
                content={`${agent.name}: ${agent.primaryResponsibility}. Ready for orchestration.`}
                position="top"
              >
                <div
                  onClick={() => onNavigate('agents')}
                  className="bg-slate-50/80 border border-slate-200 hover:border-slate-300 p-3 rounded-lg flex items-start space-x-3 cursor-pointer transition hover:bg-slate-100/60 h-full"
                >
                  <div className="w-7 h-7 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    <BrainCircuit className="w-3.5 h-3.5 text-cyan-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-900 truncate">{agent.name}</span>
                      <span className="text-[9px] uppercase font-bold text-emerald-700 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                        <span>Online</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{agent.primaryResponsibility}</p>
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Right 1 Col: Recent Audit & Activity Stream */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-cyan-600" />
                <span>Recent System Tasks</span>
                <InfoTooltip text="Real-time execution log of background jobs, assessor queries, and scoring tasks." />
              </h2>
              <button
                onClick={() => onNavigate('tasks')}
                className="text-xs text-cyan-700 hover:underline font-semibold cursor-pointer"
              >
                Inspect
              </button>
            </div>

            <div className="space-y-2.5">
              {tasks.slice(0, 4).map((task) => (
                <div
                  key={task.task_id}
                  className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] font-semibold text-cyan-700">{task.assigned_agent}</span>
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {task.status}
                    </span>
                  </div>
                  <p className="text-slate-800 line-clamp-1 font-medium">{task.objective}</p>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="text-xs text-slate-400 py-6 text-center">
                  No recent tasks. Launch an agent workflow in the Studio.
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center space-x-1.5">
                <Database className="w-3.5 h-3.5 text-cyan-600" />
                <span>PostgreSQL 18.4 Schema</span>
                <InfoTooltip text="Cloud SQL relational storage with structured parcel, owner, lead, and audit ledger tables." />
              </span>
              <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                <span>Verified</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <DashboardCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        moduleOrder={moduleOrder}
        hiddenModules={hiddenModules}
        moveModule={moveModule}
        toggleVisibility={toggleVisibility}
        resetLayout={resetLayout}
        moduleMeta={moduleMeta}
      />

      <SystemResourceMonitorModal
        isOpen={isResourceMonitorOpen}
        onClose={() => setIsResourceMonitorOpen(false)}
        agents={agents}
      />

      {/* Dashboard Global Footer */}
      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center space-x-3">
          <button onClick={() => onNavigate('home')} className="hover:text-cyan-700 font-semibold cursor-pointer">Vortex One Home</button>
          <span>•</span>
          <button onClick={() => onNavigate('privacy')} className="hover:text-cyan-700 font-semibold cursor-pointer">Privacy Policy</button>
          <span>•</span>
          <button onClick={() => onNavigate('terms')} className="hover:text-cyan-700 font-semibold cursor-pointer">Terms of Service</button>
        </div>
        <div>
          CMC Realty &amp; Property Management • Enterprise Multi-Agent OS
        </div>
      </div>
    </div>
  );
};
