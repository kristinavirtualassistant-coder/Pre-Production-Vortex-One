import React from 'react';
import {
  TrendingUp,
  Users,
  Target,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Clock,
  PieChart,
  BarChart2,
  DollarSign,
  ShieldCheck,
} from 'lucide-react';
import { LeadRecord } from '../types';

interface CrmAnalyticsViewProps {
  leads: LeadRecord[];
}

export const CrmAnalyticsView: React.FC<CrmAnalyticsViewProps> = ({ leads }) => {
  const total = leads.length;
  const highPriority = leads.filter((l) => l.lead_score >= 80).length;
  const mediumPriority = leads.filter((l) => l.lead_score >= 60 && l.lead_score < 80).length;
  const nurture = leads.filter((l) => l.lead_score < 60).length;

  const contacted = leads.filter((l) => ['contacted', 'meeting_scheduled', 'won'].includes(l.stage)).length;
  const meetings = leads.filter((l) => ['meeting_scheduled', 'won'].includes(l.stage)).length;
  const won = leads.filter((l) => l.stage === 'won').length;

  const tcpaCompliant = leads.filter((l) => l.dnc_compliant).length;
  const avgScore = total > 0 ? Math.round(leads.reduce((sum, l) => sum + (l.lead_score || 0), 0) / total) : 0;

  const stagesCount: Record<string, number> = {
    identified: leads.filter((l) => l.stage === 'identified').length,
    enriched: leads.filter((l) => l.stage === 'enriched').length,
    qualified: leads.filter((l) => l.stage === 'qualified').length,
    outreach_ready: leads.filter((l) => l.stage === 'outreach_ready').length,
    contacted: leads.filter((l) => l.stage === 'contacted').length,
    meeting_scheduled: leads.filter((l) => l.stage === 'meeting_scheduled').length,
    won: leads.filter((l) => l.stage === 'won').length,
    lost: leads.filter((l) => l.stage === 'lost').length,
  };

  return (
    <div className="space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Active Prospects</span>
            <Users className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{total}</div>
          <div className="text-[11px] text-emerald-700 font-semibold">
            {highPriority} High Priority (80+)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Average Pipeline Score</span>
            <Target className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">{avgScore}/100</div>
          <div className="text-[11px] text-slate-500">
            Sub-Agent 2 Weighted Avg
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Contact Conversion Rate</span>
            <PhoneCall className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {total > 0 ? Math.round((contacted / total) * 100) : 0}%
          </div>
          <div className="text-[11px] text-blue-700 font-semibold">
            {contacted} in active outreach
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>TCPA Compliance Rate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {total > 0 ? Math.round((tcpaCompliant / total) * 100) : 100}%
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold">
            {tcpaCompliant} cleared for dialer
          </div>
        </div>
      </div>

      {/* Funnel Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Progression Funnel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
              <BarChart2 className="w-4 h-4 text-cyan-600" />
              <span>CRM Stage Conversion Funnel</span>
            </h3>
            <span className="text-[11px] text-slate-500">8 Pipeline Steps</span>
          </div>

          <div className="space-y-2.5">
            {[
              { id: 'identified', label: '1. Identified', count: stagesCount.identified, color: 'bg-slate-400' },
              { id: 'enriched', label: '2. Enriched', count: stagesCount.enriched, color: 'bg-indigo-500' },
              { id: 'qualified', label: '3. Qualified', count: stagesCount.qualified, color: 'bg-blue-500' },
              { id: 'outreach_ready', label: '4. Outreach Ready', count: stagesCount.outreach_ready, color: 'bg-purple-500' },
              { id: 'contacted', label: '5. Contacted', count: stagesCount.contacted, color: 'bg-amber-500' },
              { id: 'meeting_scheduled', label: '6. Meeting Scheduled', count: stagesCount.meeting_scheduled, color: 'bg-teal-500' },
              { id: 'won', label: '7. Won (Signed)', count: stagesCount.won, color: 'bg-emerald-500' },
              { id: 'lost', label: '8. Lost / Archived', count: stagesCount.lost, color: 'bg-rose-400' },
            ].map((step) => {
              const pct = total > 0 ? Math.round((step.count / total) * 100) : 0;
              return (
                <div key={step.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-slate-800">{step.label}</span>
                    <span className="font-mono text-slate-600 font-bold">
                      {step.count} <span className="text-slate-400 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${step.color} transition-all duration-300`}
                      style={{ width: `${Math.max(pct, step.count > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority & Classification Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
              <PieChart className="w-4 h-4 text-emerald-600" />
              <span>Score Tier Classification Distribution</span>
            </h3>
            <span className="text-[11px] text-slate-500">CMC Target Criteria</span>
          </div>

          <div className="space-y-4 pt-2">
            {/* High Priority Tier */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-950">High Priority Tier (Score 80–100)</span>
                </div>
                <span className="text-xs font-bold font-mono text-emerald-800">
                  {highPriority} leads ({total > 0 ? Math.round((highPriority / total) * 100) : 0}%)
                </span>
              </div>
              <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                Absentee landlords with substantial equity and commercial/multi-family scale. Highest conversion probability.
              </p>
            </div>

            {/* Medium Priority Tier */}
            <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  <span className="text-xs font-bold text-cyan-950">Medium Priority Tier (Score 60–79)</span>
                </div>
                <span className="text-xs font-bold font-mono text-cyan-800">
                  {mediumPriority} leads ({total > 0 ? Math.round((mediumPriority / total) * 100) : 0}%)
                </span>
              </div>
              <p className="text-[11px] text-cyan-900/80 leading-relaxed">
                Solid candidates for secondary outreach cadences, direct mail sequences, and recurring email nurture.
              </p>
            </div>

            {/* Nurture Pipeline Tier */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-xs font-bold text-slate-800">Nurture &amp; Long-Term (&lt;60)</span>
                </div>
                <span className="text-xs font-bold font-mono text-slate-700">
                  {nurture} leads ({total > 0 ? Math.round((nurture / total) * 100) : 0}%)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Lower equity or owner-occupied properties enrolled in automated background tax delinquency tracking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
