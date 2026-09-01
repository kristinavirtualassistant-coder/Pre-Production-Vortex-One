import React, { useState } from 'react';
import {
  Sparkles,
  Building2,
  Users,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { Property } from '../types';

interface ResearchQueueViewProps {
  properties: Property[];
  onOpenInspector: (data: any) => void;
  onInitiateResearch: (address: string) => void;
  onNavigate: (view: string) => void;
}

export const ResearchQueueView: React.FC<ResearchQueueViewProps> = ({
  properties,
  onOpenInspector,
  onInitiateResearch,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTier, setActiveTier] = useState<'all' | 'high' | 'medium'>('all');

  const researchItems = [
    {
      id: 'res_1',
      property_address: '1420 Newport Blvd, Costa Mesa, CA',
      owner_name: 'John Smith',
      priority: 'high',
      signal: 'Portfolio Growth & Absentee',
      characteristics: 'Multi-Family · 4 Units · 1978 Built',
      contactability: 'Verified Phone + Mobile (98% Conf)',
      data_freshness: '12 hrs ago',
      provenance: 'Orange County Assessor',
    },
    {
      id: 'res_2',
      property_address: '880 Ocean Ave, Long Beach, CA',
      owner_name: 'Marcus Aurelius Properties LLC',
      priority: 'high',
      signal: 'Commercial Strip / Multi-Family Rollup',
      characteristics: 'Commercial & Multi · 12 Units',
      contactability: 'Corporate Agent Verified',
      data_freshness: '1 day ago',
      provenance: 'LA County Registrar',
    },
    {
      id: 'res_3',
      property_address: '2200 E 4th St, Santa Ana, CA',
      owner_name: 'Elena Rostova Family Trust',
      priority: 'high',
      signal: 'Ownership Succession Transition',
      characteristics: 'Single Family · High Equity',
      contactability: 'Trustee Phone Cleared',
      data_freshness: '2 days ago',
      provenance: 'Public Record Gazette',
    },
    {
      id: 'res_4',
      property_address: '412 Magnolia Ave, Huntington Beach, CA',
      owner_name: 'Pacific Coast Asset Management',
      priority: 'medium',
      signal: 'Market Submarket Rent Arbitrage',
      characteristics: 'Single Family · Coastal',
      contactability: 'Landline Identified',
      data_freshness: '3 days ago',
      provenance: 'CA GIS Parcel Registry',
    },
    {
      id: 'res_5',
      property_address: '1605 Baker St, Costa Mesa, CA',
      owner_name: 'Golden State Investments',
      priority: 'medium',
      signal: 'Tax Delinquency & Absentee Notice',
      characteristics: 'Commercial Strip · 2,400 sq ft',
      contactability: 'Skip-Trace Pending',
      data_freshness: '4 days ago',
      provenance: 'County Tax Collector Ledger',
    },
  ];

  const filteredItems = researchItems.filter((item) => {
    const matchTier = activeTier === 'all' || item.priority === activeTier;
    const matchSearch =
      !searchTerm ||
      item.property_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.signal.toLowerCase().includes(searchTerm.toLowerCase());
    return matchTier && matchSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <span>Research &amp; Enrichment Queue</span>
          </h1>
          <p className="text-xs text-slate-400">
            Priority signals requiring sub-agent verification, skip-trace validation, or parcel deed inspection
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search queue..."
              className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setActiveTier('all')}
              className={`px-3 py-1 rounded font-semibold transition cursor-pointer ${
                activeTier === 'all' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTier('high')}
              className={`px-3 py-1 rounded font-semibold transition cursor-pointer ${
                activeTier === 'high' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-400'
              }`}
            >
              High Priority
            </button>
          </div>
        </div>
      </div>

      {/* Main Table (Section 15 Layout) */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="p-4">Property &amp; Characteristics</th>
                <th className="p-4">Owner Entity</th>
                <th className="p-4">Priority Signal</th>
                <th className="p-4">Contactability</th>
                <th className="p-4">Data Freshness</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-900/60 transition">
                  <td className="p-4">
                    <div className="font-bold text-slate-100">{item.property_address}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{item.characteristics}</div>
                  </td>

                  <td className="p-4">
                    <div className="font-semibold text-slate-200">{item.owner_name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Source: {item.provenance}</div>
                  </td>

                  <td className="p-4">
                    <div className="flex items-center space-x-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.priority === 'high' ? 'bg-cyan-400' : 'bg-amber-400'
                        }`}
                      />
                      <span className="font-semibold text-slate-200">{item.signal}</span>
                    </div>
                  </td>

                  <td className="p-4">
                    <span className="text-[11px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800">
                      {item.contactability}
                    </span>
                  </td>

                  <td className="p-4 font-mono text-slate-400 text-[11px]">
                    {item.data_freshness}
                  </td>

                  <td className="p-4 text-right">
                    <button
                      onClick={() => onInitiateResearch(item.property_address)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer"
                    >
                      Enrich &amp; Verify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
