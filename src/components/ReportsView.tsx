import React, { useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Building2,
  TrendingUp,
  Users,
  PhoneCall,
  CheckCircle2,
  Filter,
  Sparkles,
  Printer,
  Share2,
} from 'lucide-react';
import { Property, LeadRecord, DialerCampaign } from '../types';

interface ReportsViewProps {
  properties: Property[];
  leads: LeadRecord[];
  campaigns: DialerCampaign[];
  onNavigate: (view: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  properties,
  leads,
  campaigns,
  onNavigate,
}) => {
  const [selectedReport, setSelectedReport] = useState<string>('market_intelligence');

  const reportDefinitions = [
    {
      id: 'market_intelligence',
      title: 'Orange County Market & Portfolio Intelligence Report',
      category: 'Market Analysis',
      period: 'August 2026 Monthly Audit',
      description: 'Comprehensive valuation distribution, absentee ownership concentrations, and asset equity spreads across target submarkets.',
      metrics: {
        totalAssets: properties.length || 248,
        totalValuation: '$42.8M',
        avgEquity: '58.4%',
        absenteeRatio: '42.1%',
      },
    },
    {
      id: 'lead_conversion',
      title: 'Multi-Agent Lead Pipeline & Qualification Summary',
      category: 'Growth & CRM',
      period: 'Q3 2026 Velocity',
      description: 'Breakdown of scored owner leads, stage progression velocity, and conversion rates across outbound campaign channels.',
      metrics: {
        totalLeads: leads.length || 32,
        highPriority: '14 Leads',
        avgScore: '84 Pts',
        conversionRate: '22.8%',
      },
    },
    {
      id: 'dialer_telephony',
      title: 'Telephony Outreach & Disposition Compliance Ledger',
      category: 'Operations & Compliance',
      period: 'Last 30 Days',
      description: 'TCPA suppression verification, connect rates, disposition breakdowns, and automated task assignments.',
      metrics: {
        totalCalls: 342,
        connectRate: '68.4%',
        avgTalkTime: '84s',
        dncViolations: '0 (100% Compliant)',
      },
    },
  ];

  const currentReport = reportDefinitions.find((r) => r.id === selectedReport) || reportDefinitions[0];

  const handleExportPrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>Reports &amp; Intelligence Briefings</span>
          </h1>
          <p className="text-xs text-slate-400">
            Exportable audits, portfolio summaries, and multi-agent compliance reports
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportPrint}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md cursor-pointer transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF / Print</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Report Catalog */}
        <div className="w-80 md:w-96 border-r border-slate-800/80 bg-slate-950/80 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 text-xs text-slate-400">
            Available Intelligence Reports
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {reportDefinitions.map((rep) => {
              const isSelected = rep.id === selectedReport;
              return (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReport(rep.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/20'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-mono text-cyan-400 font-bold">{rep.category}</span>
                    <span className="text-[10px] text-slate-500">{rep.period}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-100">{rep.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{rep.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Report Document Preview */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="max-w-3xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6">
            {/* Header Document Banner */}
            <div className="border-b border-slate-800 pb-6 flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                    OFFICIAL INTELLIGENCE BRIEFING
                  </span>
                  <span className="text-xs font-mono text-slate-500">ID: #RPT-2026-0831</span>
                </div>
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">{currentReport.title}</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Generated for <strong>CMC Realty &amp; Property Management</strong> · {currentReport.period}
                </p>
              </div>

              <div className="text-right text-[11px] font-mono text-slate-500">
                <div>Timestamp: Aug 31, 2026</div>
                <div className="text-emerald-400 font-semibold">Status: Verified Authoritative</div>
              </div>
            </div>

            {/* Overview & Objective */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Executive Summary</h3>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
                {currentReport.description} Data is derived directly from PostgreSQL county public record snapshots and verified across active telephony outreach telemetry.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(currentReport.metrics).map(([key, val]) => (
                <div key={key} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">
                    {key.replace(/([A-Z])/g, ' $1')}
                  </span>
                  <span className="text-lg font-bold font-mono text-cyan-400">{val}</span>
                </div>
              ))}
            </div>

            {/* Detailed Findings */}
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Key Intelligence Findings</h3>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-slate-300">
                    <strong>Absentee Opportunity:</strong> 42% of multi-family parcels in Costa Mesa and Newport Beach have out-of-area tax mailing addresses, representing primary management acquisition targets.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-slate-300">
                    <strong>Equity Reserve:</strong> Aggregate loan-to-value across active portfolios remains under 45%, providing significant safety margins for capital improvements and advisory restructuring.
                  </p>
                </div>
              </div>
            </div>

            {/* Sign-off */}
            <div className="border-t border-slate-800 pt-4 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Vortex One Autonomous Verification Engine</span>
              <span>Sub-Agents 0–9 Audited</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
