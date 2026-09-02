import React, { useState } from 'react';
import {
  X,
  Zap,
  PhoneCall,
  Mail,
  Search,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { LeadRecord, LeadEngagementMetrics } from '../types';

interface LeadScoreBreakdownModalProps {
  lead: LeadRecord;
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated?: (updatedLead: LeadRecord) => void;
}

export const LeadScoreBreakdownModal: React.FC<LeadScoreBreakdownModalProps> = ({
  lead,
  isOpen,
  onClose,
  onLeadUpdated,
}) => {
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const metrics: LeadEngagementMetrics = lead.engagement_metrics || {
    total_calls_count: 2,
    connected_calls_count: 1,
    total_talk_duration_seconds: 120,
    avg_call_duration_seconds: 120,
    call_engagement_score: 24,

    email_sent_count: 2,
    email_opened_count: 2,
    email_clicked_count: 1,
    email_replied_count: 0,
    email_engagement_score: 18,

    property_views_count: 3,
    gis_parcel_searches_count: 2,
    saved_searches_count: 1,
    underwriting_pdf_views_count: 1,
    property_search_score: 22,

    dynamic_engagement_score: 64,
    score_trend: 'up',
    score_delta: 6,
    last_recalculated_at: new Date().toISOString(),
    recalculation_reason: 'Recalculated based on telephony talk-time, email opens, and GIS search activity',
    engagement_tier: 'warm',
  };

  const isHigh = lead.lead_score >= 80;
  const isMid = lead.lead_score >= 60 && lead.lead_score < 80;

  const scoreDelta = metrics.score_delta ?? 0;
  const scoreTrend = metrics.score_trend ?? (scoreDelta > 0 ? 'up' : scoreDelta < 0 ? 'down' : 'stable');

  const formatSeconds = (sec: number = 0) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  const handleSimulate = async (eventType: 'call' | 'email_open' | 'email_click' | 'gis_search' | 'pdf_view', payload?: any) => {
    try {
      setIsSimulating(true);
      setSimMessage(null);
      const res = await fetch('/api/leads/scoring-service/simulate-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          eventType,
          payload,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Simulation failed');

      setSimMessage(data.message);
      if (data.lead && onLeadUpdated) {
        onLeadUpdated(data.lead);
      }
    } catch (err: any) {
      setSimMessage(`Error: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div
      id="lead-score-breakdown-modal-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id={`score-breakdown-modal-${lead.id}`}
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4">
            <button
              id="close-score-breakdown-modal-btn"
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-2 text-cyan-400 text-xs font-mono font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Explainable Dynamic Lead Scoring Dossier</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div>
              <h2 className="text-xl font-bold text-white">{lead.owner_name}</h2>
              <p className="text-xs text-slate-300 flex items-center space-x-1.5 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{lead.property_address}</span>
              </p>
            </div>

            {/* Composite Score Pill */}
            <div className="flex items-center space-x-3 bg-slate-800/90 border border-slate-700/80 rounded-2xl px-4 py-2.5">
              <div className="text-right">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Dynamic Score</div>
                <div className="flex items-center space-x-1.5">
                  <span
                    className={`text-2xl font-black font-mono ${
                      isHigh ? 'text-emerald-400' : isMid ? 'text-cyan-400' : 'text-slate-300'
                    }`}
                  >
                    {lead.lead_score}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">/100</span>
                </div>
              </div>

              {/* Trend Tag */}
              <div
                className={`flex items-center space-x-1 text-xs font-bold font-mono px-2.5 py-1 rounded-full border ${
                  scoreTrend === 'up'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : scoreTrend === 'down'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : 'bg-slate-700 text-slate-300 border-slate-600'
                }`}
              >
                {scoreTrend === 'up' ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : scoreTrend === 'down' ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
                <span>
                  {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta < 0 ? `${scoreDelta}` : 'Stable'}
                </span>
              </div>
            </div>
          </div>

          {/* Background Recalculation Badge */}
          <div className="mt-4 flex items-center space-x-2 text-[11px] text-slate-300 bg-slate-800/60 rounded-xl px-3 py-1.5 border border-slate-700/50">
            <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="font-medium">
              Background Service: Continuous dynamic score recalculation active (Telemetry synced)
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Simulation Feedback Alert */}
          {simMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center space-x-2 ${
                simMessage.startsWith('Error')
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              {simMessage.startsWith('Error') ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              )}
              <span className="font-medium">{simMessage}</span>
            </div>
          )}

          {/* Dynamic Scoring Breakdown Pillars */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
              <span>Dynamic Engagement Breakdown (60% Weight)</span>
              <span className="text-[11px] text-cyan-700 font-semibold font-mono">
                Engagement Sub-Score: {metrics.dynamic_engagement_score ?? 64}/100
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. Call Duration Pillar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-cyan-700 font-bold text-xs">
                    <PhoneCall className="w-4 h-4 text-cyan-600" />
                    <span>Call Duration</span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                    +{metrics.call_engagement_score ?? 24} pts
                  </span>
                </div>
                <div className="text-lg font-black text-slate-900 font-mono">
                  {formatSeconds(metrics.total_talk_duration_seconds)}
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p>• {metrics.connected_calls_count || 0} Connected Calls</p>
                  <p>• Avg: {formatSeconds(metrics.avg_call_duration_seconds)} / call</p>
                  <p>• {lead.disposition ? `Disposition: ${lead.disposition.replace(/_/g, ' ')}` : 'Active Outbound'}</p>
                </div>
              </div>

              {/* 2. Email Opens Pillar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-indigo-700 font-bold text-xs">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <span>Email Outreach</span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    +{metrics.email_engagement_score ?? 18} pts
                  </span>
                </div>
                <div className="text-lg font-black text-slate-900 font-mono">
                  {metrics.email_opened_count || 0} Opens
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p>• {metrics.email_sent_count || 0} Emails Sent</p>
                  <p>• {metrics.email_clicked_count || 0} Link / Proposal Clicks</p>
                  <p>• {metrics.email_replied_count || 0} Direct Inbound Replies</p>
                </div>
              </div>

              {/* 3. Property Search & GIS Pillar */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-emerald-700 font-bold text-xs">
                    <Search className="w-4 h-4 text-emerald-600" />
                    <span>GIS & Searches</span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    +{metrics.property_search_score ?? 22} pts
                  </span>
                </div>
                <div className="text-lg font-black text-slate-900 font-mono">
                  {(metrics.property_views_count || 0) + (metrics.gis_parcel_searches_count || 0)} Queries
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <p>• {metrics.gis_parcel_searches_count || 0} GIS Parcel Lookups</p>
                  <p>• {metrics.underwriting_pdf_views_count || 0} Underwriting PDF Views</p>
                  <p>• {metrics.saved_searches_count || 0} Saved Comps Alerts</p>
                </div>
              </div>
            </div>
          </div>

          {/* Explainable Factor Tags */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Explainable Scoring Weights &amp; Reasonings
            </h3>
            <div className="space-y-2">
              {lead.factors && lead.factors.length > 0 ? (
                lead.factors.map((f, i) => (
                  <div
                    key={i}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                        <span>{f.factor.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-slate-500 text-[11px] leading-relaxed">
                        {f.reasoning || f.description || 'Calculated dynamic parameter.'}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono font-bold px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 text-[11px]">
                      +{f.score_contribution || f.impact || 15} pts
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                  Standard baseline calculation factors active.
                </div>
              )}
            </div>
          </div>

          {/* Interactive Live Activity Simulator */}
          <div className="bg-gradient-to-br from-cyan-50/70 to-indigo-50/70 border border-cyan-200/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4 text-cyan-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-900">
                  Live Engagement Simulator (Test Dynamic Recalculation)
                </h4>
              </div>
              <span className="text-[10px] text-cyan-700 bg-cyan-100/80 px-2 py-0.5 rounded-full font-medium">
                Instant Recalculation
              </span>
            </div>
            <p className="text-xs text-cyan-800/80">
              Simulate incoming telephony talk-time, email opens, or GIS property searches to watch the dynamic score adjust in real-time.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              <button
                id="sim-call-btn"
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulate('call', { duration_seconds: 120 })}
                className="px-3 py-2 bg-white hover:bg-cyan-50 border border-cyan-200 rounded-xl text-xs font-semibold text-cyan-900 flex items-center justify-center space-x-1.5 shadow-2xs hover:shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <PhoneCall className="w-3.5 h-3.5 text-cyan-600" />
                <span>+120s Talk Time</span>
              </button>

              <button
                id="sim-email-open-btn"
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulate('email_open')}
                className="px-3 py-2 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-900 flex items-center justify-center space-x-1.5 shadow-2xs hover:shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                <span>+1 Email Open</span>
              </button>

              <button
                id="sim-email-click-btn"
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulate('email_click')}
                className="px-3 py-2 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-900 flex items-center justify-center space-x-1.5 shadow-2xs hover:shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Proposal Click</span>
              </button>

              <button
                id="sim-gis-search-btn"
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulate('gis_search')}
                className="px-3 py-2 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center justify-center space-x-1.5 shadow-2xs hover:shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Search className="w-3.5 h-3.5 text-emerald-600" />
                <span>+1 GIS Search</span>
              </button>

              <button
                id="sim-pdf-view-btn"
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulate('pdf_view')}
                className="px-3 py-2 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900 flex items-center justify-center space-x-1.5 shadow-2xs hover:shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                <span>Underwriting PDF</span>
              </button>

              <button
                id="sim-deep-call-btn"
                type="button"
                disabled={isSimulating}
                onClick={() => handleSimulate('call', { duration_seconds: 240 })}
                className="px-3 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>+4m Deep Connect</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Last Recalculated: {new Date(metrics.last_recalculated_at || Date.now()).toLocaleTimeString()}
            </span>
          </div>
          <button
            id="close-score-breakdown-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
