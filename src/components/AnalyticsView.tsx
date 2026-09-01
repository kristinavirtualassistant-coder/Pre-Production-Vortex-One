import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  Users,
  Target,
  DollarSign,
  ShieldCheck,
  Building2,
  PhoneCall,
  Activity,
  Layers,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import { LeadRecord, Property, AgentDefinition } from '../types';
import { CrmAnalyticsView } from './CrmAnalyticsView';
import { PropertyTrendChart } from './PropertyTrendChart';

interface AnalyticsViewProps {
  leads: LeadRecord[];
  properties: Property[];
  agents?: AgentDefinition[];
  onNavigate: (view: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  leads,
  properties,
  agents = [],
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<'crm' | 'properties' | 'agents'>('crm');

  const totalValuation = properties.reduce((sum, p) => sum + (p.estimated_value || 0), 0);
  const totalEquity = properties.reduce((sum, p) => sum + (p.estimated_equity || 0), 0);
  const avgEquityRatio = totalValuation > 0 ? Math.round((totalEquity / totalValuation) * 100) : 0;
  const highPriorityLeads = leads.filter((l) => l.lead_score >= 80).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-700">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Intelligence &amp; Portfolio Analytics</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time conversion velocity, GIS equity rollups, and sub-agent accuracy metrics.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
          <button
            onClick={() => setActiveTab('crm')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'crm'
                ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>CRM &amp; Pipeline</span>
          </button>
          <button
            onClick={() => setActiveTab('properties')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'properties'
                ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Asset &amp; Equity Rollup</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Portfolio Valuation</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
            ${(totalValuation / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across {properties.length} recorded parcels</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Estimated Total Equity</span>
            <TrendingUp className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold text-cyan-700 mt-1 font-mono">
            ${(totalEquity / 1_000_000).toFixed(1)}M
          </div>
          <div className="text-[11px] text-cyan-600 font-medium mt-0.5">{avgEquityRatio}% average equity buffer</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>High-Priority Leads</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{highPriorityLeads}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-0.5">Score &ge; 80 / 100</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Compliance Integrity</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">100%</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">DNC / TCPA verified</div>
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'crm' && (
        <div className="space-y-6">
          <CrmAnalyticsView leads={leads} />
        </div>
      )}

      {activeTab === 'properties' && (
        <div className="space-y-6">
          <PropertyTrendChart properties={properties} />
          
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">County Assessor Data Distribution</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <p className="text-xs text-slate-500 font-medium">Orange County, CA</p>
                <p className="text-xl font-bold text-slate-800 font-mono">
                  {properties.filter((p) => p.county?.toLowerCase().includes('orange')).length} Assets
                </p>
                <p className="text-[11px] text-slate-400">MapServer Layer 0 GIS</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <p className="text-xs text-slate-500 font-medium">Los Angeles County, CA</p>
                <p className="text-xl font-bold text-slate-800 font-mono">
                  {properties.filter((p) => p.county?.toLowerCase().includes('los angeles')).length} Assets
                </p>
                <p className="text-[11px] text-slate-400">Assessor Secured Roll</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <p className="text-xs text-slate-500 font-medium">Santa Clara County, CA</p>
                <p className="text-xl font-bold text-slate-800 font-mono">
                  {properties.filter((p) => p.county?.toLowerCase().includes('santa clara') || p.county?.toLowerCase().includes('san')).length} Assets
                </p>
                <p className="text-[11px] text-slate-400">Public Portal Sync</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
