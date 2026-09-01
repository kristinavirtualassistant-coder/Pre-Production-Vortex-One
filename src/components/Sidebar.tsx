import React, { useState } from 'react';
import {
  Home,
  LayoutDashboard,
  Search,
  Building2,
  Users,
  Layers,
  Sparkles,
  Target,
  PhoneCall,
  Megaphone,
  CheckSquare,
  Zap,
  Activity,
  BarChart3,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Flame,
  Globe,
  HelpCircle,
  Bot,
  BrainCircuit,
  Cpu,
  UserCheck,
  ShieldAlert,
  Workflow as WorkflowIcon,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Radio,
} from 'lucide-react';
import { AgentDefinition } from '../types';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  pendingApprovals?: number;
  activeTasksCount?: number;
  onOpenHelp?: () => void;
  agents?: AgentDefinition[];
  onSelectAgent?: (agent: AgentDefinition) => void;
}

export interface NavItemConfig {
  id: string;
  label: string;
  symbol: string;
  icon: React.ComponentType<{ className?: string }>;
  category?: string;
  badge?: string;
  badgeCount?: number;
}

// Default fallback specialized agent list for sidebar display
const FALLBACK_SPECIALIZED_AGENTS: {
  id: string;
  name: string;
  shortName: string;
  role: string;
  symbol: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'agent_1', name: 'Master Orchestrator', shortName: 'Agent 1 • Orchestrator', role: 'orchestrator', symbol: '⌘', icon: BrainCircuit },
  { id: 'sub_agent_0', name: 'System Intelligence', shortName: 'Sub-0 • Reasoning', role: 'reasoning', symbol: '⎔', icon: Cpu },
  { id: 'sub_agent_1', name: 'Property Intelligence', shortName: 'Sub-1 • Property GIS', role: 'property', symbol: '◈', icon: Building2 },
  { id: 'sub_agent_2', name: 'Lead & CRM Intelligence', shortName: 'Sub-2 • Lead Scorer', role: 'crm_lead', symbol: '◉', icon: UserCheck },
  { id: 'sub_agent_3', name: 'Structured Research', shortName: 'Sub-3 • Skip Tracer', role: 'research', symbol: '⌕', icon: Search },
  { id: 'sub_agent_4', name: 'Data Enrichment', shortName: 'Sub-4 • Enrichment', role: 'enrichment', symbol: '◇', icon: Sparkles },
  { id: 'sub_agent_5', name: 'Compliance Guardrails', shortName: 'Sub-5 • Compliance', role: 'compliance', symbol: '⚑', icon: ShieldAlert },
  { id: 'sub_agent_6', name: 'Outreach & Dispatcher', shortName: 'Sub-6 • Outreach', role: 'outreach', symbol: '☎', icon: PhoneCall },
  { id: 'sub_agent_7', name: 'Analytics & Valuation', shortName: 'Sub-7 • Underwriter', role: 'analytics', symbol: '▥', icon: BarChart3 },
  { id: 'sub_agent_8', name: 'Automation & Integration', shortName: 'Sub-8 • Automations', role: 'automation', symbol: '⚡', icon: WorkflowIcon },
  { id: 'sub_agent_9', name: 'QA & Provenance Auditor', shortName: 'Sub-9 • QA Auditor', role: 'qa_audit', symbol: '✓', icon: CheckCheck },
];

export const PRIMARY_NAV_SECTIONS: {
  category: string;
  items: NavItemConfig[];
}[] = [
  {
    category: 'PROPERTY INTELLIGENCE',
    items: [
      { id: 'property_search', label: 'Property Search', symbol: '⌖', icon: Search, badge: 'GIS' },
      { id: 'properties', label: 'Properties', symbol: '◈', icon: Building2 },
      { id: 'owners', label: 'Owners', symbol: '◎', icon: Users },
      { id: 'portfolios', label: 'Portfolios', symbol: '▦', icon: Layers },
    ],
  },
  {
    category: 'GROWTH',
    items: [
      { id: 'opportunities', label: 'Opportunities', symbol: '◇', icon: Sparkles, badge: 'Scored' },
      { id: 'leads', label: 'Leads', symbol: '◉', icon: Target },
      { id: 'dialer', label: 'Dialer', symbol: '☎', icon: PhoneCall },
      { id: 'campaigns', label: 'Campaigns', symbol: '▤', icon: Megaphone },
    ],
  },
  {
    category: 'OPERATIONS',
    items: [
      { id: 'tasks', label: 'Tasks', symbol: '✓', icon: CheckSquare },
      { id: 'research_queue', label: 'Research Queue', symbol: '⌁', icon: Zap },
      { id: 'activity', label: 'Activity', symbol: '◫', icon: Activity },
    ],
  },
  {
    category: 'ANALYTICS',
    items: [
      { id: 'analytics', label: 'Analytics', symbol: '▥', icon: BarChart3 },
      { id: 'reports', label: 'Reports', symbol: '◌', icon: FileText },
    ],
  },
  {
    category: 'SYSTEM',
    items: [
      { id: 'settings', label: 'Settings', symbol: '⚙', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  pendingApprovals = 0,
  activeTasksCount = 0,
  onOpenHelp,
  agents = [],
  onSelectAgent,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFleetExpanded, setIsFleetExpanded] = useState(true);

  const isCommandCenterActive = currentView === 'dashboard' || currentView === 'home';
  const isAgentViewActive = currentView === 'agents';

  // Compute live specialized agents list
  const specializedAgentsList = FALLBACK_SPECIALIZED_AGENTS.map((fallback) => {
    const matched = agents.find((a) => a.id === fallback.id);
    const isOnline = matched ? matched.enabled !== false : true;
    return {
      ...fallback,
      isOnline,
      rawAgent: matched || {
        id: fallback.id,
        name: fallback.name,
        role: fallback.role as any,
        description: `${fallback.name} specialized AI cluster node.`,
        primaryResponsibility: fallback.name,
        systemInstructions: '',
        allowedTools: [],
        allowedData: [],
        model: 'gemini-3.5-flash',
        temperature: 0.1,
        permissions: ['read_only'],
        parentAgentId: fallback.id === 'agent_1' ? null : 'agent_1',
        enabled: true,
        capabilities: [],
      } as AgentDefinition,
    };
  });

  const onlineCount = specializedAgentsList.filter((a) => a.isOnline).length;
  const totalCount = specializedAgentsList.length;

  const handleAgentClick = (agentDef: AgentDefinition) => {
    if (onSelectAgent) {
      onSelectAgent(agentDef);
    } else {
      onNavigate('agents');
    }
  };

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col shrink-0 select-none transition-all duration-200 ${
        isCollapsed ? 'w-16' : 'w-60 lg:w-64'
      } shadow-xs z-20`}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        {!isCollapsed ? (
          <div
            onClick={() => onNavigate('dashboard')}
            className="flex items-center space-x-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-xs text-white">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-sm text-slate-900 tracking-tight">VORTEX ONE</span>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                  OS
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                Intelligence Platform
              </p>
            </div>
          </div>
        ) : (
          <div
            onClick={() => onNavigate('dashboard')}
            className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white cursor-pointer shadow-xs"
            title="VORTEX ONE"
          >
            <Layers className="w-4 h-4" />
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Top-Level: Command Center */}
        <div>
          <button
            onClick={() => onNavigate('dashboard')}
            title="Command Center"
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
            } rounded-lg text-xs font-semibold transition cursor-pointer ${
              isCommandCenterActive
                ? 'bg-cyan-50 text-cyan-900 font-bold border border-cyan-200 shadow-2xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
            }`}
          >
            <div className="flex items-center space-x-2.5 truncate">
              <span className={`text-sm ${isCommandCenterActive ? 'text-cyan-700' : 'text-slate-500'}`}>⌂</span>
              {!isCollapsed && <span className="truncate">Command Center</span>}
            </div>
            {!isCollapsed && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-mono">Live</span>
            )}
          </button>
        </div>

        {/* AI Agents Fleet Orchestration Section with Live Online/Offline Status Indicators */}
        <div className="space-y-1">
          {!isCollapsed ? (
            <div className="flex items-center justify-between px-3 py-1">
              <div className="flex items-center space-x-1.5">
                <Bot className="w-3 h-3 text-cyan-600" />
                <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  AI AGENTS FLEET
                </h3>
              </div>
              <button
                onClick={() => setIsFleetExpanded(!isFleetExpanded)}
                className="flex items-center space-x-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                title={`${onlineCount}/${totalCount} specialized agents online`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{onlineCount}/{totalCount} Online</span>
                {isFleetExpanded ? (
                  <ChevronUp className="w-2.5 h-2.5 ml-0.5 text-emerald-700" />
                ) : (
                  <ChevronDown className="w-2.5 h-2.5 ml-0.5 text-emerald-700" />
                )}
              </button>
            </div>
          ) : (
            <div className="h-px bg-slate-100 my-2 mx-1" />
          )}

          {/* Primary Fleet Monitor entry button */}
          <button
            onClick={() => onNavigate('agents')}
            title={`Agent Fleet Monitor (${onlineCount}/${totalCount} Online)`}
            className={`w-full flex items-center ${
              isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
            } rounded-lg text-xs font-medium transition cursor-pointer ${
              isAgentViewActive
                ? 'bg-cyan-50 text-cyan-900 font-bold border border-cyan-200 shadow-2xs'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
            }`}
          >
            <div className="flex items-center space-x-2.5 truncate">
              <div className="relative shrink-0">
                <Bot className={`w-4 h-4 ${isAgentViewActive ? 'text-cyan-700 font-bold' : 'text-slate-500'}`} />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              {!isCollapsed && <span className="truncate font-semibold">Fleet Telemetry &amp; DAG</span>}
            </div>

            {!isCollapsed && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500 text-white shadow-2xs">
                {onlineCount} LIVE
              </span>
            )}
          </button>

          {/* Expanded Individual Specialized Agent Items with Real-Time Online/Offline Status Dots */}
          {!isCollapsed && isFleetExpanded && (
            <div className="pl-2 pr-1 py-1 space-y-0.5 border-l-2 border-slate-100 ml-3.5 mt-1 max-h-56 overflow-y-auto">
              {specializedAgentsList.map((agent) => {
                const AgentIcon = agent.icon;
                return (
                  <button
                    key={agent.id}
                    onClick={() => handleAgentClick(agent.rawAgent)}
                    title={`${agent.name} • ${agent.isOnline ? 'Online (Orchestration Ready)' : 'Offline (Maintenance)'}`}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition cursor-pointer group text-left"
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      {/* Visual Online/Offline indicator dot */}
                      <span className="relative flex h-2 w-2 shrink-0">
                        {agent.isOnline ? (
                          <>
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-1 ring-emerald-300"></span>
                          </>
                        ) : (
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-300 ring-1 ring-slate-200"></span>
                        )}
                      </span>

                      <span className="truncate font-medium group-hover:text-cyan-900">
                        {agent.shortName}
                      </span>
                    </div>

                    <span
                      className={`text-[8px] font-mono px-1 py-0.2 rounded shrink-0 ${
                        agent.isOnline
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}
                    >
                      {agent.isOnline ? 'ON' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Grouped Sections */}
        {PRIMARY_NAV_SECTIONS.map((section) => (
          <div key={section.category} className="space-y-1">
            {!isCollapsed ? (
              <h3 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-3 py-1">
                {section.category}
              </h3>
            ) : (
              <div className="h-px bg-slate-100 my-2 mx-1" />
            )}

            {section.items.map((item) => {
              const Icon = item.icon;
              // Active state determination (matching exact view ID, plus activity -> audit fallback)
              const isActive =
                currentView === item.id ||
                (item.id === 'activity' && currentView === 'audit') ||
                (item.id === 'analytics' && currentView === 'crm_analytics');

              const badgeCount =
                item.id === 'tasks' && activeTasksCount > 0
                  ? activeTasksCount
                  : item.id === 'approvals' && pendingApprovals > 0
                  ? pendingApprovals
                  : item.badgeCount;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  title={item.label}
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2'
                  } rounded-lg text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-cyan-50 text-cyan-900 font-bold border border-cyan-200 shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <span
                      className={`text-xs font-mono shrink-0 w-3.5 text-center ${
                        isActive ? 'text-cyan-700 font-bold' : 'text-slate-400'
                      }`}
                    >
                      {item.symbol}
                    </span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </div>

                  {!isCollapsed && (
                    <div className="flex items-center space-x-1 shrink-0 ml-1">
                      {item.badge && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-cyan-100/80 text-cyan-800 border border-cyan-200">
                          {item.badge}
                        </span>
                      )}
                      {typeof badgeCount === 'number' && badgeCount > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500 text-white">
                          {badgeCount}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Quick Help & Footer */}
      {!isCollapsed ? (
        <div className="p-3 border-t border-slate-100 bg-slate-50/70 space-y-2">
          {onOpenHelp && (
            <button
              onClick={onOpenHelp}
              className="w-full text-left p-2 rounded-lg bg-white border border-slate-200 hover:border-cyan-300 text-slate-700 hover:text-cyan-950 transition cursor-pointer text-xs flex items-center space-x-2 shadow-2xs"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
              <div className="truncate">
                <p className="font-bold text-[11px] leading-tight text-slate-800">4-Step Acquisition Loop</p>
                <p className="text-[10px] text-slate-400 leading-tight">Quick Guide &amp; Jargon Buster</p>
              </div>
            </button>
          )}

          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-1">
            <span>Vortex One v1.0.4</span>
            <span className="text-emerald-600 font-semibold flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>Production</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="p-2 border-t border-slate-100 text-center">
          <div className="w-2 h-2 rounded-full bg-emerald-500 mx-auto" title="Production Connected" />
        </div>
      )}
    </aside>
  );
};
