import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TaskPriority } from './types';
import { useToast } from './contexts/ToastContext';
import { useAuth } from './contexts/AuthContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { AuthView } from './components/AuthView';
import { HomeView } from './components/HomeView';
import { DashboardView } from './components/DashboardView';
import { CommandCenterView } from './components/CommandCenterView';
import { StudioView } from './components/StudioView';
import { AgentMonitorView } from './components/AgentMonitorView';
import { WorkflowsView } from './components/WorkflowsView';
import { TasksView } from './components/TasksView';
import { PropertiesView } from './components/PropertiesView';
import { LeadsView } from './components/LeadsView';
import { DialerView } from './components/DialerView';
import { ApprovalsView } from './components/ApprovalsView';
import { AuditView } from './components/AuditView';
import { PrivacyPolicyView } from './components/PrivacyPolicyView';
import { TermsOfServiceView } from './components/TermsOfServiceView';
import { AgentBuilderView } from './components/AgentBuilderView';
import { DatabaseView } from './components/DatabaseView';
import { GoogleDriveView } from './components/GoogleDriveView';
import { PropertySearchView } from './components/PropertySearchView';
import { OwnersView } from './components/OwnersView';
import { PortfoliosView } from './components/PortfoliosView';
import { OpportunitiesView } from './components/OpportunitiesView';
import { ResearchQueueView } from './components/ResearchQueueView';
import { ReportsView } from './components/ReportsView';
import { CampaignsView } from './components/CampaignsView';
import { AnalyticsView } from './components/AnalyticsView';
import { SettingsView } from './components/SettingsView';
import { ContextInspector } from './components/ContextInspector';
import { CommandPalette } from './components/CommandPalette';
import { EasyHelpModal } from './components/EasyHelpModal';
import { GuidedTourModal } from './components/GuidedTourModal';
import { TaskCacheModal } from './components/TaskCacheModal';
import { CreateLeadModal } from './components/CreateLeadModal';
import { SyncStatusFooter } from './components/SyncStatusFooter';
import { PRIMARY_NAV_SECTIONS } from './components/Sidebar';
import { Layers, Menu, X, Home, Search, Target, PhoneCall, Grid } from 'lucide-react';
import {
  AgentDefinition,
  Property,
  LeadRecord,
  DialerCampaign,
  CallRecord,
  Task,
  ApprovalRequest,
  AuditLogEntry,
  DatabaseStatus,
  ContextInspectorState,
  InspectorContentType,
} from './types';

const VALID_VIEWS = [
  'home',
  'dashboard',
  'property_search',
  'properties',
  'owners',
  'portfolios',
  'opportunities',
  'leads',
  'dialer',
  'campaigns',
  'tasks',
  'research_queue',
  'activity',
  'approvals',
  'audit',
  'analytics',
  'reports',
  'settings',
  'studio',
  'agents',
  'workflows',
  'drive',
  'privacy',
  'terms',
  'agent_builder',
  'database',
];

function getViewFromUrl(): string {
  try {
    const hash = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
    if (VALID_VIEWS.includes(hash)) {
      return hash;
    }
    const path = window.location.pathname.replace(/^\//, '').trim().toLowerCase();
    if (VALID_VIEWS.includes(path)) {
      return path;
    }
  } catch (e) {
    // fallback
  }
  return 'home';
}

export default function App() {
  const { user, userProfile, activeTenant, loading: authLoading, getAuthHeaders, getAccessToken } = useAuth();
  const [currentView, setCurrentView] = useState<string>(() => getViewFromUrl());
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isCreateLeadModalOpen, setIsCreateLeadModalOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(() => !localStorage.getItem('vortex_guided_tour_seen'));
  const [isCacheOpen, setIsCacheOpen] = useState<boolean>(false);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [campaigns, setCampaigns] = useState<DialerCampaign[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [activePrompt, setActivePrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | undefined>(undefined);
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = useState<string | undefined>(undefined);
  const [propertySearchTerm, setPropertySearchTerm] = useState<string>('');
  const [leadSearchTerm, setLeadSearchTerm] = useState<string>('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [inspectorState, setInspectorState] = useState<ContextInspectorState>({
    isOpen: false,
    type: 'property',
    contentType: 'property',
    data: null,
  });
  const { addToast } = useToast();

  const handleOpenInspector = useCallback((contentType: InspectorContentType, data: any) => {
    setInspectorState({
      isOpen: true,
      type: contentType,
      contentType,
      data,
    });
  }, []);

  const handleCloseInspector = useCallback(() => {
    setInspectorState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Reference hooks to prevent race conditions during auth login and tenant switches
  const fetchRequestIdRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const lastFetchedTenantIdRef = useRef<string | null>(null);

  const handleNavigate = useCallback((view: string) => {
    if (VALID_VIEWS.includes(view)) {
      setCurrentView(view);
      try {
        if (window.location.hash !== `#${view}`) {
          window.location.hash = `#${view}`;
        }
      } catch (e) {
        // ignore hash set errors
      }
    }
  }, []);

  const handleSelectPropertyFromSearch = useCallback((prop: Property) => {
    setSelectedPropertyId(prop.id);
    setPropertySearchTerm(prop.address);
    handleNavigate('properties');
    addToast(`Opened property: ${prop.address}`, 'info');
  }, [handleNavigate, addToast]);

  const handleSelectLeadFromSearch = useCallback((lead: LeadRecord) => {
    setSelectedLeadId(lead.id);
    setLeadSearchTerm(lead.owner_name);
    handleNavigate('leads');
    addToast(`Opened lead: ${lead.owner_name}`, 'info');
  }, [handleNavigate, addToast]);

  const handleSelectAgentFromSearch = useCallback((agent: AgentDefinition) => {
    setSelectedAgentId(agent.id);
    handleNavigate('agents');
    addToast(`Opened agent telemetry: ${agent.name}`, 'info');
  }, [handleNavigate, addToast]);

  const handleOpenNewLead = useCallback(() => {
    setIsCreateLeadModalOpen(true);
  }, []);

  const handleQuickSearch = useCallback(() => {
    setIsPaletteOpen(true);
  }, []);

  const handleRunResearchQueue = useCallback(() => {
    setActivePrompt(
      'Sub-Agent 0 & 3: Run comprehensive deed verification, ownership chain inspection, and contact enrichment across all priority items in the Research Queue.'
    );
    handleNavigate('research_queue');
    addToast('Research Queue activated. Autonomous sub-agents analyzing priority owner entities.', 'info');
  }, [handleNavigate, addToast]);

  // Global Keyboard Shortcut (⌘K / Ctrl+K) for Quick Search & Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen for hash changes
  useEffect(() => {
    const onHashChange = () => {
      const targetView = getViewFromUrl();
      if (targetView && targetView !== currentView) {
        setCurrentView(targetView);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [currentView]);

  // Safe JSON Fetch Helper with typed response and abort signal support
  const safeFetchJson = async <T,>(
    url: string,
    fallback: T,
    headers?: Record<string, string>,
    signal?: AbortSignal
  ): Promise<T> => {
    try {
      const res = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...(headers || {}),
        },
        signal,
      });
      if (!res.ok) return fallback;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return fallback;
      }
      const text = await res.text();
      if (!text || !text.trim()) return fallback;
      const parsed = JSON.parse(text);
      if (Array.isArray(fallback) && !Array.isArray(parsed)) {
        return fallback;
      }
      return parsed as T;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return fallback;
      }
      console.warn(`Safe fetch warning for ${url}:`, err);
      return fallback;
    }
  };

  // Fetch initial datasets partitioned by activeTenant with race-condition prevention
  const fetchAllData = useCallback(async (forcedTenantId?: string) => {
    const tenantIdToFetch = forcedTenantId || activeTenant?.id || userProfile?.organization_id || 'org_cmc_realty';
    if (!tenantIdToFetch) return;

    // Abort prior in-flight request to prevent stale overwrite
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    const currentRequestId = ++fetchRequestIdRef.current;

    try {
      setIsLoading(true);
      const orgQuery = `?organizationId=${encodeURIComponent(tenantIdToFetch)}`;
      const headers = {
        ...getAuthHeaders(),
        'x-organization-id': tenantIdToFetch,
      };

      const [
        agentsRes,
        propsRes,
        leadsRes,
        campsRes,
        callsRes,
        tasksRes,
        apprsRes,
        auditRes,
        dbRes,
      ] = await Promise.all([
        safeFetchJson<AgentDefinition[]>(`/api/agents${orgQuery}`, [], headers, abortController.signal),
        safeFetchJson<Property[]>(`/api/properties${orgQuery}`, [], headers, abortController.signal),
        safeFetchJson<LeadRecord[]>(`/api/leads${orgQuery}`, [], headers, abortController.signal),
        safeFetchJson<DialerCampaign[]>(`/api/campaigns${orgQuery}`, [], headers, abortController.signal),
        safeFetchJson<CallRecord[]>(`/api/calls${orgQuery}`, [], headers, abortController.signal),
        safeFetchJson<Task[]>(`/api/tasks${orgQuery}`, [], headers, abortController.signal),
        safeFetchJson<ApprovalRequest[]>(`/api/approvals${orgQuery}`, [], headers, abortController.signal),
        safeFetchJson<AuditLogEntry[]>(`/api/audit${orgQuery}`, [], headers, abortController.signal),
        safeFetchJson<DatabaseStatus | null>('/api/db/status', null, headers, abortController.signal),
      ]);

      // Guard: Discard stale response if a newer request began or signal was aborted
      if (currentRequestId !== fetchRequestIdRef.current || abortController.signal.aborted) {
        return;
      }

      // Synchronize all state atomically
      setAgents(Array.isArray(agentsRes) ? agentsRes : []);
      setProperties(Array.isArray(propsRes) ? propsRes : []);
      setLeads(Array.isArray(leadsRes) ? leadsRes : []);
      setCampaigns(Array.isArray(campsRes) ? campsRes : []);
      setCalls(Array.isArray(callsRes) ? callsRes : []);
      setTasks(Array.isArray(tasksRes) ? tasksRes : []);
      setApprovals(Array.isArray(apprsRes) ? apprsRes : []);
      setAuditLogs(Array.isArray(auditRes) ? auditRes : []);
      if (dbRes) setDbStatus(dbRes);

      lastFetchedTenantIdRef.current = tenantIdToFetch;
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Error fetching data:', err);
      }
    } finally {
      if (currentRequestId === fetchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeTenant?.id, userProfile?.organization_id, getAuthHeaders]);

  // Synchronize data fetch once authentication initialization is complete
  useEffect(() => {
    if (authLoading) return;

    if (user || userProfile) {
      const currentTenantId = activeTenant?.id || userProfile?.organization_id;
      if (currentTenantId) {
        fetchAllData(currentTenantId);
      }
    }

    return () => {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
      }
    };
  }, [authLoading, user, userProfile?.uid, userProfile?.organization_id, activeTenant?.id, fetchAllData]);

  // Safe helper to obtain active tenant ID
  const getActiveOrgId = useCallback(() => {
    return activeTenant?.id || userProfile?.organization_id || 'org_cmc_realty';
  }, [activeTenant?.id, userProfile?.organization_id]);

  // Orchestration Handler
  const handleOrchestrate = async (prompt: string) => {
    const orgId = getActiveOrgId();
    try {
      const res = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          'x-organization-id': orgId,
        },
        body: JSON.stringify({
          prompt,
          organizationId: orgId,
          organization_id: orgId,
          userId: userProfile?.uid || 'anonymous',
          userRole: userProfile?.role || 'executive',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Orchestration failed');

      // Refresh state after orchestration
      fetchAllData(orgId);
      addToast('Orchestration completed successfully.', 'success');
      return data;
    } catch (err: any) {
      addToast(err.message || 'Orchestration failed.', 'error');
      throw err;
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Human Approval Decision Handler
  const handleDecideApproval = async (
    id: string,
    decision: 'approve' | 'reject' | 'modify',
    modifications?: any
  ) => {
    const orgId = getActiveOrgId();
    try {
      const res = await fetch(`/api/approvals/${id}/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          'x-organization-id': orgId,
        },
        body: JSON.stringify({
          decision,
          decided_by: userProfile?.displayName || 'Operations Executive',
          organizationId: orgId,
          organization_id: orgId,
          modifications,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit decision');
      fetchAllData(orgId);
      addToast(`Approval ${decision} submitted successfully.`, 'success');
      return data;
    } catch (err: any) {
      addToast(err.message || 'Failed to submit decision.', 'error');
      throw err;
    }
  };

  // Dial Call Handler
  const handleDialCall = async (payload: any) => {
    const orgId = getActiveOrgId();
    try {
      const res = await fetch('/api/calls/dial', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          'x-organization-id': orgId,
        },
        body: JSON.stringify({
          ...payload,
          organization_id: orgId,
          organizationId: orgId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate dial');
      fetchAllData(orgId);
      addToast('Call dialed successfully.', 'success');
      return data;
    } catch (err: any) {
      addToast(err.message || 'Failed to dial call.', 'error');
      throw err;
    }
  };

  // Add Task Handler
  const handleAddTask = async (task: { objective: string; priority: TaskPriority; due_date: string }) => {
    const orgId = getActiveOrgId();
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          'x-organization-id': orgId,
        },
        body: JSON.stringify({
          ...task,
          organization_id: orgId,
          organizationId: orgId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create task');
      fetchAllData(orgId);
      addToast('Task created successfully.', 'success');
      return data;
    } catch (err: any) {
      addToast(err.message || 'Failed to create task.', 'error');
      throw err;
    }
  };

  // Dynamic Agent Register Handler
  const handleRegisterAgent = async (newAgent: AgentDefinition) => {
    const orgId = getActiveOrgId();
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          'x-organization-id': orgId,
        },
        body: JSON.stringify({
          ...newAgent,
          organization_id: orgId,
          organizationId: orgId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register agent');
      fetchAllData(orgId);
      addToast(`Agent ${newAgent.name} registered successfully.`, 'success');
      return data;
    } catch (err: any) {
      addToast(err.message || 'Failed to register agent.', 'error');
      throw err;
    }
  };

  // Fast preset launch
  const handleRunPreset = (presetPrompt: string) => {
    setActivePrompt(presetPrompt);
    handleNavigate('studio');
  };

  // 1. Loading Gateway Splash
  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen w-screen bg-slate-950 text-white font-sans selection:bg-cyan-500">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30 animate-pulse mb-5 ring-1 ring-white/10">
          <Layers className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-base font-bold tracking-tight text-white">VORTEX ONE GATEWAY</h2>
        <p className="text-xs text-slate-400 font-medium mt-1">Verifying Multi-Tenant Security Session &amp; ABAC Tokens...</p>
        <div className="mt-4 flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce"></span>
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]"></span>
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]"></span>
        </div>
      </div>
    );
  }

  // 2. Authentication Enforcement Guard
  if (!user && !userProfile) {
    return <AuthView onSuccess={() => fetchAllData()} />;
  }

  const pendingApprovalsCount = (approvals || []).filter((a) => a.status === 'pending').length;

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased overflow-hidden font-sans text-[16px]">
      {/* Top Telemetry Header with Tenant & User Controls */}
      <Header
        activeAgentCount={(agents || []).length}
        pendingApprovalCount={pendingApprovalsCount}
        dbStatus={dbStatus}
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenTour={() => setIsTourOpen(true)}
        onOpenCache={() => setIsCacheOpen(true)}
        onOpenNewLead={handleOpenNewLead}
        onQuickSearch={handleQuickSearch}
        onRunResearchQueue={handleRunResearchQueue}
        properties={properties}
        leads={leads}
        agents={agents}
        onSelectProperty={handleSelectPropertyFromSearch}
        onSelectLead={handleSelectLeadFromSearch}
        onSelectAgent={handleSelectAgentFromSearch}
      />

      {/* Main Workspace: Sidebar + Dynamic View Container */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
          pendingApprovals={pendingApprovalsCount}
          onOpenHelp={() => setIsHelpOpen(true)}
          agents={agents}
          onSelectAgent={handleSelectAgentFromSearch}
        />

        <main className="flex-1 overflow-y-auto bg-slate-50">
          {(currentView === 'dashboard' || currentView === 'home') && (
            <CommandCenterView
              agents={agents}
              properties={properties}
              leads={leads}
              campaigns={campaigns}
              tasks={tasks}
              approvals={approvals}
              onNavigate={handleNavigate}
              onRunPreset={handleRunPreset}
              onOpenInspector={handleOpenInspector}
              onInitiateCall={(name, phone, address) => {
                handleNavigate('dialer');
                addToast(`Loaded ${name} (${phone}) into Dialer`, 'info');
              }}
              onRefreshData={() => fetchAllData()}
              onOpenHelp={() => setIsHelpOpen(true)}
            />
          )}

          {currentView === 'studio' && (
            <StudioView
              agents={agents}
              onOrchestrate={handleOrchestrate}
              defaultPrompt={activePrompt}
            />
          )}

          {currentView === 'agents' && (
            <AgentMonitorView
              agents={agents}
              initialSelectedAgentId={selectedAgentId}
            />
          )}

          {currentView === 'workflows' && (
            <WorkflowsView agents={agents} onRunWorkflow={handleRunPreset} />
          )}

          {currentView === 'tasks' && (
            <TasksView tasks={tasks} onAddTask={handleAddTask} />
          )}

          {currentView === 'property_search' && (
            <PropertySearchView
              properties={properties}
              onSelectProperty={(prop) => {
                setSelectedPropertyId(prop.id);
                handleOpenInspector('property', prop);
              }}
              onOpenInspector={(prop) => handleOpenInspector('property', prop)}
              onCreateLead={(prop) => {
                handleNavigate('leads');
                addToast(`Converting ${prop.address} to Lead`, 'info');
              }}
              onInitiateCall={(name, phone, address) => {
                handleNavigate('dialer');
                addToast(`Loaded ${name} (${phone}) into Dialer`, 'info');
              }}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'properties' && (
            <PropertiesView
              properties={properties}
              initialSearchTerm={propertySearchTerm}
              initialSelectedPropertyId={selectedPropertyId}
              onRefreshProperties={() => fetchAllData()}
              onTriggerOutreach={(prop) => {
                setActivePrompt(
                  `Generate a personalized property management pitch and outreach strategy for ${prop.owner_name} regarding ${prop.address}, ${prop.city}.`
                );
                handleNavigate('studio');
              }}
            />
          )}

          {currentView === 'owners' && (
            <OwnersView
              properties={properties}
              onOpenInspector={(owner) => handleOpenInspector('owner', owner)}
              onInitiateCall={(name, phone, address) => {
                handleNavigate('dialer');
                addToast(`Calling ${name} at ${phone}`, 'info');
              }}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'portfolios' && (
            <PortfoliosView
              properties={properties}
              onOpenInspector={(data) => handleOpenInspector('portfolio', data)}
              onInitiateCall={(name, phone, address) => {
                handleNavigate('dialer');
                addToast(`Calling Portfolio Owner ${name}`, 'info');
              }}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'opportunities' && (
            <OpportunitiesView
              properties={properties}
              onOpenInspector={(opp) => handleOpenInspector('opportunity', opp)}
              onCreateLead={(prop) => {
                handleNavigate('leads');
                addToast(`Lead created from Opportunity: ${prop.address}`, 'success');
              }}
              onInitiateCall={(name, phone, address) => {
                handleNavigate('dialer');
                addToast(`Initiating call to ${name}`, 'info');
              }}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'research_queue' && (
            <ResearchQueueView
              properties={properties}
              onOpenInspector={(data) => handleOpenInspector('property', data)}
              onInitiateResearch={(address) => {
                setActivePrompt(`Sub-Agent 0 & 3: Run comprehensive deed and skip-trace research on ${address}`);
                handleNavigate('studio');
              }}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'reports' && (
            <ReportsView
              properties={properties}
              leads={leads}
              campaigns={campaigns}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'leads' && (
            <LeadsView
              leads={leads}
              properties={properties}
              initialSearchTerm={leadSearchTerm}
              initialSelectedLeadId={selectedLeadId}
              onDialLead={(lead) => {
                handleNavigate('dialer');
              }}
              onCampaignCreated={(campaign) => {
                fetchAllData();
                addToast(`Campaign "${campaign.name}" scheduled successfully!`, 'success');
              }}
              onRefreshLeads={() => fetchAllData()}
            />
          )}

          {currentView === 'dialer' && (
            <DialerView
              campaigns={campaigns}
              calls={calls}
              onDialCall={handleDialCall}
              onRefreshCampaigns={() => fetchAllData()}
              onAddTask={handleAddTask}
            />
          )}

          {currentView === 'campaigns' && (
            <CampaignsView
              campaigns={campaigns}
              leads={leads}
              properties={properties}
              onNavigate={handleNavigate}
            />
          )}

          {(currentView === 'activity' || currentView === 'audit') && (
            <AuditView
              logs={auditLogs}
              agents={agents}
              onRefresh={() => fetchAllData()}
            />
          )}

          {currentView === 'analytics' && (
            <AnalyticsView
              leads={leads}
              properties={properties}
              agents={agents}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'settings' && (
            <SettingsView
              dbStatus={dbStatus}
              onRefreshDb={() => fetchAllData()}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === 'drive' && (
            <GoogleDriveView
              properties={properties}
              leads={leads}
            />
          )}

          {currentView === 'approvals' && (
            <ApprovalsView
              approvals={approvals}
              onDecideApproval={handleDecideApproval}
            />
          )}

          {currentView === 'agent_builder' && (
            <AgentBuilderView onRegisterAgent={handleRegisterAgent} />
          )}

          {currentView === 'database' && (
            <DatabaseView dbStatus={dbStatus} onRefresh={() => fetchAllData()} />
          )}
        </main>

        {/* Global Context Inspector (300-380px collapsible column) */}
        <ContextInspector
          inspectorState={inspectorState}
          state={inspectorState}
          onClose={handleCloseInspector}
          onInitiateCall={(name, phone, address) => {
            handleNavigate('dialer');
            addToast(`Initiating call to ${name} (${phone})`, 'info');
          }}
          onCreateLead={(property) => {
            handleNavigate('leads');
            addToast(`Lead created for ${property.address}`, 'success');
          }}
          onTriggerResearch={(prompt) => {
            setActivePrompt(prompt);
            handleNavigate('studio');
          }}
          onNavigate={handleNavigate}
        />
      </div>

      {/* Real-Time Data Sync Status Footer */}
      <SyncStatusFooter
        onForceResync={async () => {
          const orgId = getActiveOrgId();
          await fetchAllData(orgId);
        }}
        isSyncingData={isLoading}
        dbStatus={dbStatus}
        organizationId={getActiveOrgId()}
      />

      {/* Mobile Bottom Navigation Bar (< md screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex items-center justify-around py-1.5 px-2 shadow-lg select-none">
        <button
          onClick={() => handleNavigate('dashboard')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
            currentView === 'dashboard' || currentView === 'home'
              ? 'text-cyan-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>Center</span>
        </button>

        <button
          onClick={() => handleNavigate('property_search')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
            currentView === 'property_search' || currentView === 'properties'
              ? 'text-cyan-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Search className="w-5 h-5 mb-0.5" />
          <span>Search</span>
        </button>

        <button
          onClick={() => handleNavigate('leads')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
            currentView === 'leads'
              ? 'text-cyan-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Target className="w-5 h-5 mb-0.5" />
          <span>Leads</span>
        </button>

        <button
          onClick={() => handleNavigate('dialer')}
          className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold transition cursor-pointer ${
            currentView === 'dialer'
              ? 'text-cyan-700'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <PhoneCall className="w-5 h-5 mb-0.5" />
          <span>Dialer</span>
        </button>

        <button
          onClick={() => setIsMobileNavOpen(true)}
          className="flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Mobile Full Navigation Command Drawer */}
      {isMobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto p-4 space-y-4 shadow-2xl animate-slideUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-600 flex items-center justify-center text-white font-bold text-xs">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">VORTEX ONE</h3>
                  <p className="text-[10px] text-slate-400">Navigation Menu</p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileNavOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Top-Level Command Center */}
            <button
              onClick={() => {
                handleNavigate('dashboard');
                setIsMobileNavOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold ${
                currentView === 'dashboard' ? 'bg-cyan-50 text-cyan-900 border border-cyan-200' : 'bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span className="text-sm">⌂</span>
                <span>Command Center</span>
              </div>
              <span className="text-[10px] text-slate-400">Global Overview</span>
            </button>

            {/* Sections */}
            {PRIMARY_NAV_SECTIONS.map((section) => (
              <div key={section.category} className="space-y-1">
                <h4 className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2">
                  {section.category}
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {section.items.map((item) => {
                    const isActive = currentView === item.id || (item.id === 'activity' && currentView === 'audit');
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          handleNavigate(item.id);
                          setIsMobileNavOpen(false);
                        }}
                        className={`flex items-center space-x-2 p-2.5 rounded-xl text-xs font-medium text-left transition ${
                          isActive
                            ? 'bg-cyan-50 text-cyan-900 font-bold border border-cyan-200'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-mono">{item.symbol}</span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Command Palette */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onNavigate={handleNavigate}
        onOpenNewLead={handleOpenNewLead}
        onRunResearchQueue={handleRunResearchQueue}
      />

      {/* Global Quick Action Create Lead Modal */}
      <CreateLeadModal
        isOpen={isCreateLeadModalOpen}
        onClose={() => setIsCreateLeadModalOpen(false)}
        onLeadCreated={(newLead) => {
          setLeads((prev) => [newLead, ...prev]);
          setSelectedLeadId(newLead.id);
          fetchAllData();
          handleNavigate('leads');
        }}
        organizationId={activeTenant?.id || userProfile?.organization_id || 'org_cmc_realty'}
      />

      {/* Easy Help & Jargon Buster Modal */}
      <EasyHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onNavigate={(v) => {
          handleNavigate(v);
          setIsHelpOpen(false);
        }}
      />

      {/* Interactive Guided Tour Modal */}
      <GuidedTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        onNavigate={(v) => {
          handleNavigate(v);
          setIsTourOpen(false);
        }}
        onSetPrompt={(p) => setActivePrompt(p)}
      />

      {/* Task Cache & Saved Answers Modal */}
      <TaskCacheModal
        isOpen={isCacheOpen}
        onClose={() => setIsCacheOpen(false)}
      />
    </div>
  );
}

