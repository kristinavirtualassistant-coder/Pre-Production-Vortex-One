import React, { useState } from 'react';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Clock,
  Users,
  PhoneCall,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Sparkles,
  BarChart3,
  Filter,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { DialerCampaign, LeadRecord, Property } from '../types';

interface CampaignsViewProps {
  campaigns?: DialerCampaign[];
  leads?: LeadRecord[];
  properties?: Property[];
  onInitiateCampaign?: (campaign: DialerCampaign) => void;
  onNavigate: (view: string) => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns = [],
  leads = [],
  properties = [],
  onInitiateCampaign,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Default initial campaigns if empty
  const defaultCampaigns: DialerCampaign[] = campaigns.length > 0 ? campaigns : [
    {
      id: 'camp-1',
      organization_id: 'default-org',
      name: 'Orange County High Equity Multi-Family Q3',
      description: 'Absentee owners of 4-12 unit multifamily assets with >60% equity.',
      status: 'active',
      total_contacts: 48,
      dialed_count: 32,
      connected_count: 14,
      converted_count: 5,
      target_market: 'Orange County, CA',
      telephony_provider: 'ringcentral',
      timezone: 'America/Los_Angeles',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'camp-2',
      organization_id: 'default-org',
      name: 'Tax Delinquency & Distressed Owner Wave 1',
      description: 'Owners with verified county tax defaults and verified skip-trace phone numbers.',
      status: 'scheduled',
      total_contacts: 24,
      dialed_count: 0,
      connected_count: 0,
      converted_count: 0,
      target_market: 'Los Angeles County, CA',
      telephony_provider: 'ringcentral',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      timezone: 'America/Los_Angeles',
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'camp-3',
      organization_id: 'default-org',
      name: 'South Bay 1031 Exchange Buyer Target',
      description: 'Long-term owners (15+ yrs) positioned for institutional recapitalization.',
      status: 'completed',
      total_contacts: 36,
      dialed_count: 36,
      connected_count: 19,
      converted_count: 8,
      target_market: 'San Jose & Santa Clara, CA',
      telephony_provider: 'ringcentral',
      created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
    },
  ];

  const filteredCampaigns = defaultCampaigns.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.target_market.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalContacts = defaultCampaigns.reduce((sum, c) => sum + c.total_contacts, 0);
  const totalDialed = defaultCampaigns.reduce((sum, c) => sum + c.dialed_count, 0);
  const totalConnected = defaultCampaigns.reduce((sum, c) => sum + c.connected_count, 0);
  const totalConverted = defaultCampaigns.reduce((sum, c) => sum + c.converted_count, 0);
  const connectionRate = totalDialed > 0 ? Math.round((totalConnected / totalDialed) * 100) : 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-700">
              <Megaphone className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Growth &amp; Outreach Campaigns</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Automated multi-channel cadences, AI voice drops, and TCPA-compliant dialing batches.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onNavigate('dialer')}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-2xs"
          >
            <PhoneCall className="w-3.5 h-3.5 text-slate-500" />
            <span>Open Dialer</span>
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Targeted Owners</span>
            <Users className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{totalContacts}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Across {defaultCampaigns.length} cadences</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Calls Placed</span>
            <PhoneCall className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{totalDialed}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{totalContacts - totalDialed} queued in batch</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Live Connect Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{connectionRate}%</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">{totalConnected} decision-makers reached</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Qualified Leads</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">{totalConverted}</div>
          <div className="text-[11px] text-amber-600 font-medium mt-0.5">Pipeline stage conversion</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search campaigns or target market..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs">
            {(['all', 'active', 'scheduled', 'completed'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition cursor-pointer ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCampaigns.map((campaign) => {
          const progress = campaign.total_contacts > 0
            ? Math.round((campaign.dialed_count / campaign.total_contacts) * 100)
            : 0;

          return (
            <div
              key={campaign.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs hover:border-cyan-300 transition-all flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span
                    className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                      campaign.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : campaign.status === 'scheduled'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    {campaign.status}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-cyan-600" />
                    <span>TCPA Cleared</span>
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{campaign.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                    {campaign.description}
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Batch Progress</span>
                    <span className="font-mono font-semibold text-slate-700">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-cyan-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>{campaign.dialed_count} / {campaign.total_contacts} Contacts</span>
                    <span>{campaign.converted_count} Qualified</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{campaign.target_market}</span>
                <button
                  onClick={() => onNavigate('dialer')}
                  className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 flex items-center space-x-1 cursor-pointer"
                >
                  <span>Launch Batch</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
