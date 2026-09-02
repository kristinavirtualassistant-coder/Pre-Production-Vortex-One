import React, { useState } from 'react';
import {
  Sparkles,
  Building2,
  TrendingUp,
  User,
  Phone,
  ArrowRight,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { Property, OpportunityRecord, LeadRecord } from '../types';

interface OpportunitiesViewProps {
  properties: Property[];
  onOpenInspector: (data: any) => void;
  onCreateLead: (property: Property) => void;
  onInitiateCall: (name: string, phone: string, address: string) => void;
  onNavigate: (view: string) => void;
}

export const OpportunitiesView: React.FC<OpportunitiesViewProps> = ({
  properties,
  onOpenInspector,
  onCreateLead,
  onInitiateCall,
  onNavigate,
}) => {
  const [filterSignal, setFilterSignal] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const opportunities: OpportunityRecord[] = [
    {
      id: 'opp_1',
      organization_id: '',
      property_id: 'prop_1',
      property_address: '1420 Newport Blvd',
      city: 'Costa Mesa',
      owner_id: 'owner_1',
      owner_name: 'John Smith',
      score: 88,
      priority: 'high',
      signal_type: 'portfolio_growth',
      signal_title: 'Portfolio Multi-Asset Owner',
      why_it_matters: 'Owner holds 7 properties across Costa Mesa corridor with 55%+ built-in equity. Ready for management advisory.',
      confidence: 'Verified',
      data_freshness: 'Aug 31, 2026',
      estimated_value: 1750000,
      estimated_equity: 980000,
      score_components: {
        ownership: 90,
        property_type: 88,
        portfolio: 95,
        market: 80,
        signal_strength: 87,
      },
      created_at: '2026-08-31T10:00:00.000Z',
    },
    {
      id: 'opp_2',
      organization_id: '',
      property_id: 'prop_2',
      property_address: '880 Ocean Ave',
      city: 'Long Beach',
      owner_id: 'owner_2',
      owner_name: 'Marcus Aurelius Properties LLC',
      score: 92,
      priority: 'high',
      signal_type: 'absentee_high_equity',
      signal_title: 'High Equity Absentee Strip & Residential',
      why_it_matters: 'Out-of-county tax address with 12 assets in coastal corridors. Substantial upside via lease renegotiation.',
      confidence: 'High',
      data_freshness: 'Aug 30, 2026',
      estimated_value: 2450000,
      estimated_equity: 1600000,
      score_components: {
        ownership: 95,
        property_type: 90,
        portfolio: 100,
        market: 85,
        signal_strength: 90,
      },
      created_at: '2026-08-30T14:30:00.000Z',
    },
    {
      id: 'opp_3',
      organization_id: '',
      property_id: 'prop_3',
      property_address: '2200 E 4th St',
      city: 'Santa Ana',
      owner_id: 'owner_3',
      owner_name: 'Elena Rostova Family Trust',
      score: 84,
      priority: 'high',
      signal_type: 'ownership_transition',
      signal_title: 'Generational Estate Transition',
      why_it_matters: 'Recent assessor trust filing indicates impending succession and portfolio realignment.',
      confidence: 'Verified',
      data_freshness: 'Aug 29, 2026',
      estimated_value: 1350000,
      estimated_equity: 820000,
      score_components: {
        ownership: 85,
        property_type: 80,
        portfolio: 90,
        market: 78,
        signal_strength: 87,
      },
      created_at: '2026-08-29T09:15:00.000Z',
    },
    {
      id: 'opp_4',
      organization_id: '',
      property_id: 'prop_4',
      property_address: '412 Magnolia Ave',
      city: 'Huntington Beach',
      owner_id: 'owner_4',
      owner_name: 'Pacific Coast Asset Management',
      score: 79,
      priority: 'medium',
      signal_type: 'market_arbitrage',
      signal_title: 'Rent Submarket Arbitrage',
      why_it_matters: 'In-place rents trailing submarket median by 22% based on latest neighborhood comp index.',
      confidence: 'Medium',
      data_freshness: 'Aug 28, 2026',
      estimated_value: 1950000,
      estimated_equity: 900000,
      score_components: {
        ownership: 80,
        property_type: 82,
        portfolio: 75,
        market: 85,
        signal_strength: 74,
      },
      created_at: '2026-08-28T16:00:00.000Z',
    },
  ];

  const filteredOpportunities = opportunities.filter((opp) => {
    const matchSignal = filterSignal === 'all' || opp.signal_type === filterSignal;
    const matchSearch =
      !searchTerm ||
      opp.property_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      opp.city.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSignal && matchSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>Target Opportunities &amp; Signals</span>
          </h1>
          <p className="text-xs text-slate-400">
            Scored deal signals explaining why assets matter, confidence metrics, and immediate conversion actions
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search opportunity signals..."
              className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <select
            value={filterSignal}
            onChange={(e) => setFilterSignal(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All Signals</option>
            <option value="portfolio_growth">Portfolio Growth</option>
            <option value="absentee_high_equity">Absentee High Equity</option>
            <option value="ownership_transition">Ownership Transition</option>
            <option value="market_arbitrage">Market Arbitrage</option>
          </select>
        </div>
      </div>

      {/* KPI Blocks for Opportunities (Section 23) */}
      <div className="p-4 bg-slate-950 border-b border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Opportunities</span>
          <span className="text-2xl font-bold font-mono text-cyan-400">248 Signals</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">High Priority Tier</span>
          <span className="text-2xl font-bold font-mono text-slate-100">32 Qualified</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Active Conversations</span>
          <span className="text-2xl font-bold font-mono text-emerald-400">18 In Progress</span>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Management Wins</span>
          <span className="text-2xl font-bold font-mono text-amber-400">7 Mandates</span>
        </div>
      </div>

      {/* Opportunities Cards Grid (Section 24) */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOpportunities.map((opp) => {
            const correspondingProperty = properties.find((p) => p.address === opp.property_address) || properties[0];

            return (
              <div
                key={opp.id}
                className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition shadow-xl space-y-4 text-left"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                        {opp.priority.toUpperCase()} OPPORTUNITY
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        Confidence: <strong className="text-emerald-400">{opp.confidence}</strong>
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-100">{opp.property_address}</h3>
                    <p className="text-xs text-slate-400">
                      {opp.city}, CA · Owner: <strong className="text-slate-200">{opp.owner_name}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-2xl font-extrabold font-mono text-cyan-400 block">{opp.score}</span>
                    <span className="text-[9px] font-mono uppercase text-slate-500">Score / 100</span>
                  </div>
                </div>

                {/* Why It Matters Callout (Section 24) */}
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                  <div className="flex items-center space-x-1.5 text-cyan-400 font-bold text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Signal: {opp.signal_title}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">
                    <strong className="text-slate-100">Why it matters: </strong>
                    {opp.why_it_matters}
                  </p>
                </div>

                {/* Score Components breakdown */}
                <div className="grid grid-cols-3 gap-2 text-[10px] font-mono text-slate-400 border-t border-slate-800/60 pt-3">
                  <div>
                    <span className="text-slate-500 block">EST. VALUE</span>
                    <span className="text-xs font-bold text-slate-200">
                      ${((opp.estimated_value || 1500000) / 1000000).toFixed(2)}M
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">EST. EQUITY</span>
                    <span className="text-xs font-bold text-emerald-400">
                      ${((opp.estimated_equity || 800000) / 1000000).toFixed(2)}M
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">FRESHNESS</span>
                    <span className="text-xs text-slate-300">{opp.data_freshness}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() => onOpenInspector(opp)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <span>View Intelligence Score Breakdown</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => onInitiateCall(opp.owner_name, '(949) 555-0188', opp.property_address)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1 cursor-pointer transition shadow-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </button>
                    <button
                      onClick={() => onCreateLead(correspondingProperty)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 cursor-pointer transition"
                    >
                      Create Lead
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
