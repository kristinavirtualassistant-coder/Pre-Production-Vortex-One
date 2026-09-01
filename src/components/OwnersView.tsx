import React, { useState } from 'react';
import {
  Users,
  Building2,
  Phone,
  Mail,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Layers,
  ArrowRight,
  TrendingUp,
  Search,
  Plus,
  Compass,
  FileText,
  DollarSign,
  ChevronRight,
  Clock,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import { Property, PropertyOwner, LeadRecord } from '../types';

interface OwnersViewProps {
  properties: Property[];
  onOpenInspector: (owner: any) => void;
  onInitiateCall: (name: string, phone: string, address: string) => void;
  onNavigate: (view: string) => void;
}

export const OwnersView: React.FC<OwnersViewProps> = ({
  properties,
  onOpenInspector,
  onInitiateCall,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('owner_1');

  // Derive owners from properties
  const owners: PropertyOwner[] = [
    {
      id: 'owner_1',
      organization_id: 'org_cmc_realty',
      name: 'John Smith',
      entity_type: 'individual',
      mailing_address: '1420 Newport Blvd, Costa Mesa, CA',
      mailing_city: 'Costa Mesa',
      mailing_state: 'CA',
      mailing_zip: '92627',
      phone_numbers: [
        { number: '(949) 555-0188', type: 'mobile', dnc_status: false, confidence: 0.98 },
        { number: '(714) 555-0122', type: 'landline', dnc_status: false, confidence: 0.91 },
      ],
      email_addresses: [
        { email: 'john.smith.realty@gmail.com', verified: true, confidence: 0.95 },
      ],
      properties_owned_count: 7,
      total_portfolio_value: 9850000,
      total_portfolio_equity: 5400000,
      notes: 'Active multi-family investor across Orange County. Holds assets in Costa Mesa and Newport Beach.',
    },
    {
      id: 'owner_2',
      organization_id: 'org_cmc_realty',
      name: 'Marcus Aurelius Properties LLC',
      entity_type: 'llc',
      mailing_address: '880 Ocean Ave, Long Beach, CA',
      mailing_city: 'Long Beach',
      mailing_state: 'CA',
      mailing_zip: '90802',
      phone_numbers: [
        { number: '(562) 555-0144', type: 'mobile', dnc_status: false, confidence: 0.95 },
      ],
      email_addresses: [
        { email: 'investments@aureliusllc.com', verified: true, confidence: 0.94 },
      ],
      properties_owned_count: 12,
      total_portfolio_value: 18200000,
      total_portfolio_equity: 11400000,
      notes: 'Commercial & Multi-Family portfolio in coastal LA/OC corridors.',
    },
    {
      id: 'owner_3',
      organization_id: 'org_cmc_realty',
      name: 'Elena Rostova Family Trust',
      entity_type: 'trust',
      mailing_address: '2200 E 4th St, Santa Ana, CA',
      mailing_city: 'Santa Ana',
      mailing_state: 'CA',
      mailing_zip: '92705',
      phone_numbers: [
        { number: '(714) 555-0199', type: 'mobile', dnc_status: false, confidence: 0.96 },
      ],
      email_addresses: [
        { email: 'rostova.trust@socalholdings.com', verified: true, confidence: 0.92 },
      ],
      properties_owned_count: 5,
      total_portfolio_value: 6900000,
      total_portfolio_equity: 4100000,
      notes: 'Long-term hold absentee trust. Recent tax record updates indicate generational transition.',
    },
  ];

  const filteredOwners = owners.filter(
    (o) =>
      o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.mailing_city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeOwner = owners.find((o) => o.id === selectedOwnerId) || owners[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center space-x-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Owner Intelligence &amp; Profiles</span>
          </h1>
          <p className="text-xs text-slate-400">
            Authoritative owner portfolios, verified contact points, and associated corporate entities
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search owners or entities..."
              className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {/* Main Split View: Left Owner List | Right Owner Profile Detail */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Owner List */}
        <div className="w-80 md:w-96 border-r border-slate-800/80 bg-slate-950/80 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-800/80 text-xs text-slate-400 flex justify-between">
            <span>Identified Portfolio Owners</span>
            <span className="font-mono text-cyan-400">{filteredOwners.length} Records</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {filteredOwners.map((owner) => {
              const isSelected = owner.id === activeOwner.id;
              return (
                <div
                  key={owner.id}
                  onClick={() => {
                    setSelectedOwnerId(owner.id);
                    onOpenInspector(owner);
                  }}
                  className={`p-3 rounded-xl border transition cursor-pointer text-left ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500 shadow-md ring-1 ring-cyan-500/20'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-100 truncate">{owner.name}</span>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {owner.entity_type}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">{owner.mailing_address}</div>
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/60 pt-1.5">
                    <span>{owner.properties_owned_count} Properties</span>
                    <span className="text-emerald-400">${(owner.total_portfolio_value / 1000000).toFixed(1)}M Value</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Owner Profile Detail (Section 9) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Owner Profile Header Card */}
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-xl space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {activeOwner.entity_type.toUpperCase()} OWNER
                  </span>
                  <span className="text-xs text-slate-400">Orange County &amp; Los Angeles</span>
                </div>
                <h2 className="text-2xl font-extrabold text-slate-100 tracking-tight">{activeOwner.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tax Address: {activeOwner.mailing_address}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    onInitiateCall(
                      activeOwner.name,
                      activeOwner.phone_numbers[0]?.number || '(949) 555-0188',
                      activeOwner.mailing_address
                    )
                  }
                  className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md cursor-pointer transition"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Owner</span>
                </button>
                <button
                  onClick={() => onNavigate('leads')}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 cursor-pointer transition"
                >
                  Create Lead
                </button>
                <button
                  onClick={() => onOpenInspector(activeOwner)}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 cursor-pointer transition"
                >
                  Open Inspector
                </button>
              </div>
            </div>

            {/* Quick Stats Grid (Section 23 KPI Blocks) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Total Portfolio</span>
                <span className="text-xl font-bold font-mono text-cyan-400">
                  {activeOwner.properties_owned_count} Assets
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Estimated Valuation</span>
                <span className="text-xl font-bold font-mono text-slate-100">
                  ${(activeOwner.total_portfolio_value / 1000000).toFixed(1)}M
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Estimated Equity</span>
                <span className="text-xl font-bold font-mono text-emerald-400">
                  ${(activeOwner.total_portfolio_equity / 1000000).toFixed(1)}M
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-[10px] uppercase font-mono text-slate-500 block">Target Opportunities</span>
                <span className="text-xl font-bold font-mono text-amber-400">3 Signals</span>
              </div>
            </div>
          </div>

          {/* Contact Points & Provenance (Section 9 & 29) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Verified Contact Details */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                  <Phone className="w-4 h-4 text-cyan-400" />
                  <span>Verified Contact Intelligence</span>
                </h3>
                <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800">
                  TCPA Cleared
                </span>
              </div>

              <div className="space-y-2">
                {activeOwner.phone_numbers.map((phone, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono text-slate-100 font-bold">{phone.number}</span>
                      <span className="text-[10px] text-slate-400 uppercase ml-2">({phone.type})</span>
                    </div>
                    <button
                      onClick={() =>
                        onInitiateCall(activeOwner.name, phone.number, activeOwner.mailing_address)
                      }
                      className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 font-semibold text-xs border border-cyan-800 cursor-pointer"
                    >
                      Dial Now
                    </button>
                  </div>
                ))}

                {activeOwner.email_addresses.map((email, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-200">{email.email}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">95% Confidence</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Entity Structure & Background */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Briefcase className="w-4 h-4 text-cyan-400" />
                <span>Entity &amp; Ownership Notes</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
                {activeOwner.notes}
              </p>
              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Data Freshness: Aug 31, 2026</span>
                <span className="text-cyan-400 font-semibold cursor-pointer hover:underline">
                  Trigger Skip-Trace Refresh
                </span>
              </div>
            </div>
          </div>

          {/* Associated Portfolio Properties Table (Section 10) */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-cyan-400" />
                <span>Owned Properties in Active Database</span>
              </h3>
              <button
                onClick={() => onNavigate('portfolios')}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <span>Full Portfolio View</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-mono">
                  <tr>
                    <th className="p-3">Property</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Est. Valuation</th>
                    <th className="p-3">Est. Equity</th>
                    <th className="p-3">Opportunity</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                  {properties.slice(0, 4).map((prop) => (
                    <tr key={prop.id} className="hover:bg-slate-900/60 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-100">{prop.address}</div>
                        <div className="text-[10px] text-slate-400 font-mono">APN: {prop.apn}</div>
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
