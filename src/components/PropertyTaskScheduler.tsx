import React, { useState, useEffect } from 'react';
import {
  Clock,
  RefreshCw,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Building2,
  History,
  ChevronDown,
  ChevronUp,
  X,
  ShieldCheck,
  Sliders,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Property, PropertyRefreshSchedule, PropertyRefreshLog } from '../types';
import { useToast } from '../contexts/ToastContext';

interface PropertyTaskSchedulerProps {
  properties: Property[];
  onRefreshData?: () => void;
}

export const PropertyTaskScheduler: React.FC<PropertyTaskSchedulerProps> = ({
  properties,
  onRefreshData,
}) => {
  const { addToast } = useToast();
  const [schedules, setSchedules] = useState<PropertyRefreshSchedule[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [executingScheduleId, setExecutingScheduleId] = useState<string | null>(null);
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);
  const [historyModalSchedule, setHistoryModalSchedule] = useState<PropertyRefreshSchedule | null>(null);

  // Modal State for Create / Edit Schedule
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSchedule, setEditingSchedule] = useState<PropertyRefreshSchedule | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formIntervalHours, setFormIntervalHours] = useState<number>(24);
  const [formSelectionMode, setFormSelectionMode] = useState<'selected' | 'all' | 'high_equity' | 'absentee_only' | 'county_filter'>('selected');
  const [formSelectedPropIds, setFormSelectedPropIds] = useState<string[]>([]);
  const [formCountyFilter, setFormCountyFilter] = useState<string>('Orange County');
  const [formPropertySearch, setFormPropertySearch] = useState<string>('');
  const [formEnrichment, setFormEnrichment] = useState({
    refresh_tax_assessor: true,
    refresh_gis_geometry: true,
    refresh_market_valuation: true,
    check_absentee_status: true,
    verify_tcpa_dnc: true,
  });

  // Fetch Schedules
  const fetchSchedules = async () => {
    try {
      const res = await fetch('/api/scheduler/schedules');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSchedules(data);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch property schedules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
    const interval = setInterval(fetchSchedules, 5000);
    return () => clearInterval(interval);
  }, []);

  // Format countdown string
  const formatTimeUntil = (targetIso: string | null) => {
    if (!targetIso) return 'Not scheduled';
    const target = new Date(targetIso).getTime();
    const now = Date.now();
    const diffMs = target - now;

    if (diffMs <= 0) return 'Due now (Executing)';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `in ${hours}h ${mins}m`;
    return `in ${mins}m`;
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingSchedule(null);
    setFormName('Orange County Portfolio 24h Data Sync');
    setFormDescription('Automated 24-hour background task refreshing county assessor tax rolls, cadastral geometry, and market valuation.');
    setFormIntervalHours(24);
    setFormSelectionMode('selected');
    setFormSelectedPropIds(properties.slice(0, 3).map((p) => p.id));
    setFormCountyFilter('Orange County');
    setFormPropertySearch('');
    setFormEnrichment({
      refresh_tax_assessor: true,
      refresh_gis_geometry: true,
      refresh_market_valuation: true,
      check_absentee_status: true,
      verify_tcpa_dnc: true,
    });
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (sched: PropertyRefreshSchedule) => {
    setEditingSchedule(sched);
    setFormName(sched.name);
    setFormDescription(sched.description || '');
    setFormIntervalHours(sched.interval_hours || 24);
    setFormSelectionMode(sched.target_selection_mode || 'selected');
    setFormSelectedPropIds(sched.target_property_ids || []);
    setFormCountyFilter(sched.county_filter || 'Orange County');
    setFormPropertySearch('');
    setFormEnrichment({
      refresh_tax_assessor: sched.enrichment_options?.refresh_tax_assessor !== false,
      refresh_gis_geometry: sched.enrichment_options?.refresh_gis_geometry !== false,
      refresh_market_valuation: sched.enrichment_options?.refresh_market_valuation !== false,
      check_absentee_status: sched.enrichment_options?.check_absentee_status !== false,
      verify_tcpa_dnc: sched.enrichment_options?.verify_tcpa_dnc !== false,
    });
    setIsModalOpen(true);
  };

  // Save Schedule (Create or Edit)
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      addToast('Schedule name is required.', 'error');
      return;
    }

    if (formSelectionMode === 'selected' && formSelectedPropIds.length === 0) {
      addToast('Please select at least one property record to refresh.', 'error');
      return;
    }

    const payload = {
      name: formName.trim(),
      description: formDescription.trim(),
      interval_hours: formIntervalHours,
      target_selection_mode: formSelectionMode,
      target_property_ids: formSelectionMode === 'selected' ? formSelectedPropIds : [],
      county_filter: formSelectionMode === 'county_filter' ? formCountyFilter : undefined,
      enrichment_options: formEnrichment,
    };

    try {
      if (editingSchedule) {
        const res = await fetch(`/api/scheduler/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update schedule');
        addToast(`Schedule "${formName}" updated successfully.`, 'success');
      } else {
        const res = await fetch('/api/scheduler/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create schedule');
        addToast(`24-Hour Schedule "${formName}" created and active.`, 'success');
      }

      setIsModalOpen(false);
      fetchSchedules();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      addToast(err.message || 'Failed to save schedule', 'error');
    }
  };

  // Run Schedule Immediately
  const handleRunNow = async (sched: PropertyRefreshSchedule) => {
    setExecutingScheduleId(sched.id);
    try {
      const res = await fetch(`/api/scheduler/schedules/${sched.id}/run`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Execution failed');

      addToast(
        `Automated 24h refresh completed: ${data.refreshedCount} propert${data.refreshedCount === 1 ? 'y' : 'ies'} synced with latest assessor and GIS rolls.`,
        'success'
      );
      fetchSchedules();
      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      addToast(err.message || 'Failed to execute scheduled refresh.', 'error');
    } finally {
      setExecutingScheduleId(null);
    }
  };

  // Toggle Active/Paused
  const handleToggleSchedule = async (sched: PropertyRefreshSchedule) => {
    try {
      const res = await fetch(`/api/scheduler/schedules/${sched.id}/toggle`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to toggle status');
      const updated = await res.json();
      addToast(
        `Schedule "${sched.name}" is now ${updated.status === 'active' ? 'Active (Auto-refresh every 24h)' : 'Paused'}.`,
        'info'
      );
      fetchSchedules();
    } catch (err: any) {
      addToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (sched: PropertyRefreshSchedule) => {
    if (!window.confirm(`Are you sure you want to delete the schedule "${sched.name}"?`)) return;
    try {
      const res = await fetch(`/api/scheduler/schedules/${sched.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete schedule');
      addToast(`Schedule "${sched.name}" removed.`, 'success');
      fetchSchedules();
    } catch (err: any) {
      addToast(err.message || 'Failed to delete schedule', 'error');
    }
  };

  // Filtered properties for selection modal
  const filteredModalProperties = properties.filter((p) => {
    if (!formPropertySearch) return true;
    const term = formPropertySearch.toLowerCase();
    return (
      p.address.toLowerCase().includes(term) ||
      p.apn.toLowerCase().includes(term) ||
      p.city.toLowerCase().includes(term) ||
      p.owner_name.toLowerCase().includes(term)
    );
  });

  const totalMonitored = schedules
    .filter((s) => s.status === 'active')
    .reduce((acc, s) => {
      if (s.target_selection_mode === 'all') return acc + properties.length;
      if (s.target_selection_mode === 'selected') return acc + (s.target_property_ids?.length || 0);
      if (s.target_selection_mode === 'high_equity') return acc + properties.filter((p) => (p.estimated_equity || 0) >= 1000000).length;
      return acc + (s.target_property_ids?.length || 1);
    }, 0);

  return (
    <div id="property-task-scheduler-card" className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Automated Property Refresh Scheduler
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-full flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
                  <span>24-Hour Autonomous Cadence</span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Automatically queries California Open GIS &amp; County Assessor public rolls every 24 hours to keep property records, valuations, and tax statuses fresh.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            id="create-property-schedule-btn"
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-1.5 bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New 24h Schedule</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/80 text-xs">
        <div>
          <span className="text-slate-500 block text-[11px]">Active Schedules</span>
          <span className="text-base font-bold text-slate-900 font-mono">
            {schedules.filter((s) => s.status === 'active').length}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">Monitored Properties</span>
          <span className="text-base font-bold text-cyan-700 font-mono">
            {totalMonitored} records
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">Standard Cadence</span>
          <span className="text-base font-bold text-emerald-700 font-mono">
            Every 24 Hours
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">GIS Provenance</span>
          <span className="text-base font-bold text-slate-700 font-mono flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
            <span>Statewide Public Rolls</span>
          </span>
        </div>
      </div>

      {/* Schedules List */}
      <div className="space-y-3">
        {isLoading && (
          <div className="text-xs text-slate-400 py-6 text-center animate-pulse">
            Loading background task schedules...
          </div>
        )}

        {!isLoading && schedules.length === 0 && (
          <div className="text-center py-8 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-xs font-bold text-slate-700">No Automated Schedules Configured</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create a 24-hour background task to automatically refresh property records from California public assessor rolls.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-3 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer inline-flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create 24h Refresh Task</span>
            </button>
          </div>
        )}

        {schedules.map((schedule) => {
          const isRunning = executingScheduleId === schedule.id || schedule.status === 'running';
          const isExpanded = expandedScheduleId === schedule.id;

          // Target description
          let targetSummary = '';
          if (schedule.target_selection_mode === 'selected') {
            const count = schedule.target_property_ids?.length || 0;
            targetSummary = `${count} Selected Propert${count === 1 ? 'y' : 'ies'}`;
          } else if (schedule.target_selection_mode === 'high_equity') {
            targetSummary = 'High-Equity Assets (Equity ≥ $1.0M)';
          } else if (schedule.target_selection_mode === 'absentee_only') {
            targetSummary = 'Absentee Landlord Properties Only';
          } else if (schedule.target_selection_mode === 'county_filter') {
            targetSummary = `County Filter: ${schedule.county_filter || 'Orange County'}`;
          } else {
            targetSummary = 'All Portfolio Properties';
          }

          return (
            <div
              key={schedule.id}
              id={`schedule-card-${schedule.id}`}
              className={`border rounded-xl p-4 transition duration-150 ${
                schedule.status === 'active'
                  ? 'border-slate-200 bg-white shadow-2xs hover:border-slate-300'
                  : 'border-slate-200 bg-slate-50/60 opacity-85'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-slate-900 truncate">
                      {schedule.name}
                    </h3>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border ${
                        schedule.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : schedule.status === 'running'
                          ? 'bg-cyan-50 text-cyan-700 border-cyan-200 animate-pulse'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {schedule.status === 'active' ? 'Active (Auto-Run)' : schedule.status === 'running' ? 'Syncing...' : 'Paused'}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200">
                      Every {schedule.interval_hours || 24} Hours
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-1">
                    {schedule.description || '24-hour background task refreshing property assessments.'}
                  </p>

                  <div className="flex items-center space-x-4 text-[11px] text-slate-500 pt-1 flex-wrap gap-y-1">
                    <span className="flex items-center space-x-1 font-medium text-slate-700">
                      <Building2 className="w-3.5 h-3.5 text-cyan-600" />
                      <span>{targetSummary}</span>
                    </span>

                    <span className="flex items-center space-x-1 text-slate-600">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Next Run: <strong className="text-slate-800">{formatTimeUntil(schedule.next_run_at)}</strong></span>
                    </span>

                    {schedule.last_run_at && (
                      <span className="text-slate-500">
                        Last synced: {new Date(schedule.last_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({schedule.last_run_refreshed_count || 0} records)
                      </span>
                    )}
                  </div>
                </div>

                {/* Schedule Controls */}
                <div className="flex items-center space-x-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <button
                    id={`run-schedule-btn-${schedule.id}`}
                    onClick={() => handleRunNow(schedule)}
                    disabled={isRunning}
                    className="flex items-center space-x-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-2xs cursor-pointer disabled:opacity-50"
                    title="Trigger immediate property data refresh"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin text-cyan-600' : 'text-cyan-700'}`} />
                    <span>{isRunning ? 'Refreshing...' : 'Run Now'}</span>
                  </button>

                  <button
                    id={`toggle-schedule-btn-${schedule.id}`}
                    onClick={() => handleToggleSchedule(schedule)}
                    className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
                    title={schedule.status === 'active' ? 'Pause automatic 24h execution' : 'Resume automatic 24h execution'}
                  >
                    {schedule.status === 'active' ? (
                      <Pause className="w-3.5 h-3.5 text-amber-600" />
                    ) : (
                      <Play className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                  </button>

                  <button
                    id={`edit-schedule-btn-${schedule.id}`}
                    onClick={() => handleOpenEditModal(schedule)}
                    className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
                    title="Edit schedule configuration and target properties"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    id={`history-schedule-btn-${schedule.id}`}
                    onClick={() => setHistoryModalSchedule(schedule)}
                    className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
                    title="View execution audit logs"
                  >
                    <History className="w-3.5 h-3.5 text-cyan-700" />
                  </button>

                  <button
                    id={`delete-schedule-btn-${schedule.id}`}
                    onClick={() => handleDeleteSchedule(schedule)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition cursor-pointer"
                    title="Delete schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setExpandedScheduleId(isExpanded ? null : schedule.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
                    title={isExpanded ? 'Collapse target details' : 'Expand target property list'}
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expanded Target Property Details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5 animate-in fade-in duration-150 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                      Monitored Property Parcels ({schedule.target_selection_mode === 'selected' ? schedule.target_property_ids?.length || 0 : 'Dynamic Criteria'}):
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Auto-refreshed via Sub-Agent 1 (Property Intelligence)
                    </span>
                  </div>

                  {schedule.target_selection_mode === 'selected' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(schedule.target_property_ids || []).map((propId) => {
                        const prop = properties.find((p) => p.id === propId);
                        if (!prop) {
                          return (
                            <div key={propId} className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] text-slate-500">
                              {propId} (Custom ID)
                            </div>
                          );
                        }
                        return (
                          <div key={prop.id} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                            <div className="font-semibold text-slate-900 truncate" title={prop.address}>
                              {prop.address}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                              <span>APN: {prop.apn}</span>
                              <span className="text-cyan-700 font-semibold">${((prop.estimated_value || 0) / 1000000).toFixed(2)}M</span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              {prop.city}, {prop.county}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
                      <span>Selection Filter: </span>
                      <strong className="text-slate-800 font-semibold">{targetSummary}</strong>
                    </div>
                  )}

                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 pt-1">
                    <span className="font-medium text-slate-600">Active Enrichment Modules:</span>
                    {schedule.enrichment_options?.refresh_tax_assessor && (
                      <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded border border-cyan-100">Assessor Roll</span>
                    )}
                    {schedule.enrichment_options?.refresh_gis_geometry && (
                      <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded border border-cyan-100">GIS Geometry</span>
                    )}
                    {schedule.enrichment_options?.refresh_market_valuation && (
                      <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded border border-cyan-100">Market Value</span>
                    )}
                    {schedule.enrichment_options?.check_absentee_status && (
                      <span className="px-2 py-0.5 bg-cyan-50 text-cyan-700 rounded border border-cyan-100">Absentee Status</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit Schedule Modal */}
      {isModalOpen && (
        <div
          id="scheduler-modal-backdrop"
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            id="scheduler-modal-card"
            className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    {editingSchedule ? 'Edit 24-Hour Refresh Schedule' : 'Create 24-Hour Property Refresh Schedule'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure automated public record updates for selected real property records
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Schedule Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Orange County Core Portfolio 24h Sync"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-hidden"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Description / Operational Objective</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. Refresh assessed values, tax delinquency, and absentee flags daily"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Cadence Interval</label>
                  <select
                    value={formIntervalHours}
                    onChange={(e) => setFormIntervalHours(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-cyan-500 outline-hidden bg-white"
                  >
                    <option value={24}>Every 24 Hours (Daily Cadence - Standard)</option>
                    <option value={12}>Every 12 Hours (Bi-Daily)</option>
                    <option value={48}>Every 48 Hours (Alternate Days)</option>
                    <option value={168}>Every 7 Days (Weekly Roll Sync)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Target Selection Strategy</label>
                  <select
                    value={formSelectionMode}
                    onChange={(e) => setFormSelectionMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-cyan-500 outline-hidden bg-white"
                  >
                    <option value="selected">Explicitly Selected Properties</option>
                    <option value="all">All Portfolio Properties</option>
                    <option value="high_equity">High Equity Assets (≥ $1.0M Equity)</option>
                    <option value="absentee_only">Absentee Landlords Only</option>
                    <option value="county_filter">By County Filter</option>
                  </select>
                </div>
              </div>

              {/* Explicit Properties Selector */}
              {formSelectionMode === 'selected' && (
                <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50/70">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Select Target Properties ({formSelectedPropIds.length} selected):
                    </span>
                    <div className="space-x-2">
                      <button
                        type="button"
                        onClick={() => setFormSelectedPropIds(properties.map((p) => p.id))}
                        className="text-[11px] text-cyan-700 hover:underline font-semibold"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setFormSelectedPropIds([])}
                        className="text-[11px] text-slate-500 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    value={formPropertySearch}
                    onChange={(e) => setFormPropertySearch(e.target.value)}
                    placeholder="Search properties by address, APN, or owner..."
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs bg-white focus:ring-1 focus:ring-cyan-500 outline-hidden"
                  />

                  <div className="max-h-44 overflow-y-auto space-y-1.5 pt-1 pr-1">
                    {filteredModalProperties.map((prop) => {
                      const isChecked = formSelectedPropIds.includes(prop.id);
                      return (
                        <label
                          key={prop.id}
                          className={`flex items-start space-x-2.5 p-2 rounded-lg border cursor-pointer transition text-xs ${
                            isChecked
                              ? 'bg-cyan-50/60 border-cyan-300 text-slate-900'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormSelectedPropIds([...formSelectedPropIds, prop.id]);
                              } else {
                                setFormSelectedPropIds(formSelectedPropIds.filter((id) => id !== prop.id));
                              }
                            }}
                            className="mt-0.5 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold truncate">{prop.address}</div>
                            <div className="text-[11px] text-slate-500 flex items-center justify-between">
                              <span>APN: {prop.apn} • {prop.city}</span>
                              <span className="font-mono text-cyan-800 font-semibold">
                                ${(prop.estimated_value || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                    {filteredModalProperties.length === 0 && (
                      <div className="text-center py-4 text-xs text-slate-400">
                        No matching properties found.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formSelectionMode === 'county_filter' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">County Name</label>
                  <input
                    type="text"
                    value={formCountyFilter}
                    onChange={(e) => setFormCountyFilter(e.target.value)}
                    placeholder="e.g. Orange County, Los Angeles County"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-cyan-500 outline-hidden"
                  />
                </div>
              )}

              {/* Enrichment Options */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 block">Enrichment &amp; Public Record Modules:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                  <label className="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEnrichment.refresh_tax_assessor}
                      onChange={(e) => setFormEnrichment({ ...formEnrichment, refresh_tax_assessor: e.target.checked })}
                      className="rounded border-slate-300 text-cyan-600"
                    />
                    <span>County Assessor Tax Valuation</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEnrichment.refresh_gis_geometry}
                      onChange={(e) => setFormEnrichment({ ...formEnrichment, refresh_gis_geometry: e.target.checked })}
                      className="rounded border-slate-300 text-cyan-600"
                    />
                    <span>GIS Parcel Boundary &amp; Centroid</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEnrichment.refresh_market_valuation}
                      onChange={(e) => setFormEnrichment({ ...formEnrichment, refresh_market_valuation: e.target.checked })}
                      className="rounded border-slate-300 text-cyan-600"
                    />
                    <span>Market Equity Re-indexing</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formEnrichment.check_absentee_status}
                      onChange={(e) => setFormEnrichment({ ...formEnrichment, check_absentee_status: e.target.checked })}
                      className="rounded border-slate-300 text-cyan-600"
                    />
                    <span>Absentee Landlord Verification</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 rounded-lg shadow-xs transition cursor-pointer flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{editingSchedule ? 'Save Schedule Changes' : 'Enable 24h Scheduler'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Audit Modal */}
      {historyModalSchedule && (
        <div
          id="history-modal-backdrop"
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryModalSchedule(null);
          }}
        >
          <div
            className="bg-white rounded-xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Execution History &amp; Audit Logs
                </h3>
                <p className="text-xs text-slate-500">
                  {historyModalSchedule.name} • 24-Hour Cadence
                </p>
              </div>
              <button
                onClick={() => setHistoryModalSchedule(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {(!historyModalSchedule.history || historyModalSchedule.history.length === 0) && (
                <div className="text-center py-6 text-xs text-slate-400">
                  No previous executions recorded yet.
                </div>
              )}

              {(historyModalSchedule.history || []).map((log) => (
                <div
                  key={log.id}
                  className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-semibold text-slate-800">
                      {new Date(log.executed_at).toLocaleString()}
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {log.status.toUpperCase()} ({log.duration_ms}ms)
                    </span>
                  </div>

                  <p className="text-slate-600">{log.details}</p>

                  <div className="flex items-center space-x-3 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    <span>Processed: <strong>{log.properties_processed}</strong></span>
                    <span>Updated: <strong>{log.properties_updated}</strong></span>
                    {log.valuation_delta !== undefined && log.valuation_delta !== 0 && (
                      <span className="text-cyan-700 font-semibold font-mono">
                        Valuation Delta: +${log.valuation_delta.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setHistoryModalSchedule(null)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
