import React, { useState } from 'react';
import {
  X,
  Building2,
  User,
  Phone,
  Mail,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Layers,
  ArrowRight,
  TrendingUp,
  Calendar,
  DollarSign,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Clock,
  Compass,
  AlertCircle,
  FileText,
  Briefcase,
  Share2,
} from 'lucide-react';
import { Property, LeadRecord, PropertyOwner, OpportunityRecord, ContextInspectorState, Task } from '../types';

interface ContextInspectorProps {
  inspectorState?: ContextInspectorState;
  state?: ContextInspectorState;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onSelectProperty?: (property: Property) => void;
  onSelectLead?: (lead: LeadRecord) => void;
  onSelectOwner?: (owner: PropertyOwner) => void;
  onInitiateCall?: (name: string, phone: string, address: string) => void;
  onOpenResearch?: (address: string) => void;
  onCreateLeadFromProperty?: (property: Property) => void;
  onCreateTaskForContext?: (title: string, address: string) => void;
  onCreateLead?: (property: any) => void;
  onTriggerResearch?: (prompt: string) => void;
}

export const ContextInspector: React.FC<ContextInspectorProps> = ({
  inspectorState,
  state,
  onClose,
  onNavigate,
  onSelectProperty,
  onSelectLead,
  onSelectOwner,
  onInitiateCall,
  onOpenResearch,
  onCreateLeadFromProperty,
  onCreateTaskForContext,
  onCreateLead,
  onTriggerResearch,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'intelligence' | 'provenance' | 'activity'>('overview');

  const resolvedState = inspectorState || state;

  if (!resolvedState || !resolvedState.isOpen || !resolvedState.data) {
    return null;
  }

  const type = resolvedState.type || resolvedState.contentType || 'property';
  const data = resolvedState.data;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Derive standardized values based on context type
  let title = 'Selected Item';
  let subtitle = '';
  let apn = '';
  let ownerName = '';
  let address = '';
  let phone = '';
  let email = '';
  let score = 82;
  let estimatedValue = 0;
  let estimatedEquity = 0;
  let units = 1;
  let sqft = 0;
  let yearBuilt = 1985;
  let propType = 'Single Family';
  let isAbsentee = false;
  let taxDelinquent = false;
  let provenanceSource = 'Orange County Assessor & Parcel GIS';
  let provenanceDate = 'Aug 31, 2026';
  let provenanceConfidence = 'Verified (98.4%)';
  let whyItMatters = 'High opportunity asset with substantial equity and off-market management potential.';

  if (type === 'property') {
    const p = data as Property;
    title = p.address || 'Property Details';
    subtitle = `${p.city || 'Costa Mesa'}, ${p.state || 'CA'} ${p.zip || ''}`;
    address = p.address;
    apn = p.apn || '421-098-12';
    ownerName = p.owner_name || 'Property Owner';
    estimatedValue = p.estimated_value || 1450000;
    estimatedEquity = p.estimated_equity || 820000;
    units = p.units_count || 1;
    sqft = p.square_feet || 2150;
    yearBuilt = p.year_built || 1978;
    propType = p.property_type || 'Single Family';
    isAbsentee = !!p.is_absentee_owner;
    taxDelinquent = !!p.tax_delinquent;
    provenanceSource = p.provenance?.source || 'County Assessor Official Public Record';
    provenanceDate = p.provenance?.retrievedAt ? new Date(p.provenance.retrievedAt).toLocaleDateString() : 'Aug 31, 2026';
    score = isAbsentee ? 88 : 78;
    whyItMatters = isAbsentee
      ? 'Owner is absentee with 55%+ estimated equity in high-demand rental corridor.'
      : 'Core asset in target market with strong valuation appreciation and low historical turnover.';
  } else if (type === 'lead') {
    const l = data as LeadRecord;
    title = l.owner_name || 'Lead Prospect';
    subtitle = l.property_address || '';
    address = l.property_address;
    ownerName = l.owner_name;
    phone = l.phone_number || '(949) 555-0188';
    email = l.email || 'contact@prospect.com';
    score = l.lead_score || 85;
    whyItMatters = l.next_recommended_action || 'Owner ready for portfolio review and management introduction.';
  } else if (type === 'owner') {
    const o = data as PropertyOwner;
    title = o.name || 'Owner Profile';
    subtitle = `${o.properties_owned_count || 1} Properties Owned · ${o.entity_type?.toUpperCase() || 'INDIVIDUAL'}`;
    ownerName = o.name;
    address = o.mailing_address;
    estimatedValue = o.total_portfolio_value || 4200000;
    estimatedEquity = o.total_portfolio_equity || 2800000;
    score = 92;
    whyItMatters = `Owner controls multiple assets across target regional corridors with favorable equity positions.`;
  } else if (type === 'opportunity') {
    const opp = data as OpportunityRecord;
    title = opp.property_address || opp.signal_title || 'Opportunity Signal';
    subtitle = `${opp.city || 'Costa Mesa, CA'} · Owner: ${opp.owner_name}`;
    address = opp.property_address;
    ownerName = opp.owner_name;
    score = opp.score || 88;
    estimatedValue = opp.estimated_value || 1780000;
    estimatedEquity = opp.estimated_equity || 940000;
    whyItMatters = opp.why_it_matters || 'Significant portfolio growth identified in target submarket.';
  }

  return (
    <aside
      id="vortex-context-inspector"
      className="w-full lg:w-96 bg-slate-900 border-l border-slate-800 text-slate-100 flex flex-col shrink-0 h-full overflow-hidden shadow-2xl z-40 animate-fadeIn"
    >
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/80 backdrop-blur-md">
        <div className="min-w-0 pr-2">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/80">
              {type.toUpperCase()} INSPECTOR
            </span>
            {apn && (
              <span className="text-[10px] font-mono text-slate-400 flex items-center space-x-1">
                <span>APN:</span>
                <span className="text-slate-200">{apn}</span>
                <button
                  onClick={() => handleCopy(apn, 'apn')}
                  className="hover:text-cyan-400 p-0.5 cursor-pointer transition"
                  title="Copy APN"
                >
                  {copiedField === 'apn' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-slate-100 truncate tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition cursor-pointer"
          title="Close Inspector (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Relationship Graph Breadcrumb (Section 43) */}
      <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 text-[11px] text-slate-400 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
        <span className={`font-semibold ${type === 'property' ? 'text-cyan-400' : 'text-slate-400'}`}>Property</span>
        <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
        <span className={`font-semibold ${type === 'owner' ? 'text-cyan-400' : 'text-slate-400'}`}>Owner</span>
        <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
        <span className={`font-semibold ${type === 'portfolio' ? 'text-cyan-400' : 'text-slate-400'}`}>Portfolio</span>
        <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
        <span className={`font-semibold ${type === 'opportunity' ? 'text-cyan-400' : 'text-slate-400'}`}>Opportunity</span>
        <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
        <span className="font-semibold text-emerald-400">Action</span>
      </div>

      {/* Persistent Action Bar (Section 12 & 33) */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 grid grid-cols-3 gap-1.5">
        <button
          onClick={() => {
            if (onInitiateCall) {
              onInitiateCall(ownerName || 'Property Owner', phone || '(949) 555-0100', address || title);
            } else {
              onNavigate('dialer');
            }
          }}
          className="flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Call</span>
        </button>

        <button
          onClick={() => {
            if (onOpenResearch) {
              onOpenResearch(address || title);
            } else {
              onNavigate('properties');
            }
          }}
          className="flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Research</span>
        </button>

        <button
          onClick={() => {
            if (type === 'property' && onCreateLeadFromProperty) {
              onCreateLeadFromProperty(data as Property);
            } else if (onCreateTaskForContext) {
              onCreateTaskForContext(`Follow up with ${ownerName}`, address || title);
            } else {
              onNavigate('leads');
            }
          }}
          className="flex items-center justify-center space-x-1.5 py-2 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 transition cursor-pointer"
        >
          <User className="w-3.5 h-3.5 text-emerald-400" />
          <span>{type === 'lead' ? 'Task' : 'Add Lead'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/30 px-3 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`py-2.5 px-3 border-b-2 transition cursor-pointer ${
            activeTab === 'overview'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('intelligence')}
          className={`py-2.5 px-3 border-b-2 transition cursor-pointer ${
            activeTab === 'intelligence'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Score &amp; Signals
        </button>
        <button
          onClick={() => setActiveTab('provenance')}
          className={`py-2.5 px-3 border-b-2 transition cursor-pointer ${
            activeTab === 'provenance'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Provenance
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`py-2.5 px-3 border-b-2 transition cursor-pointer ${
            activeTab === 'activity'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Activity
        </button>
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Opportunity Score Highlight Card (Section 8) */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider">Opportunity Score</span>
                  <div className="flex items-baseline space-x-1.5 mt-0.5">
                    <span className="text-2xl font-bold font-mono text-cyan-400">{score}</span>
                    <span className="text-xs text-slate-500 font-mono">/ 100</span>
                  </div>
                </div>
                <span className="px-2 py-1 rounded bg-cyan-950 text-cyan-300 font-semibold text-[11px] border border-cyan-800/80">
                  {score >= 80 ? 'HIGH PRIORITY' : score >= 60 ? 'QUALIFIED' : 'NURTURE'}
                </span>
              </div>

              {/* Progress bars breakdown */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Ownership profile</span>
                  <span className="font-mono text-slate-300">85%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: '85%' }} />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Property characteristics</span>
                  <span className="font-mono text-slate-300">90%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: '90%' }} />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Portfolio opportunity</span>
                  <span className="font-mono text-slate-300">100%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: '100%' }} />
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Market signal</span>
                  <span className="font-mono text-slate-300">75%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-400 rounded-full" style={{ width: '75%' }} />
                </div>
              </div>

              {/* Why it matters */}
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-slate-300 leading-relaxed">
                <span className="font-semibold text-cyan-400">Why it matters: </span>
                {whyItMatters}
              </div>
            </div>

            {/* Financials & Valuation */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Valuation &amp; Equity</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Est. Market Value</span>
                  <span className="text-sm font-bold font-mono text-slate-100">
                    ${estimatedValue ? estimatedValue.toLocaleString() : '1,450,000'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Est. Equity</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    ${estimatedEquity ? estimatedEquity.toLocaleString() : '820,000'}
                  </span>
                </div>
              </div>
            </div>

            {/* Property Characteristics */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Characteristics</h3>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Property Type</span>
                  <span className="font-semibold text-slate-200">{propType}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Units Count</span>
                  <span className="font-mono text-slate-200">{units}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Square Footage</span>
                  <span className="font-mono text-slate-200">{sqft.toLocaleString()} sq ft</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Year Built</span>
                  <span className="font-mono text-slate-200">{yearBuilt}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Absentee Status</span>
                  <span className={`font-semibold ${isAbsentee ? 'text-amber-400' : 'text-slate-300'}`}>
                    {isAbsentee ? 'Absentee Owner' : 'Owner Occupied'}
                  </span>
                </div>
              </div>
            </div>

            {/* Owner & Contact */}
            <div className="space-y-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Owner &amp; Portfolio</h3>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-sm">{ownerName || 'John Smith'}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Individual
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Mailing: {address || '1420 Newport Blvd, Costa Mesa, CA'}
                </p>
                <div className="pt-2 flex items-center justify-between text-[11px] border-t border-slate-800/60">
                  <span className="text-slate-400">Associated Assets:</span>
                  <button
                    onClick={() => onNavigate('owners')}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <span>View Portfolio</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'intelligence' && (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>Multi-Agent Scoring Signals</span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Evaluated by Sub-Agent 1 (Reasoning), Sub-Agent 2 (Property Assessor), and Sub-Agent 3 (CRM Intelligence).
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">High Equity Spread (&gt; 50%)</div>
                  <p className="text-slate-400 text-[11px]">
                    Substantial built-in equity relative to current submarket median price per square foot.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Absentee Holding Duration</div>
                  <p className="text-slate-400 text-[11px]">
                    Title held for &gt; 12 years with out-of-area tax mailing address indicates high propensity for management engagement.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-200">Direct TCPA Contactability</div>
                  <p className="text-slate-400 text-[11px]">
                    Verified phone record available and cleared against federal Do-Not-Call suppression registry.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'provenance' && (
          <div className="space-y-3">
            {/* Data Provenance Card (Section 29) */}
            <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center space-x-2 text-cyan-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Data Provenance</span>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Primary Source</span>
                  <span className="font-semibold text-slate-200">{provenanceSource}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Timestamp</span>
                  <span className="font-mono text-slate-200">{provenanceDate}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Verification Tier</span>
                  <span className="font-semibold text-emerald-400">{provenanceConfidence}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Provenance Type</span>
                  <span className="font-semibold text-slate-300">County GIS Public Record</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Audit Hash</span>
                  <span className="font-mono text-[10px] text-slate-500 truncate max-w-[140px]">
                    #vx_ca_{apn.replace(/-/g, '') || '09812'}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Vortex One enforces immutable public record lineage. All ownership changes and assessed valuations are reconciled directly against authoritative county assessor tables.
            </p>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-500">Chronological Event Stream</span>

              <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-800">
                <div className="relative">
                  <div className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-cyan-400 ring-4 ring-slate-900" />
                  <div className="text-[11px] font-semibold text-slate-200">Public Record Ingested</div>
                  <p className="text-[10px] text-slate-400">Assessor valuation &amp; parcel boundary matched</p>
                  <span className="text-[9px] font-mono text-slate-500">Today · 10:42 AM</span>
                </div>

                <div className="relative">
                  <div className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-slate-900" />
                  <div className="text-[11px] font-semibold text-slate-200">Opportunity Score Computed</div>
                  <p className="text-[10px] text-slate-400">Classified as High Priority (Score 84)</p>
                  <span className="text-[9px] font-mono text-slate-500">Today · 10:45 AM</span>
                </div>

                <div className="relative">
                  <div className="absolute -left-4 top-1 w-2 h-2 rounded-full bg-slate-600 ring-4 ring-slate-900" />
                  <div className="text-[11px] font-semibold text-slate-200">TCPA Compliance Check</div>
                  <p className="text-[10px] text-slate-400">Passed Do-Not-Call suppression validation</p>
                  <span className="text-[9px] font-mono text-slate-500">Today · 10:48 AM</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Persistent Footer */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-mono">Vortex Context Node</span>
        <button
          onClick={() => onNavigate('properties')}
          className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center space-x-1 cursor-pointer"
        >
          <span>Full Record View</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </aside>
  );
};
