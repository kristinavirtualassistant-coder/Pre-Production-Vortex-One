import React, { useState, useEffect } from 'react';
import {
  Activity,
  Zap,
  RefreshCw,
  Play,
  Pause,
  Filter,
  PhoneCall,
  Mail,
  Search,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import { LeadRecord } from '../types';

export type ScoringFilterPreset = 'all' | 'surging' | 'high_calls' | 'active_emails' | 'active_searches';

interface LeadScoringControlBannerProps {
  activePreset: ScoringFilterPreset;
  onSelectPreset: (preset: ScoringFilterPreset) => void;
  onRecalculateAll: () => Promise<void>;
  onSimulateGlobalActivity?: () => Promise<void>;
  isRecalculating: boolean;
  surgingLeadsCount: number;
}

export const LeadScoringControlBanner: React.FC<LeadScoringControlBannerProps> = ({
  activePreset,
  onSelectPreset,
  onRecalculateAll,
  onSimulateGlobalActivity,
  isRecalculating,
  surgingLeadsCount,
}) => {
  const [isRunning, setIsRunning] = useState(true);
  const [lastRunTime, setLastRunTime] = useState<string>('Just now');
  const [secondsUntilNext, setSecondsUntilNext] = useState<number>(30);
  const [isToggling, setIsToggling] = useState(false);

  // Poll status and run local countdown tick
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/leads/scoring-service/status');
        if (res.ok) {
          const data = await res.json();
          setIsRunning(data.isRunning);
          if (data.lastRunAt) {
            setLastRunTime(new Date(data.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
          }
        }
      } catch {
        // Fallback gracefully
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer for next background cycle
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setSecondsUntilNext((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const handleToggleService = async () => {
    try {
      setIsToggling(true);
      const res = await fetch('/api/leads/scoring-service/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsRunning(data.isRunning);
      }
    } catch (err) {
      console.error('Failed to toggle scoring service', err);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div
      id="lead-scoring-background-service-banner"
      className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-2xl p-4 border border-slate-700/80 shadow-sm space-y-3"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Status & Title */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            <div
              className={`w-3 h-3 rounded-full ${
                isRunning ? 'bg-emerald-500 animate-ping opacity-75' : 'bg-slate-500'
              }`}
            />
            <div
              className={`absolute w-2.5 h-2.5 rounded-full ${
                isRunning ? 'bg-emerald-400' : 'bg-slate-400'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold font-mono tracking-wider text-cyan-400 uppercase">
                Automated Lead Scoring Engine
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isRunning
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {isRunning ? 'ACTIVE BACKGROUND SERVICE' : 'PAUSED'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Continuously recalculating dynamic engagement based on telephony call duration, email opens, and GIS property searches.
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Cycle Info */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700 text-slate-300 font-mono text-[11px]">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {isRunning ? `Next cycle in ${secondsUntilNext}s` : 'Paused'} • Last run: {lastRunTime}
            </span>
          </div>

          {/* Toggle Service Button */}
          <button
            id="toggle-scoring-engine-btn"
            type="button"
            disabled={isToggling}
            onClick={handleToggleService}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl font-medium text-slate-200 transition cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
            title={isRunning ? 'Pause automatic background scoring loop' : 'Resume background scoring'}
          >
            {isRunning ? (
              <>
                <Pause className="w-3 h-3 text-amber-400" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-emerald-400" />
                <span>Resume</span>
              </>
            )}
          </button>

          {/* Recalculate Now Button */}
          <button
            id="recalculate-scores-now-btn"
            type="button"
            disabled={isRecalculating}
            onClick={onRecalculateAll}
            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition cursor-pointer flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
            <span>{isRecalculating ? 'Recalculating...' : 'Recalculate Now'}</span>
          </button>

          {/* Simulate Global Wave */}
          {onSimulateGlobalActivity && (
            <button
              id="simulate-activity-wave-btn"
              type="button"
              onClick={onSimulateGlobalActivity}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition cursor-pointer flex items-center space-x-1.5 shadow-xs"
              title="Simulate incoming calls, email opens, and GIS searches across the lead list"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Simulate Activity</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Presets Bar */}
      <div className="pt-2 border-t border-slate-750 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center space-x-1">
          <Filter className="w-3 h-3 text-cyan-400" />
          <span>Dynamic Views:</span>
        </span>

        <button
          id="filter-preset-all"
          type="button"
          onClick={() => onSelectPreset('all')}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
            activePreset === 'all'
              ? 'bg-cyan-500 text-slate-950 font-bold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          All Leads
        </button>

        <button
          id="filter-preset-surging"
          type="button"
          onClick={() => onSelectPreset('surging')}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center space-x-1.5 ${
            activePreset === 'surging'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <TrendingUp className="w-3 h-3 text-emerald-400" />
          <span>🔥 Surging Leads</span>
          {surgingLeadsCount > 0 && (
            <span className="bg-emerald-900/60 text-emerald-300 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold">
              {surgingLeadsCount}
            </span>
          )}
        </button>

        <button
          id="filter-preset-calls"
          type="button"
          onClick={() => onSelectPreset('high_calls')}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center space-x-1.5 ${
            activePreset === 'high_calls'
              ? 'bg-cyan-500 text-slate-950 font-bold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <PhoneCall className="w-3 h-3 text-cyan-400" />
          <span>📞 High Talk-Time (&gt;90s)</span>
        </button>

        <button
          id="filter-preset-emails"
          type="button"
          onClick={() => onSelectPreset('active_emails')}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center space-x-1.5 ${
            activePreset === 'active_emails'
              ? 'bg-indigo-500 text-white font-bold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Mail className="w-3 h-3 text-indigo-400" />
          <span>✉️ Active Email Openers</span>
        </button>

        <button
          id="filter-preset-searches"
          type="button"
          onClick={() => onSelectPreset('active_searches')}
          className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center space-x-1.5 ${
            activePreset === 'active_searches'
              ? 'bg-emerald-500 text-slate-950 font-bold'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Search className="w-3 h-3 text-emerald-400" />
          <span>🔍 GIS &amp; Property Lookups</span>
        </button>
      </div>
    </div>
  );
};
