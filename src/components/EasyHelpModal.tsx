import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  BookOpen,
  Sparkles,
  Search,
  Building2,
  Users,
  Mail,
  ShieldCheck,
  CheckCircle2,
  Bot,
  BrainCircuit,
  Database,
  ArrowRight,
  Lightbulb,
  PhoneCall,
  Lock,
  Layers,
  ChevronRight,
  Award,
} from 'lucide-react';

interface EasyHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

export const EasyHelpModal: React.FC<EasyHelpModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'workflow' | 'glossary' | 'agents' | 'faq'>('workflow');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const glossaryTerms = [
    {
      term: 'APN (Assessor Parcel Number)',
      category: 'Real Estate Data',
      simple: 'The government ID number for a piece of real estate, like a Social Security Number for land.',
      detail:
        'Every county tax assessor assigns a unique APN to every parcel of land (e.g. 119-241-08 in Orange County). Vortex One uses this to retrieve official public tax records, lot sizes, and assessed values.',
    },
    {
      term: 'Absentee Owner',
      category: 'Lead Qualification',
      simple: 'A landlord who owns a property but does not live there (their mailing address is different).',
      detail:
        'Absentee owners are prime real estate prospects because they often need professional property management or are open to selling off-market investment assets.',
    },
    {
      term: 'Lead Score (0 to 100)',
      category: 'AI Scoring',
      simple: 'A rating of how likely a property owner is to do business with you.',
      detail:
        'Calculated from estimated equity (higher is better), absentee ownership, property age, unit count, and tax history. Scores 80+ are classified as High Priority.',
    },
    {
      term: 'Assessed Value vs. Market Value',
      category: 'Real Estate Data',
      simple: 'Assessed value is for county property taxes; Market value is what buyers would pay today.',
      detail:
        'Under California Proposition 13, assessed values rise slowly each year, so a property assessed at $800k might actually be worth $2.4M on the open market, creating high hidden equity.',
    },
    {
      term: 'Estimated Equity',
      category: 'Financials',
      simple: 'How much the property is worth minus estimated mortgages and liens.',
      detail:
        'High equity (>60% or >$500k) gives owners financial flexibility to sell, refinance, or hire full-service property managers without tight cash flow constraints.',
    },
    {
      term: 'Human-in-the-Loop (Approvals)',
      category: 'Safety & AI Governance',
      simple: 'A safety brake: AI prepares actions, but a human must click "Approve" before sending.',
      detail:
        'Vortex One will never send cold emails, text messages, or trigger bulk phone dialers without your explicit manual review and sign-off in the Approvals Center.',
    },
    {
      term: 'TCPA & DNC Compliance',
      category: 'Legal & Compliance',
      simple: 'Federal telemarketing rules and "Do Not Call" list checks to keep outreach 100% legal.',
      detail:
        'Sub-Agent 7 checks every prospect phone number and email against suppression lists and time-of-day calling rules before drafting outreach campaigns.',
    },
    {
      term: 'Merge Variables (e.g. {{owner_name}})',
      category: 'Outreach Templates',
      simple: 'Smart placeholders that automatically fill in real owner and property details.',
      detail:
        'When you send an email or SMS, tokens like {{property_address}} or {{assessed_value}} are dynamically replaced with verified county records.',
    },
    {
      term: 'Audit Ledger / Provenance',
      category: 'Audit & Transparency',
      simple: 'An unchangeable flight recorder showing every action, calculation, and data source.',
      detail:
        'Vortex One logs every query, API response, and sub-agent decision with cryptographic provenance hashes so you can always verify where data came from.',
    },
  ];

  const subAgents = [
    {
      id: 'Agent 1',
      name: 'Master Orchestrator',
      role: 'The Team Conductor',
      description: 'Takes your high-level goal, breaks it into smaller tasks, assigns them to specialized sub-agents, and gives you the final answer.',
    },
    {
      id: 'Sub-Agent 0',
      name: 'Data Ingestion & Normalizer',
      role: 'The Data Cleaner',
      description: 'Cleans, standardizes, and parses county records, addresses, and parcel files into neat database tables.',
    },
    {
      id: 'Sub-Agent 1',
      name: 'Property & Spatial Intelligence',
      role: 'The Real Estate Detective',
      description: 'Searches California and Orange County assessor records to find parcel boundaries, zoning, unit counts, and assessed values.',
    },
    {
      id: 'Sub-Agent 2',
      name: 'Lead Scoring & Qualification',
      role: 'The Deal Evaluator',
      description: 'Calculates the 0–100 lead score based on equity, absentee status, and portfolio size so you only contact the best prospects.',
    },
    {
      id: 'Sub-Agent 3',
      name: 'Dialer Strategy & Campaign Planner',
      role: 'The Campaign Strategist',
      description: 'Plans phone and SMS campaigns, scheduling batches at optimal call times.',
    },
    {
      id: 'Sub-Agent 4',
      name: 'Enrichment & Entity Resolution',
      role: 'The Contact Finder',
      description: 'Discovers LLC owners, corporate officers, phone numbers, and mailing addresses for property owners.',
    },
    {
      id: 'Sub-Agent 5',
      name: 'Omnichannel Outreach & Content',
      role: 'The Message Writer',
      description: 'Writes highly personalized email, SMS, and cold-call scripts using verified property data and merge tags.',
    },
    {
      id: 'Sub-Agent 6',
      name: 'Real-Time Voice Assistant',
      role: 'The Audio Producer',
      description: 'Generates natural-sounding voice call briefings and audio overviews for operators before calling owners.',
    },
    {
      id: 'Sub-Agent 7',
      name: 'Compliance & Risk Gatekeeper',
      role: 'The Safety Guard',
      description: 'Checks phone numbers against Do-Not-Call (DNC) lists and enforces human approval requirements.',
    },
    {
      id: 'Sub-Agent 8',
      name: 'Continuous Self-Improvement',
      role: 'The Quality Coach',
      description: 'Analyzes call outcomes, conversion rates, and response metrics to suggest smarter outreach tweaks.',
    },
    {
      id: 'Sub-Agent 9',
      name: 'Independent QA & Audit',
      role: 'The Fact Checker',
      description: 'Independently audits all calculations, checks data sources, and prevents AI hallucinations before output is shown.',
    },
  ];

  const faqs = [
    {
      q: 'How do I find real properties?',
      a: 'Go to "Property Intelligence" from the sidebar. You can search by City (e.g. Newport Beach, Irvine), APN parcel number, Street Address, or Owner Name. Vortex One queries official public records from California counties.',
    },
    {
      q: 'How does a property become a lead?',
      a: 'When you view any property in Property Intelligence, click the "Promote to Lead" or "Create Lead" button. Sub-Agent 2 will automatically calculate a Lead Score (0–100) and place it into your Leads & CRM Hub.',
    },
    {
      q: 'Will the AI send messages to owners without asking me?',
      a: 'No! Vortex One has a strict Human-in-the-Loop policy. When an outreach campaign is created, it goes to the "Human Approvals" tab. You can review the exact text, edit it, approve it, or reject it before anything is dispatched.',
    },
    {
      q: 'What is the fastest way to get started?',
      a: 'Follow the 4-step workflow: 1) Search a property in Property Intelligence, 2) View its score in Leads, 3) Select an Outreach Template in Multi-Agent Studio, and 4) Review and approve it in Human Approvals.',
    },
  ];

  const filteredGlossary = glossaryTerms.filter(
    (item) =>
      item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.simple.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-cyan-900 to-blue-950 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight">Vortex One Easy Guide &amp; Jargon Buster</h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">
                  Plain English
                </span>
              </div>
              <p className="text-xs text-cyan-100/80">
                Learn how Vortex One finds real properties, scores leads, and automates outreach safely.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('workflow')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'workflow'
                ? 'border-cyan-600 text-cyan-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-600" />
            <span>4-Step Acquisition Loop</span>
          </button>

          <button
            onClick={() => setActiveTab('glossary')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'glossary'
                ? 'border-cyan-600 text-cyan-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Real Estate Jargon Buster ({glossaryTerms.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'agents'
                ? 'border-cyan-600 text-cyan-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bot className="w-4 h-4 text-purple-600" />
            <span>Sub-Agents Explained (0–9)</span>
          </button>

          <button
            onClick={() => setActiveTab('faq')}
            className={`py-3 px-4 border-b-2 transition flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'faq'
                ? 'border-cyan-600 text-cyan-800 font-bold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <span>Frequently Asked Questions</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-slate-50/50 text-slate-800 text-xs">
          {/* TAB 1: 4-Step Acquisition Loop */}
          {activeTab === 'workflow' && (
            <div className="space-y-6">
              <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 text-cyan-900 flex items-start space-x-3">
                <Lightbulb className="w-5 h-5 text-cyan-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-cyan-950">How Vortex One Works in 60 Seconds</h4>
                  <p className="text-xs text-cyan-800 mt-1 leading-relaxed">
                    Vortex One is designed like a digital acquisitions team. You find real public property records, the AI automatically evaluates and scores the owner, drafts compliant outreach messages, and waits for your green light before taking action.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Step 1 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-cyan-400 transition">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                        1
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Search &amp; Discovery
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>Search Real Properties</span>
                    </h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Search public records across California and Orange County. Enter an address, city, APN, or owner name. View official parcel data, unit counts, assessed values, and estimated equity.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('properties');
                    }}
                    className="mt-4 w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-lg border border-blue-200 flex items-center justify-center space-x-1 transition cursor-pointer"
                  >
                    <span>Go to Property Search</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Step 2 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-emerald-400 transition">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                        2
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        AI Scoring
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <span>Score &amp; Qualify Leads</span>
                    </h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Sub-Agent 2 automatically analyzes equity, absentee status, and tax history to give each property a Lead Score from 0 to 100. Focus your time only on high-scoring prospects (80+).
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('leads');
                    }}
                    className="mt-4 w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg border border-emerald-200 flex items-center justify-center space-x-1 transition cursor-pointer"
                  >
                    <span>View Lead Pipeline</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Step 3 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-cyan-400 transition">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-lg bg-cyan-100 text-cyan-700 font-bold text-xs flex items-center justify-center">
                        3
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Outreach Dispatch
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                      <Mail className="w-4 h-4 text-cyan-600" />
                      <span>Draft Compliant Outreach</span>
                    </h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Choose from battle-tested Email, SMS, or Cold-Call scripts. Dynamic merge tokens instantly customize messages with real assessor data, while Sub-Agent 7 verifies Do-Not-Call compliance.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('studio');
                    }}
                    className="mt-4 w-full py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 font-semibold rounded-lg border border-cyan-200 flex items-center justify-center space-x-1 transition cursor-pointer"
                  >
                    <span>Open Outreach Templates</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Step 4 */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-amber-400 transition">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">
                        4
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Safety Sign-off
                      </span>
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span>Review &amp; Human Approval</span>
                    </h3>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      You are always in control. Review prepared emails, SMS batches, or phone lists. Click "Approve", "Edit", or "Reject" before anything leaves the platform.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onNavigate('approvals');
                    }}
                    className="mt-4 w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-lg border border-amber-200 flex items-center justify-center space-x-1 transition cursor-pointer"
                  >
                    <span>Open Approvals Center</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Jargon Buster */}
          {activeTab === 'glossary' && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search real estate or system terms (e.g. APN, Equity, Absentee)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredGlossary.map((item, idx) => (
                  <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{item.term}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-cyan-900 font-medium bg-cyan-50/70 p-2 rounded-md border border-cyan-100">
                      💡 {item.simple}
                    </p>
                    <p className="text-[11px] text-slate-500 leading-relaxed pt-1">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Sub-Agents 0 to 9 */}
          {activeTab === 'agents' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Vortex One uses 10 specialized AI sub-agents working together in a strict hierarchy. Here is what each agent does in plain English:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {subAgents.map((ag) => (
                  <div key={ag.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs space-y-1 hover:border-slate-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-[11px] text-cyan-800 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded">
                          {ag.id}
                        </span>
                        <span className="font-bold text-xs text-slate-900">{ag.name}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                        {ag.role}
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed pt-1">{ag.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Frequently Asked Questions */}
          {activeTab === 'faq' && (
            <div className="space-y-3">
              {faqs.map((faq, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-1.5">
                  <h4 className="font-bold text-xs text-slate-900 flex items-center space-x-2">
                    <HelpCircle className="w-4 h-4 text-cyan-600 shrink-0" />
                    <span>{faq.q}</span>
                  </h4>
                  <p className="text-slate-600 text-xs leading-relaxed pl-6">{faq.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500">
          <span>Need more help? Click any screen's helper banner or ask the Master Orchestrator in Studio.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold transition cursor-pointer"
          >
            Got It, Let's Start
          </button>
        </div>
      </div>
    </div>
  );
};
