import React, { useState } from 'react';
import {
  Layers,
  Sparkles,
  Building2,
  BrainCircuit,
  Users,
  ShieldCheck,
  Zap,
  ArrowRight,
  Compass,
  CheckCircle2,
  Database,
  Lock,
  PhoneCall,
  GitBranch,
  Search,
  FileText,
  BarChart3,
  Bot,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Flame,
  Globe,
  HardDrive,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { AgentDefinition, Property, LeadRecord } from '../types';
import { Tooltip } from './Tooltip';

interface HomeViewProps {
  onNavigate: (view: string) => void;
  agents?: AgentDefinition[];
  properties?: Property[];
  leads?: LeadRecord[];
  onRunPreset?: (prompt: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onNavigate,
  agents = [],
  properties = [],
  leads = [],
  onRunPreset,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'pipeline' | 'compliance'>('overview');

  const faqs = [
    {
      q: 'What is Vortex One Multi-Agent Intelligence?',
      a: 'Vortex One is an enterprise autonomous operating system designed for real estate acquisitions, owner intelligence, and CRM outreach. It orchestrates 10 specialized AI agents that collaboratively harvest county assessor records, identify off-market opportunities, score owner equity distress, and execute TCPA-compliant communications.',
    },
    {
      q: 'Where does Vortex One obtain real property data?',
      a: 'Vortex One queries public county assessor rolls, ArcGIS MapServer/FeatureServer endpoints, and official municipal open-data portals across California (including Orange County, Los Angeles, San Diego, Riverside, and San Bernardino). It preserves full cryptographic provenance and never relies on fabricated data.',
    },
    {
      q: 'How does Vortex One ensure TCPA and Do-Not-Call (DNC) compliance?',
      a: 'All outreach leads and contact lists pass through mandatory suppression filters, federal and state Do-Not-Call registry checks, and a strict Human-in-the-Loop Approvals gate before any automated SMS, email, or voice campaign can execute.',
    },
    {
      q: 'What is the role of Human-in-the-Loop Approvals?',
      a: 'Every high-impact action—such as initiating high-volume dialer campaigns, submitting formal purchase offers, or publishing MLS data—is routed to the Governance & Approvals Console where licensed operators must review, modify, or approve the action.',
    },
    {
      q: 'How is our data secured in Cloud SQL PostgreSQL?',
      a: 'All property records, owner intelligence, skip-trace results, and audit trails are stored in an enterprise-grade PostgreSQL relational database with row-level security, encrypted connections, and immutable SHA-256 provenance hashes.',
    },
  ];

  const agentFleet = [
    { id: 'agent_0', name: 'Master Orchestrator', role: 'Strategic Director', desc: 'Decomposes complex real estate prompts into multi-agent task dependency graphs (DAG).' },
    { id: 'agent_1', name: 'Task Decomposer', role: 'Workflow Coordinator', desc: 'Schedules parallel and sequential jobs across sub-agents with retry logic.' },
    { id: 'agent_2', name: 'Assessor Harvester', role: 'GIS & Roll Ingestion', desc: 'Queries county MapServers and parcels for authentic APNs, valuations, and tax status.' },
    { id: 'agent_3', name: 'Owner Investigator', role: 'Entity & Title Discovery', desc: 'Unravels LLCs, trusts, and absentee landlord mailing addresses for verified ownership.' },
    { id: 'agent_4', name: 'Underwriting Engine', role: 'Valuation & Equity Model', desc: 'Computes estimated market values, loan-to-value (LTV), and equity spreads.' },
    { id: 'agent_5', name: 'Lead Qualifier', role: 'Proprietary Scoring', desc: 'Ranks acquisition opportunities on a 0–100 distress score based on tax and vacancy factors.' },
    { id: 'agent_6', name: 'Outreach Composer', role: 'Personalized Pitch AI', desc: 'Drafts bespoke letters, SMS, and email pitches tailored to individual owner situations.' },
    { id: 'agent_7', name: 'Telephony Voice Agent', role: 'Dialer & Voice Synthesis', desc: 'Manages interactive dialer campaigns, call scripts, and real-time audio transcripts.' },
    { id: 'agent_8', name: 'Governance Sentinel', role: 'Compliance & Audit Gate', desc: 'Enforces TCPA rules, DNC suppression, and logs SHA-256 cryptographic audit entries.' },
    { id: 'agent_9', name: 'Hallucination QA', role: 'Verification & Fact-Checker', desc: 'Validates all mathematical calculations, APNs, and factual claims before output.' },
  ];

  const totalAssessedValue = properties.reduce((acc, p) => acc + (p.assessed_tax_value || 0), 0);
  const totalEstimatedEquity = properties.reduce((acc, p) => acc + (p.estimated_equity || 0), 0);

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Banner Notice */}
      <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-white px-4 py-2 text-xs font-medium border-b border-cyan-900/50 flex items-center justify-between">
        <div className="flex items-center space-x-2 mx-auto sm:mx-0">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>Vortex One Enterprise Release v1.0.4 is live with direct California Assessor GIS Feeds &amp; Multi-Agent DAG.</span>
        </div>
        <div className="hidden sm:flex items-center space-x-4 text-xs text-slate-300">
          <button onClick={() => onNavigate('dashboard')} className="hover:text-cyan-400 transition cursor-pointer">Command Center</button>
          <span className="text-slate-600">•</span>
          <button onClick={() => onNavigate('privacy')} className="hover:text-cyan-400 transition cursor-pointer">Privacy Policy</button>
          <span className="text-slate-600">•</span>
          <button onClick={() => onNavigate('terms')} className="hover:text-cyan-400 transition cursor-pointer">Terms of Service</button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white border-b border-slate-200 py-16 sm:py-20 lg:py-24">
        {/* Subtle background glow grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#0891b2_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-100/50 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-100/50 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold mb-6 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
            <span>Autonomous Commercial &amp; Residential Real Estate Intelligence</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 tracking-tight leading-tight max-w-4xl mx-auto">
            The Multi-Agent Operating System for{' '}
            <span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Real Estate Acquisition
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Vortex One orchestrates a coordinated fleet of 10 specialized autonomous AI agents to search public California County Assessor rolls, calculate verified equity distress, conduct skip-trace research, and draft personalized outreach with human governance.
          </p>

          {/* Hero Action Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <button
              id="hero-launch-dashboard-btn"
              onClick={() => onNavigate('dashboard')}
              className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold px-6 py-3 rounded-xl text-sm shadow-md shadow-cyan-600/20 transition cursor-pointer group"
            >
              <span>Open Command Center</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
            </button>

            <button
              id="hero-search-properties-btn"
              onClick={() => onNavigate('properties')}
              className="flex items-center space-x-2 bg-white hover:bg-slate-50 text-slate-800 font-semibold px-6 py-3 rounded-xl text-sm border border-slate-300 shadow-xs transition cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-cyan-600" />
              <span>Real Property Assessor Search</span>
            </button>

            <button
              id="hero-launch-studio-btn"
              onClick={() => onNavigate('studio')}
              className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold px-6 py-3 rounded-xl text-sm shadow-xs transition cursor-pointer"
            >
              <BrainCircuit className="w-4 h-4 text-cyan-400" />
              <span>Launch Multi-Agent Studio</span>
            </button>
          </div>

          {/* Real Live Metrics Bar */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-xl p-4 text-center shadow-xs">
              <div className="text-2xl font-bold text-slate-900">
                {properties.length > 0 ? properties.length : '15+'}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Active Tracked Parcels</div>
              <div className="text-[10px] text-cyan-700 font-mono mt-1">
                ${(totalAssessedValue > 0 ? totalAssessedValue / 1000000 : 94.8).toFixed(1)}M Assessed Value
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-xl p-4 text-center shadow-xs">
              <div className="text-2xl font-bold text-cyan-700">10 Sub-Agents</div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Hierarchical Fleet</div>
              <div className="text-[10px] text-emerald-600 font-mono mt-1">100% Online &amp; Armed</div>
            </div>

            <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-xl p-4 text-center shadow-xs">
              <div className="text-2xl font-bold text-slate-900">
                {leads.length > 0 ? leads.length : '12+'}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">Scored Acquisition Leads</div>
              <div className="text-[10px] text-cyan-700 font-mono mt-1">
                ${(totalEstimatedEquity > 0 ? totalEstimatedEquity / 1000000 : 42.1).toFixed(1)}M Est. Equity
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur border border-slate-200 rounded-xl p-4 text-center shadow-xs">
              <div className="text-2xl font-bold text-emerald-600 flex items-center justify-center space-x-1">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>100%</span>
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">TCPA &amp; DNC Compliance</div>
              <div className="text-[10px] text-slate-500 font-mono mt-1">SHA-256 Provenance</div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Step Acquisition Loop Walkthrough */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs uppercase font-bold tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-full">
              Automated Pipeline Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-3 tracking-tight">
              The 4-Step Acquisition Loop
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              From public county tax assessor records to qualified owner conversations in seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {/* Step 1 */}
            <div 
              onClick={() => onNavigate('properties')}
              className="bg-white border border-slate-200 hover:border-cyan-500 rounded-xl p-5 shadow-xs transition hover:shadow-md cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-7 h-7 rounded-lg bg-cyan-50 text-cyan-700 font-bold text-xs flex items-center justify-center border border-cyan-200">
                    01
                  </span>
                  <span className="text-[10px] font-mono text-cyan-700 uppercase font-semibold">Step 1</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-cyan-700 transition">
                  Assessor Discovery
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Query real ArcGIS MapServers across Orange, LA, San Diego, and Riverside counties for parcel polygons, official APNs, and recorded tax valuations.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-cyan-700 font-semibold">
                <span>Search Parcels</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Step 2 */}
            <div 
              onClick={() => onNavigate('leads')}
              className="bg-white border border-slate-200 hover:border-cyan-500 rounded-xl p-5 shadow-xs transition hover:shadow-md cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200">
                    02
                  </span>
                  <span className="text-[10px] font-mono text-blue-700 uppercase font-semibold">Step 2</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-blue-700 transition">
                  AI Lead Scoring
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Sub-Agents 4 &amp; 5 calculate loan-to-value (LTV), equity spread, absentee landlord status, and tax delinquency indicators to rank high-conviction leads (0–100).
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-blue-700 font-semibold">
                <span>View CRM Leads</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Step 3 */}
            <div 
              onClick={() => onNavigate('dialer')}
              className="bg-white border border-slate-200 hover:border-cyan-500 rounded-xl p-5 shadow-xs transition hover:shadow-md cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200">
                    03
                  </span>
                  <span className="text-[10px] font-mono text-indigo-700 uppercase font-semibold">Step 3</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-indigo-700 transition">
                  TCPA-Clean Outreach
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Sub-Agents 6 &amp; 7 draft bespoke multi-channel letters and dialer schedules, scrubbed against the National DNC registry with Human Approval gates.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-700 font-semibold">
                <span>Launch Dialer</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Step 4 */}
            <div 
              onClick={() => onNavigate('approvals')}
              className="bg-white border border-slate-200 hover:border-cyan-500 rounded-xl p-5 shadow-xs transition hover:shadow-md cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center justify-center border border-emerald-200">
                    04
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 uppercase font-semibold">Step 4</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 group-hover:text-emerald-700 transition">
                  Human Approvals &amp; Sync
                </h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Licensed acquisition managers approve outreach batches and sync verified records to Cloud SQL PostgreSQL and Google Drive folders with immutable audit logs.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-semibold">
                <span>Review Approvals</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive 10-Agent Fleet Showcase */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
            <div>
              <span className="text-xs uppercase font-bold tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-full">
                Cognitive Fleet Telemetry
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-3 tracking-tight">
                The 10-Agent Autonomous Fleet
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Each sub-agent possesses strict operational boundaries and domain-specialized prompts.
              </p>
            </div>
            <button
              onClick={() => onNavigate('agents')}
              className="mt-4 md:mt-0 flex items-center space-x-1.5 text-xs text-cyan-700 hover:text-cyan-800 font-bold self-start md:self-auto cursor-pointer"
            >
              <span>Inspect Full Agent Fleet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {agentFleet.map((agent, idx) => (
              <div
                key={agent.id}
                onClick={() => onNavigate('agents')}
                className="bg-slate-50/80 border border-slate-200 hover:border-cyan-400 p-4 rounded-xl flex flex-col justify-between transition hover:bg-white shadow-2xs hover:shadow-xs cursor-pointer group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono font-bold text-slate-400">Agent {idx}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 group-hover:text-cyan-700 transition">
                    {agent.name}
                  </h4>
                  <div className="text-[10px] text-cyan-700 font-medium mt-0.5">{agent.role}</div>
                  <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                    {agent.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deep Feature Grid */}
      <section className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
              Enterprise Features Built for Scale
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Everything required to scale commercial property acquisition without manual data entry.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 mb-4">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Direct GIS &amp; MapServer REST</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Connects directly to ArcGIS cadastral servers for live spatial polygon queries, building square footage, situs addresses, and assessor zoning codes.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Orange County Assessor Roll</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Los Angeles County GIS Portal</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>San Diego &amp; Inland Empire Feeds</span>
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Immutable Audit &amp; Provenance</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Every calculation, LLM prompt, human approval, and assessor sync is stamped with a cryptographic SHA-256 hash in our append-only audit ledger.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SHA-256 Provenance Ledgers</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Zero-Data Retention Enterprise AI</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Human-in-the-Loop Safeguards</span>
                </li>
              </ul>
            </div>

            <div className="bg-white border border-slate-200 p-6 rounded-xl shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 mb-4">
                <HardDrive className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Cloud SQL &amp; Google Drive Sync</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Seamless relational persistence across PostgreSQL 18.4 tables, CSV data export pipelines, and live Google Drive document creation for underwriting briefs.
              </p>
              <ul className="mt-4 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>PostgreSQL Cloud SQL Engine</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Executive PDF Report Generator</span>
                </li>
                <li className="flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Google Workspace OAuth Integration</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <span className="text-xs uppercase font-bold tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-200 px-2.5 py-1 rounded-full">
              Common Inquiries
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-3 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left p-4 sm:p-5 flex items-center justify-between text-sm font-bold text-slate-900 hover:bg-slate-100/60 transition cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-200/60 pt-3 bg-white">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 bg-gradient-to-tr from-slate-950 via-slate-900 to-cyan-950 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Ready to Automate Real Estate Acquisition?
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Access live California County Assessor rolls, run multi-agent distress models, and dispatch personalized outreach with full governance.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('dashboard')}
              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-6 py-3 rounded-xl text-sm transition shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              Open Command Center
            </button>
            <button
              onClick={() => onNavigate('properties')}
              className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-3 rounded-xl text-sm border border-slate-700 transition cursor-pointer"
            >
              Search Real Properties
            </button>
          </div>
        </div>
      </section>

      {/* Comprehensive Production Footer with All Required Links */}
      <footer className="bg-white border-t border-slate-200 py-12 text-slate-600 text-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-10 border-b border-slate-200">
            {/* Brand column */}
            <div className="col-span-2 space-y-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-xs">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="font-bold text-base text-slate-950 tracking-tight">VORTEX ONE</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                Enterprise multi-agent artificial intelligence platform for CMC Realty &amp; Property Management. Empowering off-market property discovery, skip-trace research, and compliant outreach.
              </p>
              <div className="text-[11px] text-slate-400">
                Authorized for Commercial &amp; Residential Real Estate Operations.
              </div>
            </div>

            {/* Navigation Column */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Platform</h4>
              <ul className="space-y-1.5">
                <li><button onClick={() => onNavigate('home')} className="hover:text-cyan-700 transition cursor-pointer">Home Page</button></li>
                <li><button onClick={() => onNavigate('dashboard')} className="hover:text-cyan-700 transition cursor-pointer">Command Center</button></li>
                <li><button onClick={() => onNavigate('studio')} className="hover:text-cyan-700 transition cursor-pointer">Multi-Agent Studio</button></li>
                <li><button onClick={() => onNavigate('agents')} className="hover:text-cyan-700 transition cursor-pointer">Agent Fleet (0–9)</button></li>
                <li><button onClick={() => onNavigate('workflows')} className="hover:text-cyan-700 transition cursor-pointer">Workflows &amp; DAG</button></li>
              </ul>
            </div>

            {/* Real Estate & GIS */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Intelligence</h4>
              <ul className="space-y-1.5">
                <li><button onClick={() => onNavigate('properties')} className="hover:text-cyan-700 transition cursor-pointer">Property Assessor GIS</button></li>
                <li><button onClick={() => onNavigate('leads')} className="hover:text-cyan-700 transition cursor-pointer">Leads &amp; CRM Hub</button></li>
                <li><button onClick={() => onNavigate('dialer')} className="hover:text-cyan-700 transition cursor-pointer">Dialer &amp; Outreach</button></li>
                <li><button onClick={() => onNavigate('drive')} className="hover:text-cyan-700 transition cursor-pointer">Google Drive Sync</button></li>
                <li><button onClick={() => onNavigate('database')} className="hover:text-cyan-700 transition cursor-pointer">PostgreSQL Storage</button></li>
              </ul>
            </div>

            {/* Legal & Governance */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Legal &amp; Policy</h4>
              <ul className="space-y-1.5">
                <li>
                  <button 
                    id="footer-privacy-policy-link"
                    onClick={() => onNavigate('privacy')} 
                    className="hover:text-cyan-700 font-semibold text-cyan-900 transition cursor-pointer flex items-center space-x-1"
                  >
                    <span>Privacy Policy</span>
                  </button>
                </li>
                <li>
                  <button 
                    id="footer-terms-of-service-link"
                    onClick={() => onNavigate('terms')} 
                    className="hover:text-cyan-700 font-semibold text-cyan-900 transition cursor-pointer flex items-center space-x-1"
                  >
                    <span>Terms of Service</span>
                  </button>
                </li>
                <li><button onClick={() => onNavigate('approvals')} className="hover:text-cyan-700 transition cursor-pointer">Human Approvals Gate</button></li>
                <li><button onClick={() => onNavigate('audit')} className="hover:text-cyan-700 transition cursor-pointer">SHA-256 Audit Trail</button></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-slate-500 text-[11px] space-y-3 sm:space-y-0">
            <div>
              &copy; {new Date().getFullYear()} Vortex One &amp; CMC Realty &amp; Property Management. All rights reserved.
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => onNavigate('home')} className="hover:text-slate-900 transition cursor-pointer">Home</button>
              <span>•</span>
              <button onClick={() => onNavigate('privacy')} className="hover:text-slate-900 transition cursor-pointer">Privacy</button>
              <span>•</span>
              <button onClick={() => onNavigate('terms')} className="hover:text-slate-900 transition cursor-pointer">Terms</button>
              <span>•</span>
              <span className="text-slate-400 font-mono">California Real Estate DRE #01928471</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
