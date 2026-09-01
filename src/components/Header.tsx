import React, { useState, useRef, useEffect } from 'react';
import {
  Layers,
  Activity,
  ShieldCheck,
  Zap,
  Building,
  Volume2,
  Database,
  Radio,
  HelpCircle,
  Sparkles,
  User,
  LogOut,
  ChevronDown,
  Check,
  Briefcase,
  Shield,
  Compass,
  SlidersHorizontal,
  Plus,
  UserPlus,
  Search,
  PhoneCall,
  ArrowRight,
  Bot,
} from 'lucide-react';
import { DatabaseStatus } from '../../server/db/db';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { GlobalSearch } from './GlobalSearch';
import { Property, LeadRecord, AgentDefinition } from '../types';

interface HeaderProps {
  activeAgentCount: number;
  pendingApprovalCount: number;
  dbStatus: DatabaseStatus | null;
  currentView?: string;
  onNavigate: (view: string) => void;
  onOpenHelp?: () => void;
  onOpenTour?: () => void;
  onOpenCache?: () => void;
  onOpenNewLead?: () => void;
  onQuickSearch?: () => void;
  onRunResearchQueue?: () => void;
  properties?: Property[];
  leads?: LeadRecord[];
  agents?: AgentDefinition[];
  onSelectProperty?: (property: Property) => void;
  onSelectLead?: (lead: LeadRecord) => void;
  onSelectAgent?: (agent: AgentDefinition) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeAgentCount,
  pendingApprovalCount,
  dbStatus,
  currentView,
  onNavigate,
  onOpenHelp,
  onOpenTour,
  onOpenCache,
  onOpenNewLead,
  onQuickSearch,
  onRunResearchQueue,
  properties = [],
  leads = [],
  agents = [],
  onSelectProperty,
  onSelectLead,
  onSelectAgent,
}) => {
  const {
    user,
    userProfile,
    isGuest,
    activeTenant,
    availableTenants,
    switchOrganization,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const { addToast } = useToast();

  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);

  const quickActionsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const tenantMenuRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickActionsRef.current && !quickActionsRef.current.contains(e.target as Node)) {
        setIsQuickActionsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (tenantMenuRef.current && !tenantMenuRef.current.contains(e.target as Node)) {
        setIsTenantMenuOpen(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTenantSelect = async (orgId: string, orgName: string) => {
    setIsTenantMenuOpen(false);
    await switchOrganization(orgId, orgName);
    addToast(`Switched active tenant to ${orgName}.`, 'success');
  };

  const handleSignOut = async () => {
    setIsUserMenuOpen(false);
    await signOut();
    addToast('Signed out successfully.', 'info');
  };

  const roleBadgeColors: Record<string, string> = {
    admin: 'bg-rose-50 text-rose-700 border-rose-200',
    executive: 'bg-purple-50 text-purple-700 border-purple-200',
    manager: 'bg-blue-50 text-blue-700 border-blue-200',
    agent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Brand Identity & Tenant Indicator */}
      <div className="flex items-center space-x-3 lg:space-x-4 shrink-0">
        <div
          className="flex items-center space-x-2.5 cursor-pointer group"
          onClick={() => onNavigate('home')}
          title="Go to Vortex One Home"
        >
          <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-600/15 group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-base lg:text-lg text-slate-900 tracking-tight">VORTEX ONE</span>
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                Agent OS
              </span>
            </div>
            <p className="hidden xl:block text-[11px] text-slate-500 font-medium">
              Enterprise Property Intelligence Platform
            </p>
          </div>
        </div>

        {/* Vertical Divider */}
        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        {/* Tenant Selector Dropdown */}
        <div className="relative" ref={tenantMenuRef}>
          <button
            type="button"
            onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
            title="Switch Active Tenant Organization"
          >
            <Building className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
            <span className="max-w-[130px] lg:max-w-[160px] truncate">{activeTenant.name}</span>
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {isTenantMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-72 rounded-xl bg-white border border-slate-200 shadow-xl py-2 z-50 animate-fadeIn">
              <div className="px-3 py-1.5 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Tenant Context</p>
                <p className="text-xs text-slate-600 font-medium mt-0.5">Multi-tenant data isolation active</p>
              </div>

              <div className="py-1">
                {availableTenants.map((tenant) => (
                  <button
                    key={tenant.id}
                    type="button"
                    onClick={() => handleTenantSelect(tenant.id, tenant.name)}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition cursor-pointer ${
                      activeTenant.id === tenant.id ? 'bg-cyan-50 text-cyan-900 font-semibold' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <Building className={`w-4 h-4 ${activeTenant.id === tenant.id ? 'text-cyan-600' : 'text-slate-400'}`} />
                      <div>
                        <p className="font-semibold leading-tight">{tenant.name}</p>
                        <p className="text-[10px] text-slate-400">{tenant.id}</p>
                      </div>
                    </div>
                    {activeTenant.id === tenant.id && <Check className="w-4 h-4 text-cyan-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Intelligence Search (Properties, Leads, Agents) */}
      <div className="flex-1 max-w-md xl:max-w-xl mx-3 lg:mx-6 hidden md:flex justify-center">
        <GlobalSearch
          properties={properties}
          leads={leads}
          agents={agents}
          onSelectProperty={onSelectProperty}
          onSelectLead={onSelectLead}
          onSelectAgent={onSelectAgent}
          onNavigate={onNavigate}
        />
      </div>

      {/* Clean Right Actions & Telemetry Cluster */}
      <div className="flex items-center space-x-2 lg:space-x-3 shrink-0">
        {/* Quick Actions Dropdown */}
        <div className="relative" ref={quickActionsRef}>
          <button
            id="header-quick-actions-btn"
            type="button"
            onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs font-bold shadow-xs transition cursor-pointer active:scale-95"
            title="Trigger Quick Tasks (New Lead, Quick Search, Research Queue)"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Quick Actions</span>
            <ChevronDown className="w-3 h-3 text-cyan-100" />
          </button>

          {isQuickActionsOpen && (
            <div className="absolute right-0 mt-1.5 w-80 rounded-xl bg-white border border-slate-200 shadow-2xl py-2 z-50 animate-fadeIn">
              <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Actions Hub</p>
                  <p className="text-xs text-slate-600 font-medium">Trigger common platform workflows</p>
                </div>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                  ⌘K
                </span>
              </div>

              <div className="p-1.5 space-y-1">
                {/* 1. New Lead */}
                <button
                  id="quick-action-new-lead"
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    if (onOpenNewLead) {
                      onOpenNewLead();
                    } else {
                      onNavigate('leads');
                    }
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-950 flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <UserPlus className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900 leading-tight">New Lead</p>
                      <p className="text-[11px] text-slate-500">Create off-market owner prospect</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded border border-emerald-200">
                    + Lead
                  </span>
                </button>

                {/* 2. Quick Search */}
                <button
                  id="quick-action-quick-search"
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    if (onQuickSearch) {
                      onQuickSearch();
                    } else {
                      onNavigate('property_search');
                    }
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-cyan-50 text-slate-700 hover:text-cyan-950 flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-cyan-900 leading-tight">Quick Search</p>
                      <p className="text-[11px] text-slate-500">Search properties, APNs, owners &amp; views</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                    ⌘K
                  </span>
                </button>

                {/* 3. Run Research Queue */}
                <button
                  id="quick-action-run-research"
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    if (onRunResearchQueue) {
                      onRunResearchQueue();
                    } else {
                      onNavigate('research_queue');
                    }
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-indigo-50 text-slate-700 hover:text-indigo-950 flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 leading-tight">Run Research Queue</p>
                      <p className="text-[11px] text-slate-500">Execute autonomous sub-agent verification</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.5 rounded border border-indigo-200">
                    Auto-DAG
                  </span>
                </button>

                <div className="h-px bg-slate-100 my-1" />

                {/* 4. Launch Outbound Dialer */}
                <button
                  id="quick-action-dialer"
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    onNavigate('dialer');
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-950 flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <PhoneCall className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-blue-900 leading-tight">Outbound Dialer</p>
                      <p className="text-[11px] text-slate-500">Start live calling or launch campaign</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </button>

                {/* 5. GIS Property Search */}
                <button
                  id="quick-action-property-search"
                  type="button"
                  onClick={() => {
                    setIsQuickActionsOpen(false);
                    onNavigate('property_search');
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-amber-50 text-slate-700 hover:text-amber-950 flex items-center justify-between transition cursor-pointer group"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Building className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 group-hover:text-amber-900 leading-tight">GIS &amp; Parcel Discovery</p>
                      <p className="text-[11px] text-slate-500">County assessor map &amp; zoning query</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 transition-colors" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Unified Tools & Help Dropdown */}
        <div className="relative" ref={toolsMenuRef}>
          <button
            type="button"
            onClick={() => setIsToolsMenuOpen(!isToolsMenuOpen)}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition cursor-pointer"
            title="Tools, Guide & Cache Inspector"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
            <span className="hidden sm:inline">Tools &amp; Help</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {isToolsMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-white border border-slate-200 shadow-xl py-1.5 z-50 animate-fadeIn">
              <div className="px-3 py-1.5 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Platform Utilities</p>
              </div>

              {onOpenHelp && (
                <button
                  id="header-easy-guide-btn"
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    onOpenHelp();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-cyan-50 hover:text-cyan-900 flex items-center space-x-2.5 transition cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-cyan-600 shrink-0" />
                  <div>
                    <p className="font-semibold leading-tight">How It Works &amp; Glossary</p>
                    <p className="text-[10px] text-slate-400">4-Step loop &amp; jargon buster</p>
                  </div>
                </button>
              )}

              {onOpenTour && (
                <button
                  id="header-guided-tour-btn"
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    onOpenTour();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 flex items-center space-x-2.5 transition cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <p className="font-semibold leading-tight">Interactive Guided Tour</p>
                    <p className="text-[10px] text-slate-400">Step-by-step onboarding</p>
                  </div>
                </button>
              )}

              {onOpenCache && (
                <button
                  id="header-task-cache-btn"
                  onClick={() => {
                    setIsToolsMenuOpen(false);
                    onOpenCache();
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900 flex items-center space-x-2.5 transition cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-semibold leading-tight">Task Cache &amp; Memory</p>
                    <p className="text-[10px] text-slate-400">Saved AI answers &amp; API performance</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* System Telemetry Badges */}
        <div className="flex items-center space-x-1.5 bg-slate-100/80 border border-slate-200/80 p-1 rounded-xl">
          {/* Active Agents Badge */}
          <button
            onClick={() => onNavigate('agents')}
            className="flex items-center space-x-1.5 px-2 py-1 rounded-lg hover:bg-white text-xs text-slate-700 font-medium transition cursor-pointer"
            title="View Sub-Agent Monitor"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold">{activeAgentCount}</span>
            <span className="hidden xl:inline text-slate-500">Agents</span>
          </button>

          {/* Pending Approvals Badge (Conditional) */}
          {pendingApprovalCount > 0 && (
            <button
              onClick={() => onNavigate('approvals')}
              className="flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold transition cursor-pointer animate-pulse border border-amber-200/60"
              title="Review Pending Human Sign-Offs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>{pendingApprovalCount}</span>
            </button>
          )}

          {/* Database Mode Status */}
          <button
            onClick={() => onNavigate('database')}
            className="flex items-center space-x-1.5 px-2 py-1 rounded-lg hover:bg-white text-xs text-slate-700 font-medium transition cursor-pointer"
            title="View PostgreSQL Database Schema"
          >
            <Database className="w-3 h-3 text-cyan-600 shrink-0" />
            <span className="hidden lg:inline text-[11px] font-semibold text-slate-700">
              {dbStatus?.connected ? 'PostgreSQL' : 'Sandbox'}
            </span>
          </button>
        </div>

        {/* Primary CTA - Launch Studio */}
        <button
          onClick={() => onNavigate('studio')}
          className="flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-medium text-xs px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer active:scale-95"
          title="Open Multi-Agent Studio"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Studio</span>
        </button>

        {/* User Profile & Organization Dropdown */}
        {userProfile && (
          <div className="relative pl-0.5" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 p-1 rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition cursor-pointer"
            >
              {userProfile.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName}
                  className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg object-cover ring-1 ring-slate-200 shadow-2xs"
                />
              ) : (
                <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                  {userProfile.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden xl:block text-left pr-0.5">
                <p className="text-xs font-bold text-slate-800 leading-tight">{userProfile.displayName}</p>
                <span className={`inline-block text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${roleBadgeColors[userProfile.role] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {userProfile.role}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white border border-slate-200 shadow-2xl py-2 z-50 animate-fadeIn">
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    {userProfile.photoURL ? (
                      <img
                        src={userProfile.photoURL}
                        alt={userProfile.displayName}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-cyan-600 text-white flex items-center justify-center font-bold text-sm">
                        {userProfile.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-900 truncate">{userProfile.displayName}</p>
                      <p className="text-[11px] text-slate-500 truncate">{userProfile.email}</p>
                      <span className={`inline-block mt-1 text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border ${roleBadgeColors[userProfile.role] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {userProfile.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Organization</p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">{activeTenant.name}</p>
                  <p className="text-[10px] text-slate-500">ID: {activeTenant.id}</p>
                </div>

                <div className="py-1">
                  {(!user || isGuest) && (
                    <button
                      type="button"
                      onClick={async () => {
                        setIsUserMenuOpen(false);
                        try {
                          await signInWithGoogle();
                          addToast('Signed in with Google successfully!', 'success');
                        } catch (e) {
                          // Handled in context
                        }
                      }}
                      className="w-full px-4 py-2 text-xs text-cyan-700 hover:bg-cyan-50 flex items-center space-x-2 transition cursor-pointer font-medium"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                      <span>Sign In with Google (Optional)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      onNavigate('audit');
                    }}
                    className="w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 transition cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Security &amp; Audit Logs</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 transition cursor-pointer font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>{isGuest ? 'Exit Guest Mode / Lock' : 'Sign Out'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

