import React, { useState, useMemo } from 'react';
import {
  Activity,
  Search,
  Filter,
  ShieldCheck,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Info,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  SlidersHorizontal,
  Layers,
  Bot,
  UserCheck,
  Building2,
  PhoneCall,
  Zap,
  BarChart3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  RefreshCw,
  Eye,
  FileJson,
} from 'lucide-react';
import { AuditLogEntry, AgentDefinition } from '../types';

interface AuditViewProps {
  logs: AuditLogEntry[];
  agents?: AgentDefinition[];
  onRefresh?: () => Promise<void> | void;
}

type TimePreset = 'all' | '15m' | '1h' | '6h' | '24h' | '7d' | '30d' | 'custom';
type StatusFilter = 'all' | 'success' | 'warning' | 'error' | 'info';
type CategoryFilter = 'all' | 'property' | 'workflow' | 'dialer' | 'approval' | 'compliance' | 'import' | 'qa';
type LatencyFilter = 'all' | 'fast' | 'moderate' | 'slow';
type ConfidenceFilter = 'all' | 'high' | 'low';
type SortOrder = 'desc' | 'asc';
type InspectorTab = 'formatted' | 'json' | 'telemetry';

interface AgentMetadata {
  name: string;
  role: string;
  badgeColor: string;
  dotColor: string;
  icon: React.ReactNode;
}

const AGENT_MAP: Record<string, AgentMetadata> = {
  agent_1: {
    name: 'Master Orchestrator',
    role: 'Orchestration',
    badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    dotColor: 'bg-cyan-500',
    icon: <Bot className="w-3.5 h-3.5 text-cyan-600" />,
  },
  sub_agent_0: {
    name: 'Sub-Agent 0 (Reasoning)',
    role: 'Reasoning & Synthesis',
    badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    dotColor: 'bg-indigo-500',
    icon: <Sparkles className="w-3.5 h-3.5 text-indigo-600" />,
  },
  sub_agent_1: {
    name: 'Sub-Agent 1 (Property Intel)',
    role: 'Property & GIS',
    badgeColor: 'bg-blue-50 text-blue-800 border-blue-200',
    dotColor: 'bg-blue-500',
    icon: <Building2 className="w-3.5 h-3.5 text-blue-600" />,
  },
  sub_agent_2: {
    name: 'Sub-Agent 2 (Lead Viability)',
    role: 'Scoring & Prioritization',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotColor: 'bg-emerald-500',
    icon: <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />,
  },
  sub_agent_3: {
    name: 'Sub-Agent 3 (Public Records)',
    role: 'Research & Comps',
    badgeColor: 'bg-teal-50 text-teal-800 border-teal-200',
    dotColor: 'bg-teal-500',
    icon: <FileText className="w-3.5 h-3.5 text-teal-600" />,
  },
  sub_agent_4: {
    name: 'Sub-Agent 4 (Enrichment)',
    role: 'SkipTrace & Contacts',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
    dotColor: 'bg-purple-500',
    icon: <Zap className="w-3.5 h-3.5 text-purple-600" />,
  },
  sub_agent_5: {
    name: 'Sub-Agent 5 (Outreach)',
    role: 'Dialer & Pitches',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    dotColor: 'bg-amber-500',
    icon: <PhoneCall className="w-3.5 h-3.5 text-amber-600" />,
  },
  sub_agent_6: {
    name: 'Sub-Agent 6 (Valuation)',
    role: 'Portfolio Analytics',
    badgeColor: 'bg-sky-50 text-sky-800 border-sky-200',
    dotColor: 'bg-sky-500',
    icon: <BarChart3 className="w-3.5 h-3.5 text-sky-600" />,
  },
  sub_agent_7: {
    name: 'Sub-Agent 7 (Compliance)',
    role: 'TCPA & DNC Gatekeeper',
    badgeColor: 'bg-rose-50 text-rose-800 border-rose-200',
    dotColor: 'bg-rose-500',
    icon: <ShieldCheck className="w-3.5 h-3.5 text-rose-600" />,
  },
  sub_agent_8: {
    name: 'Sub-Agent 8 (Automation)',
    role: 'CRM Dispatch & Sync',
    badgeColor: 'bg-violet-50 text-violet-800 border-violet-200',
    dotColor: 'bg-violet-500',
    icon: <Layers className="w-3.5 h-3.5 text-violet-600" />,
  },
  sub_agent_9: {
    name: 'Sub-Agent 9 (QA Auditor)',
    role: 'Provenance & QA',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotColor: 'bg-emerald-500',
    icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />,
  },
  'Operations Executive': {
    name: 'Operations Executive',
    role: 'User Action',
    badgeColor: 'bg-orange-50 text-orange-800 border-orange-200',
    dotColor: 'bg-orange-500',
    icon: <UserCheck className="w-3.5 h-3.5 text-orange-600" />,
  },
  system: {
    name: 'System Scheduler',
    role: 'Background Task',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    dotColor: 'bg-slate-500',
    icon: <Clock className="w-3.5 h-3.5 text-slate-600" />,
  },
};

function getAgentMeta(agentId: string): AgentMetadata {
  if (AGENT_MAP[agentId]) return AGENT_MAP[agentId];
  return {
    name: agentId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    role: 'Autonomous Sub-Agent',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
    dotColor: 'bg-cyan-500',
    icon: <Bot className="w-3.5 h-3.5 text-slate-600" />,
  };
}

function getActionCategory(action: string): CategoryFilter {
  const a = action.toLowerCase();
  if (a.includes('prop') || a.includes('tag') || a.includes('tax') || a.includes('gis') || a.includes('parcel')) {
    return 'property';
  }
  if (a.includes('wf_') || a.includes('workflow') || a.includes('orchestrat') || a.includes('reason')) {
    return 'workflow';
  }
  if (a.includes('dial') || a.includes('call') || a.includes('campaign') || a.includes('telephony') || a.includes('phone')) {
    return 'dialer';
  }
  if (a.includes('approval') || a.includes('appr_') || a.includes('decide')) {
    return 'approval';
  }
  if (a.includes('tcpa') || a.includes('dnc') || a.includes('suppress') || a.includes('compliance')) {
    return 'compliance';
  }
  if (a.includes('import') || a.includes('reconcil') || a.includes('sync_prod')) {
    return 'import';
  }
  if (a.includes('qa') || a.includes('hallucin') || a.includes('verify') || a.includes('provenance')) {
    return 'qa';
  }
  return 'all';
}

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    if (isNaN(diffMs)) return isoString;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  } catch {
    return isoString;
  }
}

export const AuditView: React.FC<AuditViewProps> = ({ logs, agents, onRefresh }) => {
  // Primary Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [timePreset, setTimePreset] = useState<TimePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [selectedLatencyRange, setSelectedLatencyRange] = useState<LatencyFilter>('all');
  const [selectedMinConfidence, setSelectedMinConfidence] = useState<ConfidenceFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // UI States
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [inspectorTabs, setInspectorTabs] = useState<Record<string, InspectorTab>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Extract unique agents from logs
  const uniqueAgents = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.agent) set.add(l.agent);
    });
    // Add known agents if passed
    if (agents) {
      agents.forEach((a) => set.add(a.id));
    }
    return Array.from(set).sort();
  }, [logs, agents]);

  // Handle Refresh
  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  // Toggle Row Expansion
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Expand / Collapse All
  const toggleExpandAll = () => {
    if (expandedIds.size > 0) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(logs.map((l) => l.id)));
    }
  };

  // Copy JSON Payload
  const handleCopyPayload = (id: string, log: AuditLogEntry) => {
    const payloadStr = JSON.stringify(
      {
        id: log.id,
        timestamp: log.timestamp,
        agent: log.agent,
        action: log.action,
        status: log.status,
        latency_ms: log.latency_ms,
        confidence: log.confidence,
        source: log.source,
        input: log.input,
        output: log.output,
      },
      null,
      2
    );
    navigator.clipboard.writeText(payloadStr);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Preset Filters
  const applyPreset = (presetKey: string) => {
    // Reset secondary filters first
    setPage(1);
    switch (presetKey) {
      case 'all':
        setSearchTerm('');
        setSelectedAgent('all');
        setTimePreset('all');
        setCustomStartDate('');
        setCustomEndDate('');
        setSelectedStatus('all');
        setSelectedCategory('all');
        setSelectedLatencyRange('all');
        setSelectedMinConfidence('all');
        break;
      case 'errors':
        setSelectedStatus('error');
        break;
      case 'warnings':
        setSelectedStatus('warning');
        break;
      case 'agents':
        setSelectedAgent('sub_agent_1');
        break;
      case 'property':
        setSelectedCategory('property');
        break;
      case 'dialer':
        setSelectedCategory('dialer');
        break;
      case 'compliance':
        setSelectedCategory('compliance');
        break;
      case 'slow':
        setSelectedLatencyRange('slow');
        break;
      case 'recent':
        setTimePreset('1h');
        break;
      default:
        break;
    }
  };

  // Clear single filter
  const clearFilter = (filterKey: string) => {
    setPage(1);
    switch (filterKey) {
      case 'search':
        setSearchTerm('');
        break;
      case 'agent':
        setSelectedAgent('all');
        break;
      case 'time':
        setTimePreset('all');
        setCustomStartDate('');
        setCustomEndDate('');
        break;
      case 'status':
        setSelectedStatus('all');
        break;
      case 'category':
        setSelectedCategory('all');
        break;
      case 'latency':
        setSelectedLatencyRange('all');
        break;
      case 'confidence':
        setSelectedMinConfidence('all');
        break;
      default:
        break;
    }
  };

  // Clear all active filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedAgent('all');
    setTimePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedStatus('all');
    setSelectedCategory('all');
    setSelectedLatencyRange('all');
    setSelectedMinConfidence('all');
    setPage(1);
  };

  // Active filter count check
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (selectedAgent !== 'all') count++;
    if (timePreset !== 'all') count++;
    if (customStartDate || customEndDate) count++;
    if (selectedStatus !== 'all') count++;
    if (selectedCategory !== 'all') count++;
    if (selectedLatencyRange !== 'all') count++;
    if (selectedMinConfidence !== 'all') count++;
    return count;
  }, [
    searchTerm,
    selectedAgent,
    timePreset,
    customStartDate,
    customEndDate,
    selectedStatus,
    selectedCategory,
    selectedLatencyRange,
    selectedMinConfidence,
  ]);

  // Core Filtering & Sorting Logic
  const filteredAndSortedLogs = useMemo(() => {
    const now = Date.now();
    const query = searchTerm.toLowerCase().trim();

    return logs
      .filter((log) => {
        // 1. Text Search across action, agent, source, ID, and payload string
        if (query) {
          const actionMatch = log.action.toLowerCase().includes(query);
          const agentMatch = log.agent.toLowerCase().includes(query);
          const agentMeta = getAgentMeta(log.agent);
          const agentNameMatch = agentMeta.name.toLowerCase().includes(query) || agentMeta.role.toLowerCase().includes(query);
          const sourceMatch = log.source ? log.source.toLowerCase().includes(query) : false;
          const idMatch = log.id ? log.id.toLowerCase().includes(query) : false;
          const taskMatch = log.task_id ? log.task_id.toLowerCase().includes(query) : false;
          
          let payloadMatch = false;
          if (log.input || log.output) {
            try {
              const strPayload = JSON.stringify({ in: log.input, out: log.output }).toLowerCase();
              payloadMatch = strPayload.includes(query);
            } catch {
              payloadMatch = false;
            }
          }

          if (!actionMatch && !agentMatch && !agentNameMatch && !sourceMatch && !idMatch && !taskMatch && !payloadMatch) {
            return false;
          }
        }

        // 2. Agent Filter
        if (selectedAgent !== 'all' && log.agent !== selectedAgent) {
          return false;
        }

        // 3. Status Filter
        if (selectedStatus !== 'all' && log.status !== selectedStatus) {
          return false;
        }

        // 4. Action Category Filter
        if (selectedCategory !== 'all') {
          const cat = getActionCategory(log.action);
          if (cat !== selectedCategory) return false;
        }

        // 5. Latency Range Filter
        if (selectedLatencyRange === 'fast' && (log.latency_ms || 0) >= 100) return false;
        if (selectedLatencyRange === 'moderate' && ((log.latency_ms || 0) < 100 || (log.latency_ms || 0) > 1000)) return false;
        if (selectedLatencyRange === 'slow' && (log.latency_ms || 0) <= 1000) return false;

        // 6. Confidence Filter
        if (selectedMinConfidence === 'high' && (log.confidence === undefined || log.confidence < 0.9)) return false;
        if (selectedMinConfidence === 'low' && (log.confidence !== undefined && log.confidence >= 0.9)) return false;

        // 7. Timestamp / Date Range Filter
        const logTime = new Date(log.timestamp).getTime();
        if (isNaN(logTime)) return true;

        if (timePreset === '15m' && logTime < now - 15 * 60 * 1000) return false;
        if (timePreset === '1h' && logTime < now - 60 * 60 * 1000) return false;
        if (timePreset === '6h' && logTime < now - 6 * 60 * 60 * 1000) return false;
        if (timePreset === '24h' && logTime < now - 24 * 60 * 60 * 1000) return false;
        if (timePreset === '7d' && logTime < now - 7 * 24 * 60 * 60 * 1000) return false;
        if (timePreset === '30d' && logTime < now - 30 * 24 * 60 * 60 * 1000) return false;

        if (timePreset === 'custom' || customStartDate || customEndDate) {
          if (customStartDate) {
            const startLimit = new Date(customStartDate).getTime();
            if (!isNaN(startLimit) && logTime < startLimit) return false;
          }
          if (customEndDate) {
            const endLimit = new Date(customEndDate).getTime();
            if (!isNaN(endLimit) && logTime > endLimit) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        if (sortOrder === 'desc') {
          return timeB - timeA;
        }
        return timeA - timeB;
      });
  }, [
    logs,
    searchTerm,
    selectedAgent,
    selectedStatus,
    selectedCategory,
    selectedLatencyRange,
    selectedMinConfidence,
    timePreset,
    customStartDate,
    customEndDate,
    sortOrder,
  ]);

  // Aggregate Stats for Filtered Dataset
  const stats = useMemo(() => {
    const total = filteredAndSortedLogs.length;
    const errors = filteredAndSortedLogs.filter((l) => l.status === 'error').length;
    const warnings = filteredAndSortedLogs.filter((l) => l.status === 'warning').length;
    const successes = filteredAndSortedLogs.filter((l) => l.status === 'success').length;
    const totalLatency = filteredAndSortedLogs.reduce((sum, l) => sum + (l.latency_ms || 0), 0);
    const avgLatency = total > 0 ? Math.round(totalLatency / total) : 0;
    const activeAgentsCount = new Set(filteredAndSortedLogs.map((l) => l.agent)).size;

    return {
      total,
      errors,
      warnings,
      successes,
      avgLatency,
      activeAgentsCount,
    };
  }, [filteredAndSortedLogs]);

  // Pagination Slice
  const paginatedLogs = useMemo(() => {
    if (pageSize === -1) return filteredAndSortedLogs;
    const start = (page - 1) * pageSize;
    return filteredAndSortedLogs.slice(start, start + pageSize);
  }, [filteredAndSortedLogs, page, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(filteredAndSortedLogs.length / pageSize) || 1;

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredAndSortedLogs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'Agent', 'Action', 'Status', 'LatencyMs', 'Confidence', 'Source', 'InputJSON', 'OutputJSON'];
    const rows = filteredAndSortedLogs.map((l) => [
      l.id,
      l.timestamp,
      l.agent,
      `"${l.action.replace(/"/g, '""')}"`,
      l.status,
      l.latency_ms || 0,
      l.confidence !== undefined ? l.confidence : '',
      `"${(l.source || '').replace(/"/g, '""')}"`,
      `"${JSON.stringify(l.input || {}).replace(/"/g, '""')}"`,
      `"${JSON.stringify(l.output || {}).replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vortex-audit-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const handleExportJSON = () => {
    if (filteredAndSortedLogs.length === 0) return;
    const jsonStr = JSON.stringify(filteredAndSortedLogs, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vortex-audit-ledger-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel (.xls)
  const handleExportExcelReport = () => {
    if (filteredAndSortedLogs.length === 0) return;
    const headers = ['ID', 'Timestamp', 'Agent', 'Action', 'Status', 'Latency (ms)', 'Confidence', 'Source'];
    const rows = filteredAndSortedLogs.map((l) => [
      l.id,
      l.timestamp,
      l.agent,
      `"${l.action.replace(/"/g, '""')}"`,
      l.status,
      l.latency_ms || 0,
      l.confidence !== undefined ? l.confidence : '',
      `"${(l.source || '').replace(/"/g, '""')}"`,
    ]);
    const excelContent = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vortex-compliance-ledger-${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to PDF Report (Printable compliance document)
  const handleExportPdfReport = () => {
    if (filteredAndSortedLogs.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vortex One Compliance & Audit Ledger Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1e293b; }
            h1 { font-size: 20px; color: #0f172a; margin-bottom: 4px; }
            .meta { font-size: 12px; color: #64748b; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 16px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .badge-success { color: #047857; font-weight: bold; }
            .badge-error { color: #be123c; font-weight: bold; }
            .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
          </style>
        </head>
        <body>
          <h1>Vortex One Owner Intelligence Platform - Compliance Audit Report</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()} | Total Records: ${filteredAndSortedLogs.length} | Operational Transparency Compliance Doc</div>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Agent</th>
                <th>Action</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Confidence</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAndSortedLogs.map(l => `
                <tr>
                  <td>${l.timestamp}</td>
                  <td>${l.agent}</td>
                  <td>${l.action}</td>
                  <td class="${l.status === 'success' ? 'badge-success' : l.status === 'error' ? 'badge-error' : ''}">${l.status}</td>
                  <td>${l.latency_ms || 0}ms</td>
                  <td>${l.confidence !== undefined ? Math.round(l.confidence * 100) + '%' : 'N/A'}</td>
                  <td>${l.source || 'System'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">Confidential Compliance Audit Ledger - Vortex One Real Estate Orchestration Engine</div>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/20 shrink-0">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Observability &amp; Audit Ledger</h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-50 text-cyan-700 border border-cyan-200">
                Live Multi-Agent Stream
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable ledger indexing autonomous agent actions, timestamp telemetry, precision latencies, confidence ratings, and provenance chains.
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
              title="Refresh ledger records"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          )}

          <button
            onClick={toggleExpandAll}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition shadow-2xs"
          >
            {expandedIds.size > 0 ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                <span>Collapse All</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                <span>Expand All ({filteredAndSortedLogs.length})</span>
              </>
            )}
          </button>

          {/* Export Dropdown Group */}
          <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-2xs overflow-hidden">
            <button
              onClick={handleExportCSV}
              disabled={filteredAndSortedLogs.length === 0}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 border-r border-slate-200 transition disabled:opacity-40"
              title="Export filtered records as CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              disabled={filteredAndSortedLogs.length === 0}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
              title="Export filtered records as JSON"
            >
              <FileJson className="w-3.5 h-3.5 text-slate-500" />
              <span>JSON</span>
            </button>
            <button
              onClick={handleExportExcelReport}
              disabled={filteredAndSortedLogs.length === 0}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 border-l border-slate-200 transition disabled:opacity-40"
              title="Export filtered records as Excel (.xls)"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportPdfReport}
              disabled={filteredAndSortedLogs.length === 0}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 border-l border-slate-200 transition disabled:opacity-40"
              title="Export filtered records as compliance PDF report"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>PDF Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Filtered Events</span>
            <Activity className="w-3.5 h-3.5 text-cyan-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1 flex items-baseline space-x-1.5">
            <span>{stats.total}</span>
            <span className="text-[10px] font-normal text-slate-400">/ {logs.length} total</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Success Rate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-emerald-700 mt-1 flex items-baseline space-x-1.5">
            <span>{stats.total > 0 ? Math.round((stats.successes / stats.total) * 100) : 100}%</span>
            <span className="text-[10px] font-normal text-slate-400">({stats.successes})</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Warnings</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-amber-700 mt-1">
            {stats.warnings}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Errors</span>
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-lg font-bold text-rose-700 mt-1">
            {stats.errors}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Avg Latency</span>
            <Clock className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-lg font-bold text-slate-900 mt-1">
            {stats.avgLatency}ms
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs">
          <div className="text-[11px] font-medium text-slate-500 flex items-center justify-between">
            <span>Active Agents</span>
            <Bot className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-lg font-bold text-indigo-900 mt-1">
            {stats.activeAgentsCount}
          </div>
        </div>
      </div>

      {/* Quick Diagnostic Preset Chips */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        <span className="text-slate-400 font-medium whitespace-nowrap text-[11px] flex items-center space-x-1 mr-1">
          <Sparkles className="w-3 h-3 text-cyan-600" />
          <span>Quick Filters:</span>
        </span>
        <button
          onClick={() => applyPreset('all')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
            activeFiltersCount === 0
              ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Events ({logs.length})
        </button>
        <button
          onClick={() => applyPreset('recent')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border flex items-center space-x-1 ${
            timePreset === '1h'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>Past 1 Hour</span>
        </button>
        <button
          onClick={() => applyPreset('errors')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border flex items-center space-x-1 ${
            selectedStatus === 'error'
              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <AlertCircle className="w-3 h-3 text-rose-500" />
          <span>Errors Only</span>
        </button>
        <button
          onClick={() => applyPreset('warnings')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border flex items-center space-x-1 ${
            selectedStatus === 'warning'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-3 h-3 text-amber-500" />
          <span>Warnings Only</span>
        </button>
        <button
          onClick={() => applyPreset('property')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border flex items-center space-x-1 ${
            selectedCategory === 'property'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Building2 className="w-3 h-3" />
          <span>Property &amp; GIS</span>
        </button>
        <button
          onClick={() => applyPreset('dialer')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border flex items-center space-x-1 ${
            selectedCategory === 'dialer'
              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <PhoneCall className="w-3 h-3" />
          <span>Dialer &amp; Calls</span>
        </button>
        <button
          onClick={() => applyPreset('compliance')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border flex items-center space-x-1 ${
            selectedCategory === 'compliance'
              ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck className="w-3 h-3" />
          <span>TCPA &amp; DNC</span>
        </button>
        <button
          onClick={() => applyPreset('slow')}
          className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border flex items-center space-x-1 ${
            selectedLatencyRange === 'slow'
              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Zap className="w-3 h-3" />
          <span>Slow (&gt;1s)</span>
        </button>
      </div>

      {/* Main Search and Multi-Filter Control Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        {/* Top Search & Primary Filters Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Full-Text Search Input */}
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Search actions, agents, sources, IDs, or payload JSON..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                title="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Agent Filter Dropdown */}
          <div className="md:col-span-3">
            <div className="relative">
              <select
                value={selectedAgent}
                onChange={(e) => {
                  setSelectedAgent(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 font-medium"
              >
                <option value="all">All Agents &amp; Roles ({uniqueAgents.length})</option>
                {uniqueAgents.map((agentId) => {
                  const meta = getAgentMeta(agentId);
                  const agentCount = logs.filter((l) => l.agent === agentId).length;
                  return (
                    <option key={agentId} value={agentId}>
                      {meta.name} ({agentCount})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Timestamp Preset Dropdown */}
          <div className="md:col-span-2">
            <div className="relative">
              <select
                value={timePreset}
                onChange={(e) => {
                  setTimePreset(e.target.value as TimePreset);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 font-medium"
              >
                <option value="all">All Time</option>
                <option value="15m">Past 15 Mins</option>
                <option value="1h">Past 1 Hour</option>
                <option value="6h">Past 6 Hours</option>
                <option value="24h">Past 24 Hours</option>
                <option value="7d">Past 7 Days</option>
                <option value="30d">Past 30 Days</option>
                <option value="custom">Custom Date Range...</option>
              </select>
            </div>
          </div>

          {/* Toggle Advanced Filters Button */}
          <div className="md:col-span-2 flex items-center justify-end space-x-2">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg border text-xs font-medium transition ${
                showAdvancedFilters || selectedCategory !== 'all' || selectedLatencyRange !== 'all' || selectedMinConfidence !== 'all'
                  ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 w-4 h-4 rounded-full bg-cyan-600 text-white text-[10px] flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker (shown when timePreset === 'custom' or active dates) */}
        {(timePreset === 'custom' || customStartDate || customEndDate) && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                From Date &amp; Time (Start)
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    setTimePreset('custom');
                    setPage(1);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                To Date &amp; Time (End)
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    setTimePreset('custom');
                    setPage(1);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setCustomStartDate('');
                  setCustomEndDate('');
                  setTimePreset('all');
                  setPage(1);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium transition"
              >
                Reset Dates
              </button>
            </div>
          </div>
        )}

        {/* Secondary / Advanced Filters Drawer */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Event Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value as StatusFilter);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              >
                <option value="all">All Statuses</option>
                <option value="success">✓ Success Only</option>
                <option value="warning">⚠ Warnings Only</option>
                <option value="error">✕ Errors Only</option>
                <option value="info">ℹ Info Only</option>
              </select>
            </div>

            {/* Action Category Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Action Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value as CategoryFilter);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              >
                <option value="all">All Action Categories</option>
                <option value="property">Property, GIS &amp; Parcels</option>
                <option value="workflow">Workflows &amp; Orchestration</option>
                <option value="dialer">Telephony &amp; Dialer Outreach</option>
                <option value="approval">Human Approvals &amp; Governance</option>
                <option value="compliance">TCPA &amp; DNC Compliance</option>
                <option value="import">Data Import &amp; Reconciliation</option>
                <option value="qa">QA Verification &amp; Auditing</option>
              </select>
            </div>

            {/* Latency Range Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Latency Duration</label>
              <select
                value={selectedLatencyRange}
                onChange={(e) => {
                  setSelectedLatencyRange(e.target.value as LatencyFilter);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              >
                <option value="all">All Latencies</option>
                <option value="fast">&lt; 100ms (High Speed)</option>
                <option value="moderate">100ms - 1000ms (Normal)</option>
                <option value="slow">&gt; 1000ms (High Latency / Network)</option>
              </select>
            </div>

            {/* Confidence Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Confidence Threshold</label>
              <select
                value={selectedMinConfidence}
                onChange={(e) => {
                  setSelectedMinConfidence(e.target.value as ConfidenceFilter);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              >
                <option value="all">All Confidence Levels</option>
                <option value="high">≥ 90% High Confidence</option>
                <option value="low">&lt; 90% Potential Review</option>
              </select>
            </div>
          </div>
        )}

        {/* Active Filter Chips Row */}
        {activeFiltersCount > 0 && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-medium text-slate-400 mr-1">Active Criteria:</span>

            {searchTerm.trim() && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-cyan-50 border border-cyan-200 text-cyan-800 text-[11px]">
                <span>Query: &quot;{searchTerm}&quot;</span>
                <button onClick={() => clearFilter('search')} className="hover:text-cyan-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedAgent !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-[11px]">
                <span>Agent: {getAgentMeta(selectedAgent).name}</span>
                <button onClick={() => clearFilter('agent')} className="hover:text-blue-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {timePreset !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-800 text-[11px]">
                <span>Time: {timePreset === 'custom' ? 'Custom Range' : timePreset.toUpperCase()}</span>
                <button onClick={() => clearFilter('time')} className="hover:text-purple-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {(customStartDate || customEndDate) && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-800 text-[11px]">
                <span>
                  {customStartDate ? new Date(customStartDate).toLocaleDateString() : 'Start'} →{' '}
                  {customEndDate ? new Date(customEndDate).toLocaleDateString() : 'Now'}
                </span>
                <button onClick={() => clearFilter('time')} className="hover:text-purple-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedStatus !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                <span>Status: {selectedStatus.toUpperCase()}</span>
                <button onClick={() => clearFilter('status')} className="hover:text-amber-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px]">
                <span>Category: {selectedCategory}</span>
                <button onClick={() => clearFilter('category')} className="hover:text-indigo-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedLatencyRange !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px]">
                <span>Latency: {selectedLatencyRange}</span>
                <button onClick={() => clearFilter('latency')} className="hover:text-emerald-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedMinConfidence !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-[11px]">
                <span>Confidence: {selectedMinConfidence}</span>
                <button onClick={() => clearFilter('confidence')} className="hover:text-teal-950">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            <button
              onClick={clearAllFilters}
              className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 hover:underline ml-2"
            >
              Clear All ({activeFiltersCount})
            </button>
          </div>
        )}
      </div>

      {/* Main Audit Log Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider font-semibold border-b border-slate-200 select-none">
              <tr>
                <th
                  onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                  className="py-3 px-4 cursor-pointer hover:bg-slate-100 transition group"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Timestamp</span>
                    {sortOrder === 'desc' ? (
                      <ArrowDown className="w-3.5 h-3.5 text-cyan-600" />
                    ) : (
                      <ArrowUp className="w-3.5 h-3.5 text-cyan-600" />
                    )}
                  </div>
                </th>
                <th className="py-3 px-4">Agent / Operator</th>
                <th className="py-3 px-4">Action &amp; Task Reference</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Provenance Source</th>
                <th className="py-3 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mx-auto text-slate-400">
                        <Search className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-bold text-slate-800">No matching audit events found</div>
                      <p className="text-xs text-slate-500">
                        No events match the selected search query, agent filter, or timestamp range.
                      </p>
                      {activeFiltersCount > 0 && (
                        <button
                          onClick={clearAllFilters}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold shadow-xs transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset All Filters</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => {
                  const isExpanded = expandedIds.has(log.id);
                  const agentMeta = getAgentMeta(log.agent);
                  const activeTab = inspectorTabs[log.id] || 'formatted';

                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className={`hover:bg-slate-50/90 cursor-pointer transition ${
                          isExpanded ? 'bg-slate-50/70 border-l-4 border-l-cyan-600' : ''
                        }`}
                      >
                        {/* Timestamp */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono font-medium text-slate-900 text-[11px]">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                            <span>{formatRelativeTime(log.timestamp)}</span>
                            <span>•</span>
                            <span>{new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </td>

                        {/* Agent */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${agentMeta.badgeColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${agentMeta.dotColor}`} />
                              <span>{agentMeta.name}</span>
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5 pl-0.5">
                            {agentMeta.role}
                          </div>
                        </td>

                        {/* Action & Task */}
                        <td className="py-3 px-4 max-w-[240px]">
                          <div className="font-semibold text-slate-900 truncate">
                            {log.action}
                          </div>
                          {log.task_id && (
                            <div className="font-mono text-[10px] text-slate-400 truncate">
                              Ref: {log.task_id}
                            </div>
                          )}
                        </td>

                        {/* Latency */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`font-mono text-[11px] font-medium px-2 py-0.5 rounded ${
                              (log.latency_ms || 0) < 150
                                ? 'bg-emerald-50 text-emerald-700'
                                : (log.latency_ms || 0) < 800
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-50 text-amber-700 font-bold'
                            }`}
                          >
                            {log.latency_ms !== undefined ? `${log.latency_ms}ms` : '—'}
                          </span>
                        </td>

                        {/* Confidence */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {log.confidence !== undefined ? (
                            <div className="flex items-center space-x-1.5">
                              <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    log.confidence >= 0.9
                                      ? 'bg-emerald-500'
                                      : log.confidence >= 0.75
                                      ? 'bg-cyan-500'
                                      : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.round(log.confidence * 100)}%` }}
                                />
                              </div>
                              <span className="font-mono text-[10px] text-slate-600 font-semibold">
                                {Math.round(log.confidence * 100)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px]">100%</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center space-x-1 text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                              log.status === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : log.status === 'warning'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : log.status === 'error'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {log.status === 'success' && <CheckCircle2 className="w-2.5 h-2.5" />}
                            {log.status === 'warning' && <AlertTriangle className="w-2.5 h-2.5" />}
                            {log.status === 'error' && <XCircle className="w-2.5 h-2.5" />}
                            {log.status === 'info' && <Info className="w-2.5 h-2.5" />}
                            <span>{log.status}</span>
                          </span>
                        </td>

                        {/* Provenance Source */}
                        <td className="py-3 px-4 text-slate-600 truncate max-w-[180px]">
                          <span className="text-[11px] text-slate-700 font-medium truncate block">
                            {log.source || 'Internal System'}
                          </span>
                        </td>

                        {/* Payload Toggle Caret */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(log.id);
                            }}
                            className="p-1 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition"
                            title={isExpanded ? 'Collapse payload' : 'Inspect payload'}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-cyan-700" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Payload & Telemetry Inspector */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={8} className="p-4 border-t border-b border-slate-200 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                              {/* Inspector Tabs */}
                              <div className="flex items-center space-x-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectorTabs((prev) => ({ ...prev, [log.id]: 'formatted' }));
                                  }}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                                    activeTab === 'formatted'
                                      ? 'bg-cyan-600 text-white shadow-2xs'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  Structured View
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectorTabs((prev) => ({ ...prev, [log.id]: 'json' }));
                                  }}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center space-x-1 ${
                                    activeTab === 'json'
                                      ? 'bg-cyan-600 text-white shadow-2xs'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <FileJson className="w-3 h-3" />
                                  <span>Raw JSON</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setInspectorTabs((prev) => ({ ...prev, [log.id]: 'telemetry' }));
                                  }}
                                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition flex items-center space-x-1 ${
                                    activeTab === 'telemetry'
                                      ? 'bg-cyan-600 text-white shadow-2xs'
                                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                  }`}
                                >
                                  <Clock className="w-3 h-3" />
                                  <span>Telemetry &amp; Trace</span>
                                </button>
                              </div>

                              {/* Copy Payload Button */}
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyPayload(log.id, log);
                                  }}
                                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium transition shadow-2xs"
                                >
                                  {copiedId === log.id ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      <span className="text-emerald-700 font-semibold">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Copy JSON</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Tab 1: Structured View */}
                            {activeTab === 'formatted' && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Input Parameters Card */}
                                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-1.5">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                                    <span>Input Parameters &amp; Query</span>
                                    <span className="font-mono text-[10px] text-slate-400">IN</span>
                                  </div>
                                  <div className="bg-slate-50 rounded-md p-2.5 font-mono text-[11px] text-slate-800 overflow-x-auto max-h-48">
                                    {log.input ? (
                                      typeof log.input === 'object' ? (
                                        <pre className="whitespace-pre-wrap">
                                          {JSON.stringify(log.input, null, 2)}
                                        </pre>
                                      ) : (
                                        String(log.input)
                                      )
                                    ) : (
                                      <span className="text-slate-400 italic">No input payload provided</span>
                                    )}
                                  </div>
                                </div>

                                {/* Output Result Card */}
                                <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-1.5">
                                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                                    <span>Execution Output &amp; Synthesis</span>
                                    <span className="font-mono text-[10px] text-slate-400">OUT</span>
                                  </div>
                                  <div className="bg-slate-50 rounded-md p-2.5 font-mono text-[11px] text-slate-800 overflow-x-auto max-h-48">
                                    {log.output ? (
                                      typeof log.output === 'object' ? (
                                        <pre className="whitespace-pre-wrap">
                                          {JSON.stringify(log.output, null, 2)}
                                        </pre>
                                      ) : (
                                        String(log.output)
                                      )
                                    ) : (
                                      <span className="text-slate-400 italic">No output result recorded</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Tab 2: Raw JSON Block */}
                            {activeTab === 'json' && (
                              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-60 shadow-inner">
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(
                                    {
                                      id: log.id,
                                      timestamp: log.timestamp,
                                      organization_id: log.organization_id || '',
                                      agent: log.agent,
                                      action: log.action,
                                      task_id: log.task_id || null,
                                      status: log.status,
                                      latency_ms: log.latency_ms,
                                      confidence: log.confidence,
                                      source: log.source,
                                      input: log.input,
                                      output: log.output,
                                    },
                                    null,
                                    2
                                  )}
                                </pre>
                              </div>
                            )}

                            {/* Tab 3: Telemetry & Trace */}
                            {activeTab === 'telemetry' && (
                              <div className="bg-white border border-slate-200 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-[11px] text-slate-400 font-semibold block">Execution ID</span>
                                  <span className="font-mono text-slate-800 font-bold">{log.id}</span>
                                </div>
                                <div>
                                  <span className="text-[11px] text-slate-400 font-semibold block">Exact ISO Timestamp</span>
                                  <span className="font-mono text-slate-800 text-[11px]">{log.timestamp}</span>
                                </div>
                                <div>
                                  <span className="text-[11px] text-slate-400 font-semibold block">Recorded Latency</span>
                                  <span className="font-mono text-slate-800 font-bold">{log.latency_ms || 0} ms</span>
                                </div>
                                <div>
                                  <span className="text-[11px] text-slate-400 font-semibold block">Provenance Source</span>
                                  <span className="text-slate-800 font-medium">{log.source || 'Vortex One Engine'}</span>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Results Footer */}
        {filteredAndSortedLogs.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <span>Showing</span>
              <span className="font-bold text-slate-900">
                {pageSize === -1
                  ? filteredAndSortedLogs.length
                  : Math.min((page - 1) * pageSize + 1, filteredAndSortedLogs.length)}{' '}
                - {pageSize === -1 ? filteredAndSortedLogs.length : Math.min(page * pageSize, filteredAndSortedLogs.length)}
              </span>
              <span>of</span>
              <span className="font-bold text-slate-900">{filteredAndSortedLogs.length}</span>
              <span>filtered events</span>
            </div>

            <div className="flex items-center space-x-3">
              {/* Rows Per Page Selector */}
              <div className="flex items-center space-x-1.5">
                <span className="text-slate-500">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-800 focus:outline-none focus:border-cyan-600"
                >
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={-1}>All ({filteredAndSortedLogs.length})</option>
                </select>
              </div>

              {/* Page Nav Buttons */}
              {pageSize !== -1 && totalPages > 1 && (
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-medium">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 transition"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
