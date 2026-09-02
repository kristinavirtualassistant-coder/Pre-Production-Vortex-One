import React, { useState } from 'react';
import {
  Layers,
  Building2,
  DollarSign,
  TrendingUp,
  MapPin,
  Search,
  Filter,
  ArrowRight,
  ExternalLink,
  Phone,
  Sparkles,
  ChevronRight,
  CheckSquare,
} from 'lucide-react';
import { Property, PortfolioRecord } from '../types';

interface PortfoliosViewProps {
  properties: Property[];
  onOpenInspector: (data: any) => void;
  onInitiateCall: (name: string, phone: string, address: string) => void;
  onNavigate: (view: string) => void;
}

export const PortfoliosView: React.FC<PortfoliosViewProps> = ({
  properties,
  onOpenInspector,
  onInitiateCall,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('port_1');

  const portfolios: PortfolioRecord[] = [
    {
      id: 'port_1',
      organization_id: '',
      owner_id: 'owner_1',
      owner_name: 'John Smith (CMC Coastal Holdings)',
      entity_type: 'individual',
      property_count: 7,
      markets_count: 3,
      markets: ['Costa Mesa', 'Newport Beach', 'Huntington Beach'],
      total_valuation: 9850000,
      total_equity: 5400000,
      total_units: 18,
      opportunity_count: 3,
      properties: properties.slice(0, 4),
      top_signal: 'High Equity Absentee Multi-Family cluster in Costa Mesa rental corridor.',
    },
    {
      id: 'port_2',
      organization_id: '',
      owner_id: 'owner_2',
      owner_name: 'Marcus Aurelius Properties LLC',
      entity_type: 'llc',
      property_count: 12,
      markets_count: 4,
      markets: ['Long Beach', 'Signal Hill', 'San Pedro', 'Torrance'],
      total_valuation: 18200000,
      total_equity: 11400000,
      total_units: 34,
      opportunity_count: 5,
      properties: properties.slice(0, 3),
      top_signal: 'Commercial strip & multi-family off-market value-add portfolio.',
    },
    {
      id: 'port_3',
      organization_id: '',
      owner_id: 'owner_3',
      owner_name: 'Elena Rostova Family Trust',
      entity_type: 'trust',
      property_count: 5,
      markets_count: 2,
      markets: ['Santa Ana', 'Orange'],
      total_valuation: 6900000,
      total_equity: 4100000,
      total_units: 12,
      opportunity_count: 2,
      properties: properties.slice(0, 2),
      top_signal: 'Generational estate transition with favorable basis and low debt leverage.',
    },
  ];

  const activePortfolio = portfolios.find((p) => p.id === selectedPortfolioId) || portfolios[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <span>Portfolio Intelligence &amp; Aggregates</span>
          </h1>
          <p className="text-xs text-slate-400">
            Multi-property ownership groups, regional concentrations, and equity rollups
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search portfolios..."
              className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Main Layout: Left Portfolio Selector | Right Detailed Portfolio Map & Rollup */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Portfolio Selector */}
        <div className="w-80 md:w-96 border-r border-slate-800/80 bg-slate-950/80 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 text-xs text-slate-400 flex justify-between">
            <span>Portfolio Groups</span>
            <span className="font-mono text-cyan-400">{portfolios.length} Tracked</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {portfolios.map((port) => {
              const isSelected = port.id === activePortfolio.id;
              return (
                <div
                  key={port.id}
                  onClick={() => setSelectedPortfolioId(port.id)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer text-left ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/20'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-100 truncate">{port.owner_name}</span>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {port.property_count} Assets
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 truncate">
                    Markets: {port.markets.join(', ')}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/60 pt-1.5">
                    <span>${(port.total_valuation / 1000000).toFixed(1)}M Valuation</span>
                    <span className="text-emerald-400 font-bold">
                      ${(port.total_equity / 1000000).toFixed(1)}M Equity
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Detailed Portfolio Surface (Section 10 Layout) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Portfolio Header Bar */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  PORTFOLIO GROUP
                </span>
                <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight mt-1.5">
                  {activePortfolio.owner_name}
                </h2>
                <p className="text-xs text-slate-400">
                  Active Markets: {activePortfolio.markets.join(' · ')}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    onInitiateCall(activePortfolio.owner_name, '(949) 555-0188', activePortfolio.markets[0])
                  }
                  className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md cursor-pointer transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Portfolio Owner</span>
                </button>
                <button
                  onClick={() => onNavigate('opportunities')}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 cursor-pointer transition"
                >
                  View Opportunities ({activePortfolio.opportunity_count})
                </button>
              </div>
            </div>

            {/* KPI Blocks (Section 23) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Properties</span>
                <span className="text-xl font-bold font-mono text-cyan-400">
                  {activePortfolio.property_count}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Valuation</span>
                <span className="text-xl font-bold font-mono text-slate-100">
                  ${(activePortfolio.total_valuation / 1000000).toFixed(2)}M
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Equity</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  ${(activePortfolio.total_equity / 1000000).toFixed(2)}M
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Rental Units</span>
                <span className="text-xl font-bold font-mono text-slate-200">
                  {activePortfolio.total_units} Units
                </span>
              </div>
            </div>
          </div>

          {/* Simulated Geographic Concentration Map (Section 10 & 19) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>Geographic Asset Cluster Distribution</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500">
                Orange County Submarkets
              </span>
            </div>

            <div className="h-48 rounded-xl bg-slate-950 border border-slate-800 relative flex items-center justify-center p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
              <div className="flex items-center space-x-8">
                {activePortfolio.markets.map((market, idx) => (
                  <div key={market} className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-full bg-cyan-950 border-2 border-cyan-400 flex items-center justify-center font-mono font-bold text-cyan-300 text-sm shadow-lg shadow-cyan-500/10 mx-auto">
                      {idx + 2}
                    </div>
                    <div className="text-xs font-bold text-slate-200">{market}</div>
                    <div className="text-[10px] text-slate-500">Cluster Node</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Multi-Property Table (Section 10 & 21) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-cyan-400" />
                <span>Portfolio Properties &amp; Valuations</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {properties.length} Associated Assets
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono">
                  <tr>
                    <th className="p-3">Property</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Valuation</th>
                    <th className="p-3">Equity</th>
                    <th className="p-3">Opportunity</th>
                    <th className="p-3 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {properties.slice(0, 5).map((prop) => (
                    <tr key={prop.id} className="hover:bg-slate-900/60 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-100">{prop.address}</div>
                        <div className="text-[10px] text-slate-400">{prop.city}, CA · APN: {prop.apn}</div>
                      </td>
                      <td className="p-3 text-slate-300">{prop.property_type}</td>
                      <td className="p-3 font-mono text-slate-200">
                        ${((prop.estimated_value || 1450000) / 1000000).toFixed(2)}M
                      </td>
                      <td className="p-3 font-mono text-emerald-400">
                        ${((prop.estimated_equity || 820000) / 1000000).toFixed(2)}M
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                          {prop.is_absentee_owner ? '88 PTS' : '76 PTS'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => onOpenInspector(prop)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
