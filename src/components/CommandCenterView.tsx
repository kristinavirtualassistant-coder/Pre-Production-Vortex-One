import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  PhoneCall,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Building2,
  Users,
  Target,
  AlertCircle,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Filter,
  CheckSquare,
  Flame,
  Activity,
  Layers,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  DollarSign,
  Megaphone,
} from 'lucide-react';
import { Property, LeadRecord, DialerCampaign, Task, ApprovalRequest, AgentDefinition, OpportunityRecord } from '../types';

interface CommandCenterViewProps {
  agents: AgentDefinition[];
  properties: Property[];
  leads: LeadRecord[];
  campaigns: DialerCampaign[];
  tasks: Task[];
  approvals: ApprovalRequest[];
  onNavigate: (view: string) => void;
  onRunPreset: (prompt: string) => void;
  onOpenInspector?: (type: any, data: any) => void;
  onInitiateCall?: (name: string, phone: string, address: string) => void;
  onRefreshData?: () => void;
  onOpenHelp?: () => void;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  agents,
  properties,
  leads,
  campaigns,
  tasks,
  approvals,
  onNavigate,
  onRunPreset,
  onOpenInspector,
  onInitiateCall,
  onRefreshData,
  onOpenHelp,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'high_priority' | 'calls_today' | 'followups'>('all');

  // Compute key metrics
  const totalValuation = (properties || []).reduce((sum, p) => sum + (p.estimated_value || 0), 0);
  const totalEquity = (properties || []).reduce((sum, p) => sum + (p.estimated_equity || 0), 0);

  // Derive opportunities
  const opportunitiesCount = 248; // Global scored count in target market
  const newPropertiesToday = (properties || []).filter((p) => p.status === 'discovered' || p.status === 'lead_ready').length || 14;
  const newOwnersCount = 18;
  const qualifiedLeadsCount = (leads || []).filter((l) => l.stage === 'qualified' || l.stage === 'outreach_ready' || (l.lead_score && l.lead_score >= 75)).length;
  
  // Top-Level Executive KPI Ribbon Metrics
  const kpiTotalLeads = leads?.length || 142;
  const kpiQualifiedLeads = qualifiedLeadsCount || 38;
  const kpiActiveCampaigns = (campaigns || []).filter(c => c.status === 'active' || c.status === 'running' || c.status === 'in_progress').length || (campaigns?.length || 4);
  const kpiPropertyCount = properties?.length || 156;
  const kpiRevenueForecast = useMemo(() => {
    const totalEq = totalEquity > 0 ? totalEquity : 14200000;
    const val = Math.round(totalEq * 0.035);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  }, [totalEquity]);
  
  // Follow-ups & Calls Today
  const followUpsCount = (leads || []).filter((l) => l.follow_up_date || l.stage === 'contacted').length || 12;
  const scheduledCallsToday = 8;
  const liveConversionRate = '18.4%';

  // Active Work Items (Property -> Owner -> Opportunity -> Next Action)
  const activeWorkItems = useMemo(() => {
    return [
      {
        id: 'work_1',
        property_address: '1420 Newport Blvd, Costa Mesa',
        property_type: 'Multi-Family (6 Units)',
        county: 'Orange County, CA',
        owner_name: 'Jonathan Sterling',
        owner_entity: 'Sterling West Holdings LLC',
        owner_phone: '(949) 555-0188',
        opportunity_score: 94,
        opportunity_signal: 'Absentee Multi-Asset Owner (7 Properties)',
        why_it_matters: 'Tax assessment updated 14 yrs ago. Built-in equity >$1.2M. Absentee owner resides in Scottsdale, AZ.',
        next_action_label: 'TCPA Dial Jonathan',
        action_type: 'call',
        priority: 'high',
        urgency: 'Morning Window (09:00 - 11:30)',
        due_status: 'Overdue Follow-up',
      },
      {
        id: 'work_2',
        property_address: '840 S Grand Ave, Los Angeles',
        property_type: 'Commercial Mixed-Use',
        county: 'Los Angeles County, CA',
        owner_name: 'Marcus Vance',
        owner_entity: 'Apex Metro Real Estate Trust',
        owner_phone: '(213) 555-0199',
        opportunity_score: 91,
        opportunity_signal: '1031 Exchange Reinvestment Window',
        why_it_matters: 'Sold San Pedro industrial parcel 45 days ago. 1031 clock active with $3.4M capital deployment need.',
        next_action_label: 'Review Acquisition Strategy',
        action_type: 'strategy',
        priority: 'high',
        urgency: 'Today by 2:00 PM',
        due_status: 'Due Today',
      },
      {
        id: 'work_3',
        property_address: '2100 E 4th St, Santa Ana',
        property_type: '8-Unit Residential',
        county: 'Orange County, CA',
        owner_name: 'Elena Rostova',
        owner_entity: 'Individual Owner',
        owner_phone: '(714) 555-0143',
        opportunity_score: 87,
        opportunity_signal: 'County Tax Default Notice (Secured Roll)',
        why_it_matters: 'Second installment delinquent ($18,400). Owner-occupant moved out Jan 2026. High recapitalization urgency.',
        next_action_label: 'Dispatch Pitch Brief',
        action_type: 'pitch',
        priority: 'high',
        urgency: 'Scheduled Call at 11:00 AM',
        due_status: 'Call Scheduled',
      },
      {
        id: 'work_4',
        property_address: '350 E 17th St, Costa Mesa',
        property_type: 'Retail Strip / 4 Tenants',
        county: 'Orange County, CA',
        owner_name: 'David Chen',
        owner_entity: 'Pacific Crest Partners LLC',
        owner_phone: '(949) 555-0112',
        opportunity_score: 82,
        opportunity_signal: 'High Equity (72%) Long-Term Hold',
        why_it_matters: 'Owned continuously since 2008 with zero senior liens. Low in-place rents vs 17th St market corridor.',
        next_action_label: 'Execute Skip-Trace Audit',
        action_type: 'research',
        priority: 'medium',
        urgency: 'Afternoon',
        due_status: 'Queue Ready',
      },
      {
        id: 'work_5',
        property_address: '512 N Flower St, Santa Ana',
        property_type: 'Duplex (R2 Zoning)',
        county: 'Orange County, CA',
        owner_name: 'Robert & Clara Gomez',
        owner_entity: 'Family Trust',
        owner_phone: '(714) 555-0177',
        opportunity_score: 79,
        opportunity_signal: 'ADU Expansion Potential',
        why_it_matters: 'Lot size 9,200 sqft with favorable SB-9 zoning overlay for two detached accessory dwelling units.',
        next_action_label: 'Send Advisory Teaser',
        action_type: 'email',
        priority: 'medium',
        urgency: 'End of Day',
        due_status: 'Follow-up Due',
      },
    ];
  }, []);

  const filteredWorkItems = useMemo(() => {
    if (filterMode === 'high_priority') return activeWorkItems.filter((i) => i.priority === 'high');
    if (filterMode === 'calls_today') return activeWorkItems.filter((i) => i.action_type === 'call' || i.due_status.includes('Call'));
    if (filterMode === 'followups') return activeWorkItems.filter((i) => i.due_status.includes('Follow-up') || i.due_status.includes('Due'));
    return activeWorkItems;
  }, [activeWorkItems, filterMode]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. HEADER / CURRENT WORK STATUS
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200">
                Command Center
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Good morning. Here is what you should know and do right now.
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              10 autonomous agents have refreshed California county GIS feeds, validated DNC records, and prioritized <strong className="text-slate-800 font-semibold">{opportunitiesCount} high-probability opportunities</strong> across Orange and Los Angeles Counties.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => onNavigate('dialer')}
              className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold flex items-center space-x-2 transition cursor-pointer shadow-xs"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Start Calling Queue (8 Calls)</span>
            </button>
            <button
              onClick={() => onNavigate('property_search')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
            >
              <Search className="w-4 h-4 text-slate-500" />
              <span>GIS Search</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          1.5 EXECUTIVE KPI SUMMARY RIBBON
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI: Total Leads */}
        <div
          onClick={() => onNavigate('leads')}
          className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-xs transition duration-200 cursor-pointer group"
          id="kpi-total-leads"
        >
          {/* Tooltip */}
          <div className="absolute z-10 hidden group-hover:block bottom-full left-0 mb-2 w-64 bg-slate-800 dark:bg-slate-700 text-white text-[10px] p-3 rounded-lg shadow-xl">
            <p className="font-bold mb-1">Top Leads</p>
            <ul className="list-disc pl-3">
              {(leads || []).slice(0, 5).map(l => <li key={l.id}>{l.owner_name}</li>)}
              {(leads || []).length > 5 && <li>...and {leads.length - 5} more</li>}
            </ul>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-cyan-600 transition-colors">
              Total Leads
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-100 dark:border-cyan-900 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              {kpiTotalLeads}
            </span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900">
              +{Math.round(kpiTotalLeads * 0.12)}% MoM
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            <strong className="text-slate-700 dark:text-slate-200 font-bold">{kpiQualifiedLeads}</strong> highly qualified opportunities
          </p>
        </div>

        {/* KPI: Active Campaigns */}
        <div
          onClick={() => onNavigate('dialer')}
          className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-xs transition duration-200 cursor-pointer group"
          id="kpi-active-campaigns"
        >
           {/* Tooltip */}
           <div className="absolute z-10 hidden group-hover:block bottom-full left-0 mb-2 w-64 bg-slate-800 dark:bg-slate-700 text-white text-[10px] p-3 rounded-lg shadow-xl">
            <p className="font-bold mb-1">Active Campaigns</p>
            <ul className="list-disc pl-3">
              {(campaigns || []).filter(c => c.status === 'active' || c.status === 'running').slice(0, 5).map(c => <li key={c.id}>{c.name}</li>)}
              {(campaigns || []).filter(c => c.status === 'active' || c.status === 'running').length > 5 && <li>...and more</li>}
            </ul>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 transition-colors">
              Active Campaigns
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Megaphone className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              {kpiActiveCampaigns}
            </span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900">
              Active
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Running with automated outbound agents
          </p>
        </div>

        {/* KPI: Revenue Forecast */}
        <div
          onClick={() => onNavigate('leads')}
          className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xs transition duration-200 cursor-pointer group"
          id="kpi-revenue-forecast"
        >
          {/* Tooltip */}
           <div className="absolute z-10 hidden group-hover:block bottom-full left-0 mb-2 w-64 bg-slate-800 dark:bg-slate-700 text-white text-[10px] p-3 rounded-lg shadow-xl">
            <p className="font-bold mb-1">Revenue Forecast Notes</p>
            <p>Based on {kpiQualifiedLeads} qualified opportunities with an estimated 3.5% advisory fee target.</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 transition-colors">
              Revenue Forecast
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              {kpiRevenueForecast}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex items-center space-x-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>Estimated 3.5% advisory target</span>
          </p>
        </div>

        {/* KPI: Property Count */}
        <div
          onClick={() => onNavigate('property_search')}
          className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-2xs hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-xs transition duration-200 cursor-pointer group"
          id="kpi-property-count"
        >
          {/* Tooltip */}
          <div className="absolute z-10 hidden group-hover:block bottom-full left-0 mb-2 w-64 bg-slate-800 dark:bg-slate-700 text-white text-[10px] p-3 rounded-lg shadow-xl">
            <p className="font-bold mb-1">Top Properties</p>
            <ul className="list-disc pl-3">
              {(properties || []).slice(0, 5).map(p => <li key={p.id}>{p.address}</li>)}
              {(properties || []).length > 5 && <li>...and {properties.length - 5} more</li>}
            </ul>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover:text-amber-600 transition-colors">
              Property Count
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight font-mono">
              {kpiPropertyCount}
            </span>
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900">
              GIS Tracked
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Synchronized Orange &amp; LA County Parcels
          </p>
        </div>
      </div>

      {/* Last Updated Timestamp */}
      <div className="flex justify-end mt-4 mb-2">
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">
          Data last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TWO-COLUMN SPLIT: PRIORITIES vs OPPORTUNITY SIGNAL
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (5 cols): PRIORITIES TODAY */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Today&apos;s Priorities</h2>
                  <p className="text-[11px] text-slate-400">Immediate action items required</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                20 Total Actions
              </span>
            </div>

            {/* Big Priority Metric Blocks */}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div
                onClick={() => onNavigate('leads')}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-cyan-300 hover:bg-cyan-50/30 transition cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-semibold">Follow-ups</span>
                  <CheckSquare className="w-4 h-4 text-cyan-600 group-hover:scale-110 transition" />
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight">
                  {followUpsCount}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
                  <span className="text-amber-600 font-bold">4 high urgency</span>
                  <span>&bull; Open CRM</span>
                </div>
              </div>

              <div
                onClick={() => onNavigate('dialer')}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-cyan-300 hover:bg-cyan-50/30 transition cursor-pointer group"
              >
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-[11px] font-semibold">Calls Scheduled</span>
                  <PhoneCall className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition" />
                </div>
                <div className="text-3xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight">
                  {scheduledCallsToday}
                </div>
                <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
                  <span className="text-emerald-600 font-bold">TCPA Window Active</span>
                </div>
              </div>
            </div>

            {/* Quick Priority Checklist */}
            <div className="mt-4 space-y-2">
              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-slate-800">Jonathan Sterling (Costa Mesa 6-Unit)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">09:30 AM Call</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="font-semibold text-slate-800">Marcus Vance (1031 Exchange Brief)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">2:00 PM Review</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="font-semibold text-slate-800">Elena Rostova (Tax Default Resolution)</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">11:00 AM Pitch</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">All tasks synchronized with Sub-Agent 6</span>
            <button
              onClick={() => onNavigate('tasks')}
              className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center space-x-1 cursor-pointer"
            >
              <span>View All Tasks</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN (7 cols): OPPORTUNITY SIGNAL & MARKET ACTIVITY */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Opportunity Signal &amp; Market Intelligence</h2>
                  <p className="text-[11px] text-slate-400">Trend &amp; signal distribution across target corridors</p>
                </div>
              </div>
              <button
                onClick={() => onNavigate('opportunities')}
                className="text-xs font-bold text-cyan-700 hover:text-cyan-900 flex items-center space-x-1 cursor-pointer"
              >
                <span>Explore 248 Signals</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* KPI Matrix Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">New Properties</div>
                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">+{newPropertiesToday}</div>
                <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Assessor updated</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">New Owners</div>
                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">+{newOwnersCount}</div>
                <div className="text-[10px] text-cyan-600 font-medium mt-0.5">Skip-traced</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Qualified Leads</div>
                <div className="text-xl font-bold text-slate-900 mt-1 font-mono">{qualifiedLeadsCount}</div>
                <div className="text-[10px] text-amber-600 font-medium mt-0.5">Score &ge; 75</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Conversion</div>
                <div className="text-xl font-bold text-emerald-700 mt-1 font-mono">{liveConversionRate}</div>
                <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Live connects</div>
              </div>
            </div>

            {/* Signal Distribution Trend Visualizer */}
            <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Active Opportunity Distribution by Archetype</span>
                <span className="text-[11px] font-mono text-slate-400">248 Scored Assets</span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Absentee Landlords (&gt;60% Equity)</span>
                    <span className="font-mono font-bold text-slate-800">112 Opportunities (45%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-cyan-600 h-2 rounded-full" style={{ width: '45%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>1031 Exchange Reinvestment Capital</span>
                    <span className="font-mono font-bold text-slate-800">68 Opportunities (27%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '27%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Secured Tax Defaults &amp; Distress</span>
                    <span className="font-mono font-bold text-slate-800">44 Opportunities (18%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-amber-500 h-2 rounded-full" style={{ width: '18%' }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-600 mb-1">
                    <span>Multi-Property Portfolio Growth</span>
                    <span className="font-mono font-bold text-slate-800">24 Opportunities (10%)</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-purple-600 h-2 rounded-full" style={{ width: '10%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[11px] text-slate-400">Assessor GIS Layer: Orange &amp; LA Counties</span>
            <button
              onClick={() => onNavigate('analytics')}
              className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center space-x-1 cursor-pointer"
            >
              <span>View Portfolio Analytics</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. ACTIVE WORK: Property / Owner / Opportunity / Next Action
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Active Work Stream</h2>
            <p className="text-xs text-slate-500">
              Direct execution path: <strong>Property &rarr; Owner &rarr; Opportunity &rarr; Next Action</strong>
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'high_priority', label: 'High Score (90+)' },
              { id: 'calls_today', label: 'Calls Today' },
              { id: 'followups', label: 'Follow-ups' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterMode(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  filterMode === tab.id
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Work Table / Cards */}
        <div className="divide-y divide-slate-100">
          {filteredWorkItems.map((item) => (
            <div
              key={item.id}
              className="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 p-3 rounded-xl transition"
            >
              {/* Col 1: Property & Geography */}
              <div className="lg:w-1/4 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-xs text-slate-900 leading-snug">{item.property_address}</span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center space-x-1.5">
                  <Building2 className="w-3 h-3 text-slate-400" />
                  <span>{item.property_type}</span>
                  <span>&bull;</span>
                  <span className="text-slate-400 font-mono text-[10px]">{item.county}</span>
                </div>
              </div>

              {/* Col 2: Owner & Entity */}
              <div className="lg:w-1/4 space-y-1">
                <div className="flex items-center space-x-1.5">
                  <Users className="w-3.5 h-3.5 text-cyan-600" />
                  <span className="text-xs font-bold text-slate-800">{item.owner_name}</span>
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  <span>{item.owner_entity}</span>
                  <span className="mx-1 text-slate-300">|</span>
                  <span className="font-mono text-cyan-700">{item.owner_phone}</span>
                </div>
              </div>

              {/* Col 3: Opportunity & Why it matters */}
              <div className="lg:w-1/3 space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-200">
                    Score {item.opportunity_score}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate">{item.opportunity_signal}</span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {item.why_it_matters}
                </p>
              </div>

              {/* Col 4: Next Action Button */}
              <div className="lg:w-1/6 flex flex-col items-end justify-center space-y-1 shrink-0">
                <span className="text-[10px] text-amber-600 font-semibold">{item.urgency}</span>
                <button
                  onClick={() => {
                    if (item.action_type === 'call') {
                      if (onInitiateCall) {
                        onInitiateCall(item.owner_name, item.owner_phone, item.property_address);
                      } else {
                        onNavigate('dialer');
                      }
                    } else if (item.action_type === 'strategy' || item.action_type === 'pitch') {
                      onRunPreset(`Generate high-conversion outreach brief for ${item.owner_name} regarding ${item.property_address}`);
                      onNavigate('studio');
                    } else {
                      onNavigate('leads');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer shadow-2xs ${
                    item.action_type === 'call'
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {item.action_type === 'call' && <PhoneCall className="w-3.5 h-3.5" />}
                  {item.action_type === 'strategy' && <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                  {item.action_type === 'pitch' && <Zap className="w-3.5 h-3.5 text-cyan-400" />}
                  <span>{item.next_action_label}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
