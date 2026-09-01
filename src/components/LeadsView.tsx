import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Sparkles,
  PhoneCall,
  Mail,
  Building,
  Star,
  ChevronRight,
  TrendingUp,
  FileText,
  Calendar,
  Send,
  CheckSquare,
  Square,
  MinusSquare,
  Sliders,
  Download,
  Upload,
  Bot,
  ToggleLeft,
  ToggleRight,
  UserPlus,
  Layers,
  BarChart2,
  Grid,
  List,
  RotateCcw,
  ShieldCheck,
  Tag,
  Trash2,
  MoreVertical,
  Zap,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import { LeadRecord, DialerCampaign, Property } from '../types';
import { BulkOutreachScheduleModal, BulkOutreachTarget } from './BulkOutreachScheduleModal';
import { MassDeleteModal } from './MassDeleteModal';
import { BulkTagModal } from './BulkTagModal';
import { SkipTraceModal } from './SkipTraceModal';
import { DeepEnrichmentModal } from './DeepEnrichmentModal';
import { AutomatedFollowUpModal } from './AutomatedFollowUpModal';
import { AutomatedSkipTracePipelineModal } from './AutomatedSkipTracePipelineModal';
import { DataImportModal } from './DataImportModal';
import { CreateLeadModal } from './CreateLeadModal';
import { CrmOptionsModal } from './CrmOptionsModal';
import { CrmKanbanBoard } from './CrmKanbanBoard';
import { CrmAnalyticsView } from './CrmAnalyticsView';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { GoogleSheetsSyncModal } from './GoogleSheetsSyncModal';
import { useToast } from '../contexts/ToastContext';

interface LeadsViewProps {
  leads: LeadRecord[];
  properties?: Property[];
  onDialLead?: (lead: LeadRecord) => void;
  onCampaignCreated?: (campaign: DialerCampaign) => void;
  onRefreshLeads?: () => void;
  initialSearchTerm?: string;
  initialSelectedLeadId?: string;
}

export const LeadsView: React.FC<LeadsViewProps> = ({
  leads: initialLeads,
  properties = [],
  onDialLead,
  onCampaignCreated,
  onRefreshLeads,
  initialSearchTerm = '',
  initialSelectedLeadId,
}) => {
  const { addToast } = useToast();

  // Local copy of leads to allow instant optimistic UI updates
  const [leadsList, setLeadsList] = useState<LeadRecord[]>(initialLeads);

  useEffect(() => {
    setLeadsList(initialLeads);
  }, [initialLeads]);

  // View Layout Modes: 'table' | 'kanban' | 'cards' | 'analytics'
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'cards' | 'analytics'>('table');

  // Filter States
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [selectedClassification, setSelectedClassification] = useState('all');
  const [selectedStage, setSelectedStage] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedDisposition, setSelectedDisposition] = useState('all');
  const [selectedQuality, setSelectedQuality] = useState('all');
  const [onlyTcpaSafe, setOnlyTcpaSafe] = useState(false);
  const [minScore, setMinScore] = useState<number>(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sorting State
  const [sortBy, setSortBy] = useState<'score_desc' | 'score_asc' | 'activity_desc' | 'created_desc' | 'name_asc'>('score_desc');

  // Selected Lead & Bulk Selections
  const [selectedLead, setSelectedLead] = useState<LeadRecord | null>(() => {
    if (initialSelectedLeadId) {
      const match = initialLeads.find((l) => l.id === initialSelectedLeadId);
      if (match) return match;
    }
    return initialLeads[0] || null;
  });

  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isMassDeleteModalOpen, setIsMassDeleteModalOpen] = useState(false);
  const [isBulkTagModalOpen, setIsBulkTagModalOpen] = useState(false);
  const [isAutoSkipTraceModalOpen, setIsAutoSkipTraceModalOpen] = useState(false);
  const [isAutoFollowUpModalOpen, setIsAutoFollowUpModalOpen] = useState(false);
  const [showGoogleSheetsModal, setShowGoogleSheetsModal] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [skipTraceModalLead, setSkipTraceModalLead] = useState<LeadRecord | null>(null);
  const [deepEnrichModalLead, setDeepEnrichModalLead] = useState<LeadRecord | null>(null);

  // Bulk action in-flight states
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [bulkStageChoice, setBulkStageChoice] = useState<string>('');
  const [bulkAgentChoice, setBulkAgentChoice] = useState<string>('');
  const [bulkDispositionChoice, setBulkDispositionChoice] = useState<string>('');
  const [bulkClassificationChoice, setBulkClassificationChoice] = useState<string>('');

  // Synchronize selection when initialSelectedLeadId changes
  useEffect(() => {
    if (initialSelectedLeadId) {
      const match = leadsList.find((l) => l.id === initialSelectedLeadId);
      if (match) setSelectedLead(match);
    }
  }, [initialSelectedLeadId, leadsList]);

  // Filtered & Sorted Leads
  const filteredLeads = useMemo(() => {
    return leadsList
      .filter((lead) => {
        // Search Term Filter
        const term = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !term ||
          lead.owner_name?.toLowerCase().includes(term) ||
          lead.property_address?.toLowerCase().includes(term) ||
          lead.phone_number?.toLowerCase().includes(term) ||
          lead.email?.toLowerCase().includes(term) ||
          lead.tags?.some((t) => t.toLowerCase().includes(term));

        // Classification Filter
        const matchesClassification =
          selectedClassification === 'all' || lead.classification === selectedClassification;

        // Stage Filter
        const matchesStage = selectedStage === 'all' || lead.stage === selectedStage;

        // Agent Filter
        const matchesAgent = selectedAgent === 'all' || lead.assigned_agent === selectedAgent;

        // Disposition Filter
        const matchesDisposition =
          selectedDisposition === 'all' || (lead.disposition || 'uncontacted') === selectedDisposition;

        // Quality Filter
        const matchesQuality = selectedQuality === 'all' || lead.data_quality === selectedQuality;

        // TCPA Filter
        const matchesTcpa = !onlyTcpaSafe || lead.dnc_compliant;

        // Min Score Filter
        const matchesMinScore = (lead.lead_score || 0) >= minScore;

        return (
          matchesSearch &&
          matchesClassification &&
          matchesStage &&
          matchesAgent &&
          matchesDisposition &&
          matchesQuality &&
          matchesTcpa &&
          matchesMinScore
        );
      })
      .sort((a, b) => {
        if (sortBy === 'score_desc') return (b.lead_score || 0) - (a.lead_score || 0);
        if (sortBy === 'score_asc') return (a.lead_score || 0) - (b.lead_score || 0);
        if (sortBy === 'activity_desc') {
          return new Date(b.last_activity_date || 0).getTime() - new Date(a.last_activity_date || 0).getTime();
        }
        if (sortBy === 'created_desc') {
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        }
        if (sortBy === 'name_asc') {
          return (a.owner_name || '').localeCompare(b.owner_name || '');
        }
        return 0;
      });
  }, [
    leadsList,
    searchTerm,
    selectedClassification,
    selectedStage,
    selectedAgent,
    selectedDisposition,
    selectedQuality,
    onlyTcpaSafe,
    minScore,
    sortBy,
  ]);

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
      setLastSelectedIndex(null);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    }
  };

  const handleSelectAllInSystem = () => {
    setSelectedLeadIds(leadsList.map((l) => l.id));
    addToast(`Selected all ${leadsList.length} leads across CRM`, 'info');
  };

  const handleSelectHighPriority = () => {
    const highPriorityIds = filteredLeads.filter((l) => (l.lead_score || 0) >= 80).map((l) => l.id);
    setSelectedLeadIds(highPriorityIds);
    addToast(`Selected ${highPriorityIds.length} high priority (≥80) leads`, 'info');
  };

  const handleSelectTcpaSafe = () => {
    const safeIds = filteredLeads.filter((l) => l.dnc_compliant).map((l) => l.id);
    setSelectedLeadIds(safeIds);
    addToast(`Selected ${safeIds.length} TCPA clean leads`, 'info');
  };

  const handleSelectUncontacted = () => {
    const uncontactedIds = filteredLeads.filter((l) => !l.disposition || l.disposition === 'uncontacted').map((l) => l.id);
    setSelectedLeadIds(uncontactedIds);
    addToast(`Selected ${uncontactedIds.length} uncontacted leads`, 'info');
  };

  const handleInvertSelection = () => {
    const currentSet = new Set(selectedLeadIds);
    const inverted = filteredLeads.filter((l) => !currentSet.has(l.id)).map((l) => l.id);
    setSelectedLeadIds(inverted);
  };

  const handleClearSelection = () => {
    setSelectedLeadIds([]);
    setLastSelectedIndex(null);
  };

  const handleToggleSelectLead = (id: string, index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== index) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = filteredLeads.slice(start, end + 1).map((l) => l.id);
      setSelectedLeadIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
    } else {
      setSelectedLeadIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
      setLastSelectedIndex(index);
    }
  };

  // Update Individual Lead Stage (Kanban / Drawer)
  const handleUpdateLeadStage = async (leadId: string, nextStage: LeadRecord['stage']) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage }),
      });
      if (!res.ok) throw new Error('Failed to update stage');
      const updated = await res.json();

      setLeadsList((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      if (selectedLead?.id === leadId) setSelectedLead(updated);
      addToast(`Lead stage updated to "${nextStage}"`, 'success');
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      addToast(err.message || 'Failed to update stage', 'error');
    }
  };

  // Bulk Batch Stage Transition
  const handleBulkStageChange = async (targetStage: string) => {
    if (!targetStage || selectedLeadIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const res = await fetch('/api/leads/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          updates: { stage: targetStage },
        }),
      });
      if (!res.ok) throw new Error('Bulk update failed');

      setLeadsList((prev) =>
        prev.map((l) =>
          selectedLeadIds.includes(l.id) ? { ...l, stage: targetStage as any } : l
        )
      );
      addToast(`Updated ${selectedLeadIds.length} leads to stage "${targetStage.replace(/_/g, ' ')}"`, 'success');
      setBulkStageChoice('');
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      addToast(err.message || 'Failed to bulk update stage', 'error');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Bulk Batch Assign Agent
  const handleBulkAgentAssign = async (agentId: string) => {
    if (!agentId || selectedLeadIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const res = await fetch('/api/leads/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          updates: { assigned_agent: agentId },
        }),
      });
      if (!res.ok) throw new Error('Bulk assignment failed');

      setLeadsList((prev) =>
        prev.map((l) =>
          selectedLeadIds.includes(l.id) ? { ...l, assigned_agent: agentId as any } : l
        )
      );
      addToast(`Assigned ${selectedLeadIds.length} leads to ${agentId}`, 'success');
      setBulkAgentChoice('');
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      addToast(err.message || 'Failed to bulk assign agent', 'error');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Bulk Batch Disposition Update
  const handleBulkDispositionChange = async (targetDisposition: string) => {
    if (!targetDisposition || selectedLeadIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const res = await fetch('/api/leads/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          updates: { disposition: targetDisposition },
        }),
      });
      if (!res.ok) throw new Error('Bulk update failed');

      setLeadsList((prev) =>
        prev.map((l) =>
          selectedLeadIds.includes(l.id) ? { ...l, disposition: targetDisposition as any } : l
        )
      );
      addToast(`Updated ${selectedLeadIds.length} leads disposition to "${targetDisposition.replace(/_/g, ' ')}"`, 'success');
      setBulkDispositionChoice('');
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      addToast(err.message || 'Failed to bulk update disposition', 'error');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Bulk Batch Classification Update
  const handleBulkClassificationChange = async (targetClassification: string) => {
    if (!targetClassification || selectedLeadIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const res = await fetch('/api/leads/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          updates: { classification: targetClassification, priority_tier: targetClassification },
        }),
      });
      if (!res.ok) throw new Error('Bulk update failed');

      setLeadsList((prev) =>
        prev.map((l) =>
          selectedLeadIds.includes(l.id) ? { ...l, classification: targetClassification as any, priority_tier: targetClassification as any } : l
        )
      );
      addToast(`Updated ${selectedLeadIds.length} leads priority tier to "${targetClassification.replace(/_/g, ' ')}"`, 'success');
      setBulkClassificationChoice('');
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      addToast(err.message || 'Failed to bulk update classification', 'error');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Bulk Add Tags
  const handleBulkAddTags = async (tags: string[]) => {
    if (tags.length === 0 || selectedLeadIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const res = await fetch('/api/leads/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedLeadIds,
          updates: { addTags: tags },
        }),
      });
      if (!res.ok) throw new Error('Bulk tagging failed');

      setLeadsList((prev) =>
        prev.map((l) => {
          if (!selectedLeadIds.includes(l.id)) return l;
          const currentTags = l.tags || [];
          return {
            ...l,
            tags: Array.from(new Set([...currentTags, ...tags])),
          };
        })
      );
      addToast(`Added ${tags.length} tag(s) to ${selectedLeadIds.length} leads`, 'success');
      setIsBulkTagModalOpen(false);
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      addToast(err.message || 'Failed to apply tags in bulk', 'error');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Bulk AI Re-Score with Sub-Agent 2
  const handleBulkAiRescore = async () => {
    setIsBatchUpdating(true);
    try {
      const res = await fetch('/api/leads/rescore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadIds: selectedLeadIds.length > 0 ? selectedLeadIds : undefined,
        }),
      });
      if (!res.ok) throw new Error('Re-score calculation failed');
      const data = await res.json();

      if (data.leads && Array.isArray(data.leads)) {
        const rescoredMap = new Map(data.leads.map((l: LeadRecord) => [l.id, l]));
        setLeadsList((prev) => prev.map((l) => (rescoredMap.has(l.id) ? (rescoredMap.get(l.id) as LeadRecord) : l)));
      }

      addToast(`Sub-Agent 2 successfully re-scored ${data.rescoredCount || selectedLeadIds.length} leads!`, 'success');
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      addToast(err.message || 'Failed to re-score leads', 'error');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Custom Scoring Weights Application from Modal
  const handleApplyCustomScoring = async (weights: {
    absentee: number;
    equity: number;
    units: number;
    delinquency: number;
  }) => {
    const res = await fetch('/api/leads/rescore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customWeights: weights }),
    });
    if (!res.ok) throw new Error('Failed to apply custom scoring weights');
    const data = await res.json();

    if (data.leads && Array.isArray(data.leads)) {
      const rescoredMap = new Map(data.leads.map((l: LeadRecord) => [l.id, l]));
      setLeadsList((prev) => prev.map((l) => (rescoredMap.has(l.id) ? (rescoredMap.get(l.id) as LeadRecord) : l)));
    }
    if (onRefreshLeads) onRefreshLeads();
  };

  // Open Mass Delete Modal
  const handleBulkDelete = () => {
    if (selectedLeadIds.length === 0) return;
    setIsMassDeleteModalOpen(true);
  };

  // Execute Mass Delete
  const handleExecuteMassDelete = async () => {
    if (selectedLeadIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const res = await fetch('/api/leads/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: selectedLeadIds }),
      });
      if (!res.ok) throw new Error('Bulk delete failed');

      setLeadsList((prev) => prev.filter((l) => !selectedLeadIds.includes(l.id)));
      const count = selectedLeadIds.length;
      setSelectedLeadIds([]);
      setLastSelectedIndex(null);
      if (selectedLead && selectedLeadIds.includes(selectedLead.id)) {
        setSelectedLead(null);
      }
      setIsMassDeleteModalOpen(false);
      addToast(`Permanently deleted ${count} leads from CRM`, 'success');
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      addToast(err.message || 'Failed to delete leads', 'error');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Export Selected or Filtered to CSV
  const handleExportCsv = () => {
    const leadsToExport = selectedLeadIds.length > 0
      ? leadsList.filter((l) => selectedLeadIds.includes(l.id))
      : filteredLeads;

    if (leadsToExport.length === 0) {
      addToast('No leads available to export', 'info');
      return;
    }

    const headers = [
      'Lead ID',
      'Owner Name',
      'Property Address',
      'Phone Number',
      'Email',
      'Lead Score',
      'Classification',
      'Stage',
      'Disposition',
      'Assigned Agent',
      'TCPA Safe',
      'Tags',
      'Last Activity',
    ];

    const rows = leadsToExport.map((l) => [
      l.id,
      `"${(l.owner_name || '').replace(/"/g, '""')}"`,
      `"${(l.property_address || '').replace(/"/g, '""')}"`,
      `"${l.phone_number || ''}"`,
      `"${l.email || ''}"`,
      l.lead_score,
      l.classification,
      l.stage,
      l.disposition || 'uncontacted',
      l.assigned_agent,
      l.dnc_compliant ? 'YES' : 'NO',
      `"${(l.tags || []).join(';')}"`,
      l.last_activity_date || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vortex_leads_crm_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast(`Exported ${leadsToExport.length} CRM prospects to CSV`, 'success');
  };

  // Open Bulk Outreach Modal
  const handleOpenBulkOutreach = () => {
    if (selectedLeadIds.length === 0) {
      addToast('Please select at least 1 lead to schedule outreach', 'info');
      return;
    }
    setIsBulkModalOpen(true);
  };

  // Format Bulk Outreach Targets
  const bulkOutreachTargets: BulkOutreachTarget[] = useMemo(() => {
    return leadsList
      .filter((l) => selectedLeadIds.includes(l.id))
      .map((l) => ({
        lead_id: l.id,
        owner_id: l.owner_id || l.id,
        property_id: l.primary_property_id || l.property_id || '',
        owner_name: l.owner_name,
        property_address: l.property_address,
        lead_score: l.lead_score,
        phone_number: l.phone_number || '(949) 555-0100',
        dnc_compliant: l.dnc_compliant,
      }));
  }, [leadsList, selectedLeadIds]);

  return (
    <div className="space-y-5">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Leads &amp; CRM Intelligence Hub</h2>
              <p className="text-xs text-slate-500">
                Autonomous prospect discovery, explainable scoring (Sub-Agent 2), and pipeline automation
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Create Lead Button */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Prospect</span>
          </button>

          {/* CRM Options & Scoring Preferences */}
          <button
            type="button"
            onClick={() => setIsOptionsModalOpen(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition flex items-center space-x-1.5 cursor-pointer"
            title="CRM Hub Options & Scoring Weights"
          >
            <Sliders className="w-3.5 h-3.5 text-slate-600" />
            <span>Options &amp; Scoring</span>
          </button>

          {/* Google Sheets Export / Sync */}
          <button
            type="button"
            onClick={() => setShowGoogleSheetsModal(true)}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
            title="Export CRM leads directly to Google Sheets"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Google Sheets</span>
          </button>

          {/* Import CSV / Sync CRM */}
          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-slate-600" />
            <span>Import / Sync</span>
          </button>

          {/* Automated Skip Trace Pipeline */}
          <button
            type="button"
            onClick={() => setIsAutoSkipTraceModalOpen(true)}
            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Auto Skip Trace</span>
          </button>

          {/* Automated Follow-Up Rules */}
          <button
            type="button"
            onClick={() => setIsAutoFollowUpModalOpen(true)}
            className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-purple-600" />
            <span>Auto Follow-Up</span>
          </button>
        </div>
      </div>

      {/* View Mode Switcher & Quick Metrics Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* View Mode Selector Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Table Grid</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
              viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Kanban Pipeline</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
              viewMode === 'cards' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Prospect Cards</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('analytics')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 cursor-pointer ${
              viewMode === 'analytics' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Analytics &amp; Funnel</span>
          </button>
        </div>

        {/* Quick Stats Pill Strip */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <span className="text-slate-500">Total:</span>
            <span className="font-bold text-slate-900">{leadsList.length}</span>
          </div>
          <div className="flex items-center space-x-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
            <span className="text-emerald-700 font-semibold">High Priority:</span>
            <span className="font-bold text-emerald-900">
              {leadsList.filter((l) => l.lead_score >= 80).length}
            </span>
          </div>
          <div className="flex items-center space-x-1.5 bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200">
            <span className="text-cyan-700 font-semibold">Filtered:</span>
            <span className="font-bold text-cyan-900">{filteredLeads.length}</span>
          </div>
        </div>
      </div>

      {/* Multi-Option Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by owner name, property, phone, tag..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
            />
          </div>

          {/* Classification Filter Choice */}
          <div className="md:col-span-3">
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 cursor-pointer font-medium"
            >
              <option value="all">⭐ All Classification Tiers</option>
              <option value="high_priority">High Priority (Score 80–100)</option>
              <option value="medium_priority">Medium Priority (Score 60–79)</option>
              <option value="nurture">Nurture Pipeline (&lt;60)</option>
              <option value="disqualified">Disqualified</option>
            </select>
          </div>

          {/* Pipeline Stage Choice */}
          <div className="md:col-span-3">
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 cursor-pointer font-medium"
            >
              <option value="all">📍 All Pipeline Stages</option>
              <option value="identified">1. Identified</option>
              <option value="enriched">2. Enriched</option>
              <option value="qualified">3. Qualified</option>
              <option value="outreach_ready">4. Outreach Ready</option>
              <option value="contacted">5. Contacted</option>
              <option value="meeting_scheduled">6. Meeting Scheduled</option>
              <option value="won">7. Won</option>
              <option value="lost">8. Lost</option>
            </select>
          </div>

          {/* Sort & Toggle Advanced */}
          <div className="md:col-span-2 flex items-center space-x-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 cursor-pointer font-medium"
              title="Sort Leads"
            >
              <option value="score_desc">Score ↓ (High)</option>
              <option value="score_asc">Score ↑ (Low)</option>
              <option value="activity_desc">Recent Activity</option>
              <option value="created_desc">Newest Added</option>
              <option value="name_asc">Name (A-Z)</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                showAdvancedFilters
                  ? 'bg-cyan-50 border-cyan-400 text-cyan-800'
                  : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
              title="Toggle granular choices & filters"
            >
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Advanced Filters Expandable Row */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-in fade-in duration-150">
            {/* Agent Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Assigned AI Sub-Agent</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 cursor-pointer"
              >
                <option value="all">All Agents</option>
                <option value="sub_agent_2">Sub-Agent 2 (CRM)</option>
                <option value="sub_agent_6">Sub-Agent 6 (Outreach)</option>
                <option value="sub_agent_5">Sub-Agent 5 (Skip Trace)</option>
                <option value="sub_agent_7">Sub-Agent 7 (Analytics)</option>
              </select>
            </div>

            {/* Disposition Filter */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Outreach Disposition</label>
              <select
                value={selectedDisposition}
                onChange={(e) => setSelectedDisposition(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 cursor-pointer"
              >
                <option value="all">All Dispositions</option>
                <option value="uncontacted">Uncontacted</option>
                <option value="interested">Interested</option>
                <option value="call_back_later">Callback Scheduled</option>
                <option value="under_contract">Under Contract</option>
                <option value="not_interested">Not Interested</option>
              </select>
            </div>

            {/* Min Score Slider */}
            <div>
              <div className="flex items-center justify-between mb-1 text-[11px]">
                <span className="font-bold text-slate-600">Min Score:</span>
                <span className="font-mono font-bold text-cyan-700">{minScore} pts</span>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={5}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-full accent-cyan-600 cursor-pointer"
              />
            </div>

            {/* TCPA Safe Only Toggle */}
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200 mt-2 sm:mt-0">
              <div>
                <div className="text-[11px] font-bold text-slate-700">TCPA Clean Only</div>
                <div className="text-[10px] text-slate-500">Hide DNC numbers</div>
              </div>
              <input
                type="checkbox"
                checked={onlyTcpaSafe}
                onChange={(e) => setOnlyTcpaSafe(e.target.checked)}
                className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating / Sticky Bulk Actions Bar (When Items Selected) */}
      {selectedLeadIds.length > 0 && (
        <div
          id="bulk-actions-toolbar"
          className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 border border-slate-800 animate-in slide-in-from-top-2 duration-150 sticky top-2 z-30"
        >
          <div className="flex items-center space-x-3">
            <span className="w-7 h-7 rounded-lg bg-cyan-600 flex items-center justify-center text-xs font-bold font-mono text-white shadow-xs">
              {selectedLeadIds.length}
            </span>
            <div>
              <span className="text-xs font-bold block leading-tight">
                {selectedLeadIds.length} Lead{selectedLeadIds.length > 1 ? 's' : ''} Selected
              </span>
              <span className="text-[10px] text-slate-400">
                Shift+Click to select ranges • Choose bulk action
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Bulk Change Stage */}
            <select
              id="bulk-stage-select"
              value={bulkStageChoice}
              onChange={(e) => {
                setBulkStageChoice(e.target.value);
                handleBulkStageChange(e.target.value);
              }}
              disabled={isBatchUpdating}
              className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="">Move Stage...</option>
              <option value="identified">1. Identified</option>
              <option value="enriched">2. Enriched</option>
              <option value="qualified">3. Qualified</option>
              <option value="outreach_ready">4. Outreach Ready</option>
              <option value="contacted">5. Contacted</option>
              <option value="meeting_scheduled">6. Meeting Scheduled</option>
              <option value="won">7. Won / Under Contract</option>
              <option value="lost">8. Lost / Archive</option>
            </select>

            {/* Bulk Change Disposition */}
            <select
              id="bulk-disposition-select"
              value={bulkDispositionChoice}
              onChange={(e) => {
                setBulkDispositionChoice(e.target.value);
                handleBulkDispositionChange(e.target.value);
              }}
              disabled={isBatchUpdating}
              className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="">Set Disposition...</option>
              <option value="uncontacted">Uncontacted</option>
              <option value="interested">Interested Prospect</option>
              <option value="call_back_later">Callback Scheduled</option>
              <option value="under_contract">Under Contract</option>
              <option value="not_interested">Not Interested</option>
              <option value="wrong_number">Wrong Number</option>
              <option value="do_not_call">Do Not Call (DNC)</option>
            </select>

            {/* Bulk Change Priority Classification */}
            <select
              id="bulk-classification-select"
              value={bulkClassificationChoice}
              onChange={(e) => {
                setBulkClassificationChoice(e.target.value);
                handleBulkClassificationChange(e.target.value);
              }}
              disabled={isBatchUpdating}
              className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="">Set Priority Tier...</option>
              <option value="high_priority">High Priority (Tier 1)</option>
              <option value="medium_priority">Medium Priority (Tier 2)</option>
              <option value="nurture">Nurture Pipeline</option>
              <option value="disqualified">Disqualified</option>
            </select>

            {/* Bulk Assign Agent */}
            <select
              id="bulk-agent-select"
              value={bulkAgentChoice}
              onChange={(e) => {
                setBulkAgentChoice(e.target.value);
                handleBulkAgentAssign(e.target.value);
              }}
              disabled={isBatchUpdating}
              className="bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="">Assign Agent...</option>
              <option value="sub_agent_2">Sub-Agent 2 (CRM Lead Scorer)</option>
              <option value="sub_agent_6">Sub-Agent 6 (Outreach Specialist)</option>
              <option value="sub_agent_5">Sub-Agent 5 (Skip Trace & Intel)</option>
              <option value="sub_agent_7">Sub-Agent 7 (Analytics Engine)</option>
            </select>

            {/* Bulk Add Tags */}
            <button
              id="bulk-add-tags-btn"
              type="button"
              onClick={() => setIsBulkTagModalOpen(true)}
              disabled={isBatchUpdating}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              title="Add tags to all selected leads"
            >
              <Tag className="w-3.5 h-3.5" />
              <span>Add Tags</span>
            </button>

            {/* Bulk AI Re-score */}
            <button
              id="bulk-ai-rescore-btn"
              type="button"
              onClick={handleBulkAiRescore}
              disabled={isBatchUpdating}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
              title="Re-run Sub-Agent 2 explainable factor scoring on selected leads"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Re-Score</span>
            </button>

            {/* Bulk Schedule Outreach */}
            <button
              id="bulk-schedule-outreach-btn"
              type="button"
              onClick={handleOpenBulkOutreach}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition flex items-center space-x-1 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Schedule Outreach</span>
            </button>

            {/* Export Selected to Google Sheets */}
            <button
              id="bulk-export-sheets-btn"
              type="button"
              onClick={() => setShowGoogleSheetsModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold transition flex items-center space-x-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Google Sheets</span>
            </button>

            {/* Export Selected to CSV */}
            <button
              id="bulk-export-csv-btn"
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition flex items-center space-x-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            {/* Mass Delete Button */}
            <button
              id="bulk-delete-btn"
              type="button"
              onClick={handleBulkDelete}
              disabled={isBatchUpdating}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition flex items-center space-x-1 cursor-pointer disabled:opacity-50 shadow-xs"
              title="Mass delete selected leads"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Mass Delete</span>
            </button>

            {/* Clear Selection */}
            <button
              id="bulk-deselect-btn"
              type="button"
              onClick={handleClearSelection}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 cursor-pointer"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Quick Selection Helper Bar */}
      <div
        id="quick-selection-helper-bar"
        className="flex flex-wrap items-center justify-between gap-2 px-1 py-1 text-xs text-slate-600"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Select:</span>
          
          <button
            id="select-all-filtered-btn"
            type="button"
            onClick={handleSelectAll}
            className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer text-xs border ${
              selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0
                ? 'bg-cyan-600 text-white border-cyan-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Filtered ({filteredLeads.length})
          </button>

          <button
            id="select-high-priority-btn"
            type="button"
            onClick={handleSelectHighPriority}
            className="px-2.5 py-1 rounded-lg font-semibold bg-white text-emerald-700 border border-slate-200 hover:bg-emerald-50 transition cursor-pointer text-xs"
          >
            High Priority (≥80)
          </button>

          <button
            id="select-tcpa-safe-btn"
            type="button"
            onClick={handleSelectTcpaSafe}
            className="px-2.5 py-1 rounded-lg font-semibold bg-white text-cyan-700 border border-slate-200 hover:bg-cyan-50 transition cursor-pointer text-xs"
          >
            TCPA Clean
          </button>

          <button
            id="select-uncontacted-btn"
            type="button"
            onClick={handleSelectUncontacted}
            className="px-2.5 py-1 rounded-lg font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition cursor-pointer text-xs"
          >
            Uncontacted
          </button>

          <button
            id="invert-selection-btn"
            type="button"
            onClick={handleInvertSelection}
            className="px-2.5 py-1 rounded-lg font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 transition cursor-pointer text-xs"
          >
            Invert
          </button>

          {selectedLeadIds.length > 0 && (
            <button
              id="clear-selection-btn"
              type="button"
              onClick={handleClearSelection}
              className="px-2.5 py-1 rounded-lg font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition cursor-pointer text-xs"
            >
              Clear ({selectedLeadIds.length})
            </button>
          )}
        </div>

        {leadsList.length !== filteredLeads.length && (
          <button
            id="select-all-crm-leads-btn"
            type="button"
            onClick={handleSelectAllInSystem}
            className="text-[11px] text-cyan-600 hover:underline font-semibold cursor-pointer"
          >
            Select all {leadsList.length} leads across CRM
          </button>
        )}
      </div>

      {/* Main Content Area Based on View Mode */}
      {viewMode === 'kanban' ? (
        <CrmKanbanBoard
          leads={filteredLeads}
          onSelectLead={(l) => setSelectedLead(l)}
          onUpdateLeadStage={handleUpdateLeadStage}
          onDialLead={onDialLead}
          onScheduleOutreach={(l) => {
            setSelectedLeadIds([l.id]);
            setIsBulkModalOpen(true);
          }}
          onSkipTrace={(l) => setSkipTraceModalLead(l)}
        />
      ) : viewMode === 'analytics' ? (
        <CrmAnalyticsView leads={leadsList} />
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead, index) => {
            const isHigh = lead.lead_score >= 80;
            const isMid = lead.lead_score >= 60 && lead.lead_score < 80;
            const isChecked = selectedLeadIds.includes(lead.id);

            return (
              <div
                key={lead.id}
                id={`lead-card-${lead.id}`}
                onClick={() => setSelectedLead(lead)}
                className={`bg-white border rounded-2xl p-4 space-y-3 hover:shadow-md transition cursor-pointer relative ${
                  isChecked
                    ? 'ring-2 ring-cyan-500 bg-cyan-50/40 border-cyan-300'
                    : selectedLead?.id === lead.id
                    ? 'ring-2 ring-slate-400 border-slate-300'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      id={`checkbox-card-${lead.id}`}
                      type="button"
                      onClick={(e) => handleToggleSelectLead(lead.id, index, e)}
                      className="text-slate-400 hover:text-cyan-600 cursor-pointer p-0.5"
                    >
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-cyan-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 leading-snug">{lead.owner_name}</h4>
                      <p className="text-xs text-slate-500 truncate max-w-[200px]">{lead.property_address}</p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                      isHigh
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : isMid
                        ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {lead.lead_score} pts
                  </span>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1 text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold uppercase">
                    {lead.stage}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 font-medium">
                    {lead.assigned_agent}
                  </span>
                  {lead.dnc_compliant && (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold">
                      TCPA Clean
                    </span>
                  )}
                </div>

                {/* Phone & Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-mono">{lead.phone_number || '(949) 555-0100'}</span>
                  <div className="flex items-center space-x-1.5">
                    <button
                      id={`skiptrace-card-btn-${lead.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSkipTraceModalLead(lead);
                      }}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                      title="Skip Trace"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                    {onDialLead && (
                      <button
                        id={`dial-card-btn-${lead.id}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDialLead(lead);
                        }}
                        className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition cursor-pointer"
                        title="Instant Dial"
                      >
                        <PhoneCall className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table Grid Layout (With Inspector Split) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Table Section */}
          <div className={`${selectedLead ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'} transition-all duration-200`}>
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table id="leads-crm-table" className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="p-3 w-10 text-center">
                        <button
                          id="select-all-table-header-btn"
                          type="button"
                          onClick={handleSelectAll}
                          className="text-slate-400 hover:text-cyan-600 transition cursor-pointer p-0.5"
                          title={
                            selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0
                              ? 'Deselect all filtered leads'
                              : 'Select all filtered leads'
                          }
                        >
                          {selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-cyan-600" />
                          ) : selectedLeadIds.length > 0 ? (
                            <MinusSquare className="w-4 h-4 text-cyan-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="p-3">Prospect &amp; Subject Asset</th>
                      <th className="p-3">Score &amp; Tier</th>
                      <th className="p-3">Stage</th>
                      <th className="p-3">Assigned Agent</th>
                      <th className="p-3">TCPA</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <p className="text-sm font-medium">No leads match your active filters</p>
                          <button
                            id="reset-filters-btn"
                            type="button"
                            onClick={() => {
                              setSearchTerm('');
                              setSelectedClassification('all');
                              setSelectedStage('all');
                              setSelectedAgent('all');
                              setSelectedDisposition('all');
                              setMinScore(0);
                              setOnlyTcpaSafe(false);
                            }}
                            className="mt-2 text-xs text-cyan-600 hover:underline font-semibold cursor-pointer"
                          >
                            Reset All Filters
                          </button>
                        </td>
                      </tr>
                    ) : (
                      filteredLeads.map((lead, index) => {
                        const isHigh = lead.lead_score >= 80;
                        const isMid = lead.lead_score >= 60 && lead.lead_score < 80;
                        const isSelected = selectedLead?.id === lead.id;
                        const isChecked = selectedLeadIds.includes(lead.id);

                        return (
                          <tr
                            key={lead.id}
                            id={`lead-row-${lead.id}`}
                            onClick={() => setSelectedLead(lead)}
                            className={`hover:bg-slate-50 transition cursor-pointer ${
                              isChecked
                                ? 'bg-cyan-50/70 border-l-4 border-l-cyan-600 font-medium'
                                : isSelected
                                ? 'bg-slate-100/80 font-medium'
                                : ''
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                id={`checkbox-row-${lead.id}`}
                                type="button"
                                onClick={(e) => handleToggleSelectLead(lead.id, index, e)}
                                className="text-slate-400 hover:text-cyan-600 transition cursor-pointer p-0.5"
                                title="Click to select; Shift+Click for range selection"
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-cyan-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            {/* Prospect Info */}
                            <td className="p-3">
                              <div className="font-bold text-slate-900 leading-tight flex items-center space-x-1.5">
                                <span>{lead.owner_name}</span>
                                {lead.tags && lead.tags.length > 0 && (
                                  <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium">
                                    {lead.tags[0]}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[220px]">
                                {lead.property_address}
                              </div>
                            </td>

                            {/* Score & Tier */}
                            <td className="p-3">
                              <span
                                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                  isHigh
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isMid
                                    ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {lead.lead_score}/100
                              </span>
                            </td>

                            {/* Stage */}
                            <td className="p-3">
                              <span className="text-[11px] uppercase font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {lead.stage.replace(/_/g, ' ')}
                              </span>
                            </td>

                            {/* Assigned Agent */}
                            <td className="p-3">
                              <span className="text-[11px] text-slate-600 font-medium truncate block max-w-[120px]">
                                {lead.assigned_agent}
                              </span>
                            </td>

                            {/* TCPA */}
                            <td className="p-3">
                              {lead.dnc_compliant ? (
                                <span className="text-emerald-700 font-semibold text-[11px] flex items-center space-x-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Clean</span>
                                </span>
                              ) : (
                                <span className="text-amber-700 font-semibold text-[11px]">DNC Flag</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end space-x-1">
                                <button
                                  id={`skiptrace-row-btn-${lead.id}`}
                                  type="button"
                                  onClick={() => setSkipTraceModalLead(lead)}
                                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                  title="Skip Trace Owner"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                </button>
                                {onDialLead && (
                                  <button
                                    id={`dial-row-btn-${lead.id}`}
                                    type="button"
                                    onClick={() => onDialLead(lead)}
                                    className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition cursor-pointer"
                                    title="Instant Dial"
                                  >
                                    <PhoneCall className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Lead Detail Inspector */}
          {selectedLead && (
            <div className="lg:col-span-5 xl:col-span-4">
              <LeadDetailDrawer
                lead={selectedLead}
                onClose={() => setSelectedLead(null)}
                onUpdateLead={(updated) => {
                  setLeadsList((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
                  setSelectedLead(updated);
                  if (onRefreshLeads) onRefreshLeads();
                }}
                onDeleteLead={(leadId) => {
                  setLeadsList((prev) => prev.filter((l) => l.id !== leadId));
                  setSelectedLead(null);
                  if (onRefreshLeads) onRefreshLeads();
                }}
                onDialLead={onDialLead}
                onScheduleOutreach={(l) => {
                  setSelectedLeadIds([l.id]);
                  setIsBulkModalOpen(true);
                }}
                onSkipTrace={(l) => setSkipTraceModalLead(l)}
              />
            </div>
          )}
        </div>
      )}

      {/* Modals Suite */}
      {/* 1. Create Lead Modal */}
      <CreateLeadModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onLeadCreated={(newLead) => {
          setLeadsList((prev) => [newLead, ...prev]);
          setSelectedLead(newLead);
          if (onRefreshLeads) onRefreshLeads();
        }}
      />

      {/* 2. CRM Options & Scoring Preferences Modal */}
      <CrmOptionsModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        defaultViewMode={viewMode}
        onSaveDefaultViewMode={(m) => setViewMode(m)}
        onApplyCustomScoring={handleApplyCustomScoring}
      />

      {/* 3. Bulk Outreach Schedule Modal */}
      <BulkOutreachScheduleModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        selectedLeads={bulkOutreachTargets}
        onCampaignCreated={(camp) => {
          if (onCampaignCreated) onCampaignCreated(camp);
          setIsBulkModalOpen(false);
          setSelectedLeadIds([]);
        }}
      />

      {/* 4. Mass Delete Confirmation Modal */}
      <MassDeleteModal
        isOpen={isMassDeleteModalOpen}
        onClose={() => setIsMassDeleteModalOpen(false)}
        onConfirm={handleExecuteMassDelete}
        selectedCount={selectedLeadIds.length}
        selectedLeads={leadsList.filter((l) => selectedLeadIds.includes(l.id))}
        isDeleting={isBatchUpdating}
      />

      {/* 5. Bulk Tag Assignment Modal */}
      <BulkTagModal
        isOpen={isBulkTagModalOpen}
        onClose={() => setIsBulkTagModalOpen(false)}
        onApplyTags={handleBulkAddTags}
        selectedCount={selectedLeadIds.length}
        isApplying={isBatchUpdating}
      />

      {/* 6. Automated Skip Trace Pipeline Modal */}
      <AutomatedSkipTracePipelineModal
        isOpen={isAutoSkipTraceModalOpen}
        onClose={() => setIsAutoSkipTraceModalOpen(false)}
        onPipelineExecuted={() => {
          if (onRefreshLeads) onRefreshLeads();
        }}
      />

      {/* 7. Automated Follow-Up Modal */}
      <AutomatedFollowUpModal
        isOpen={isAutoFollowUpModalOpen}
        onClose={() => setIsAutoFollowUpModalOpen(false)}
      />

      {/* 8. Data Import Modal */}
      <DataImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={() => {
          if (onRefreshLeads) onRefreshLeads();
        }}
      />

      {/* 9. Individual Skip Trace Modal */}
      {skipTraceModalLead && (
        <SkipTraceModal
          isOpen={Boolean(skipTraceModalLead)}
          onClose={() => setSkipTraceModalLead(null)}
          ownerId={skipTraceModalLead.owner_id || skipTraceModalLead.id}
          propertyId={skipTraceModalLead.primary_property_id || skipTraceModalLead.property_id || ''}
          ownerName={skipTraceModalLead.owner_name}
          propertyAddress={skipTraceModalLead.property_address}
          onCompleted={() => {
            if (onRefreshLeads) onRefreshLeads();
          }}
        />
      )}

      {/* 10. Deep Enrichment Modal */}
      {deepEnrichModalLead && (
        <DeepEnrichmentModal
          isOpen={Boolean(deepEnrichModalLead)}
          onClose={() => setDeepEnrichModalLead(null)}
          property={{
            id: deepEnrichModalLead.primary_property_id || deepEnrichModalLead.property_id || '',
            address: deepEnrichModalLead.property_address,
          } as any}
          onEnrichmentComplete={() => {
            if (onRefreshLeads) onRefreshLeads();
          }}
        />
      )}

      {/* 11. Google Sheets Export & Sync Modal */}
      {showGoogleSheetsModal && (
        <GoogleSheetsSyncModal
          isOpen={showGoogleSheetsModal}
          onClose={() => setShowGoogleSheetsModal(false)}
          leads={leadsList}
          selectedLeadIds={selectedLeadIds}
          initialMode="leads"
        />
      )}
    </div>
  );
};
