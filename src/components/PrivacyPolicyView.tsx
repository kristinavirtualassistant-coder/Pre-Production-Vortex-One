import React from 'react';
import {
  ShieldCheck,
  Lock,
  FileText,
  ArrowLeft,
  CheckCircle2,
  Building2,
  PhoneCall,
  BrainCircuit,
  Database,
  Printer,
  ExternalLink,
  Layers,
} from 'lucide-react';

interface PrivacyPolicyViewProps {
  onNavigate: (view: string) => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onNavigate }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Breadcrumb & Action Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center space-x-1 text-xs font-semibold text-slate-600 hover:text-cyan-700 transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-bold text-slate-900">Privacy Policy</span>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Document</span>
          </button>

          <button
            onClick={() => onNavigate('terms')}
            className="flex items-center space-x-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <span>View Terms of Service</span>
            <ExternalLink className="w-3 h-3 text-cyan-600" />
          </button>
        </div>
      </div>

      {/* Main Legal Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-xs space-y-8">
          {/* Header */}
          <div className="border-b border-slate-200 pb-6">
            <div className="flex items-center space-x-2 text-cyan-700 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>VORTEX ONE ENTERPRISE LEGAL &amp; GOVERNANCE</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Privacy Policy &amp; Public Records Compliance
            </h1>
            <p className="text-xs text-slate-500 mt-2 font-mono">
              Effective Date: August 30, 2026 • Last Reviewed: August 2026 • Version 1.0.4
            </p>
          </div>

          {/* Quick Summary Highlights Box */}
          <div className="bg-cyan-50/70 border border-cyan-200 rounded-xl p-5 space-y-2">
            <h3 className="text-xs font-bold text-cyan-950 uppercase tracking-wider flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-700" />
              <span>Executive Privacy Highlights</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-cyan-900 leading-relaxed">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-700 shrink-0 mt-0.5" />
                <span><strong>Public Assessor Records:</strong> Vortex One ingests official public real estate records and GIS parcel rolls in strict compliance with the California Public Records Act.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-700 shrink-0 mt-0.5" />
                <span><strong>Zero AI Training Retention:</strong> Data processed through Google Gemini enterprise models is NEVER used to train generalized foundation models.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-700 shrink-0 mt-0.5" />
                <span><strong>TCPA &amp; DNC Compliance:</strong> All outreach numbers are scrubbed against federal/state Do-Not-Call registries with automated suppression lists.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-700 shrink-0 mt-0.5" />
                <span><strong>Cryptographic Provenance:</strong> Ingested data is recorded in Cloud SQL PostgreSQL with SHA-256 tamper-evident provenance hashes.</span>
              </li>
            </ul>
          </div>

          {/* Section 1: Overview */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              1. Overview and Scope
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              This Privacy Policy applies to the Vortex One Multi-Agent Intelligence platform, operated on behalf of CMC Realty &amp; Property Management ("we", "us", or "our"). It governs how we collect, process, store, and safeguard data when you use our autonomous real estate intelligence software, APIs, multi-agent dispatch pipelines, and integrated telephony systems.
            </p>
          </section>

          {/* Section 2: Data Sources & Public Records */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              2. Data Sources &amp; Public Records Ingestion
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Vortex One retrieves property and cadastral information from legitimate, documented, and publicly accessible government repositories, including:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-xs">
                <strong className="text-slate-900 block mb-1">County Assessor Rolls</strong>
                <p className="text-slate-600">Assessor's Parcel Numbers (APNs), ad-valorem tax valuations, land use classifications, building square footage, and year built from Orange County, Los Angeles County, San Diego County, and other municipal assessors.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg text-xs">
                <strong className="text-slate-900 block mb-1">ArcGIS REST GIS Feeds</strong>
                <p className="text-slate-600">Geospatial parcel boundary coordinates, situs physical addresses, zoning polygons, and municipal boundary layers retrieved directly from public MapServers.</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mt-2">
              Vortex One never bypasses CAPTCHAs, access controls, rate limits, or robot exclusion standards. All data retrieval adheres strictly to open public record guidelines.
            </p>
          </section>

          {/* Section 3: AI Processing & Google Gemini */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              3. Artificial Intelligence &amp; Multi-Agent Processing
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Our autonomous agent fleet operates via server-side secure proxies utilizing Google Gemini enterprise APIs. In accordance with Google Cloud and Vertex AI security policies:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 pl-2">
              <li>Customer prompts, property records, and owner intelligence are strictly ephemeral during execution.</li>
              <li>Customer data is <strong>never</strong> used to train or fine-tune public foundation models.</li>
              <li>Calculations and claims are verified by Sub-Agent 9 (Hallucination QA) before presentation.</li>
            </ul>
          </section>

          {/* Section 4: TCPA, DNC & Communications Compliance */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              4. Telecommunications &amp; TCPA / DNC Compliance
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Vortex One enforces rigorous protections regarding telecommunications and owner outreach in accordance with the Telephone Consumer Protection Act (47 U.S.C. § 227) and Federal Trade Commission (FTC) regulations:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 pl-2">
              <li><strong>Do-Not-Call Registry Scrubbing:</strong> Phone numbers are checked against national, state, and internal suppression lists prior to campaign generation.</li>
              <li><strong>Mandatory Human Approvals:</strong> Voice dialer and SMS campaigns cannot be executed without human operator sign-off in the Approvals Console.</li>
              <li><strong>Immediate Opt-Out Processing:</strong> Any contact requesting suppression is permanently added to the system-wide exclusion database.</li>
            </ul>
          </section>

          {/* Section 5: Data Security & Cloud SQL Persistence */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              5. Data Security, Cloud SQL &amp; Cryptographic Provenance
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              We implement enterprise security controls to protect information stored in Vortex One:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 pl-2">
              <li><strong>Relational Encryption:</strong> Cloud SQL PostgreSQL databases are encrypted at rest with AES-256 and in transit via TLS 1.3.</li>
              <li><strong>SHA-256 Audit Ledger:</strong> Every data ingest, enrichment step, and workflow execution receives an immutable cryptographic hash.</li>
              <li><strong>Role-Based Access Controls (RBAC):</strong> Access to confidential owner intelligence and skip-trace contacts is restricted to authorized operations personnel.</li>
            </ul>
          </section>

          {/* Section 6: California Consumer Privacy Rights (CCPA / CPRA) */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              6. California Consumer Privacy Rights (CCPA / CPRA)
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              If you are a California resident, you possess rights under the California Consumer Privacy Act (CCPA) and the California Privacy Rights Act (CPRA), including:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 pl-2">
              <li><strong>Right to Know:</strong> Request disclosure of the categories and specific pieces of personal information collected about you.</li>
              <li><strong>Right to Delete:</strong> Request deletion of personal information, subject to legal recordkeeping exemptions for real estate transactions.</li>
              <li><strong>Right to Opt-Out:</strong> Opt-out of any prospective sale or sharing of personal information (note: Vortex One does NOT sell personal data to data brokers).</li>
              <li><strong>Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights.</li>
            </ul>
          </section>

          {/* Section 7: Contact Information */}
          <section className="space-y-3 border-t border-slate-200 pt-6">
            <h2 className="text-lg font-bold text-slate-900">
              7. Privacy Officer Contact &amp; Inquiries
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              To submit a data access request, exercise CCPA/CPRA rights, or inquire regarding our public record ingestion practices, please contact our Compliance &amp; Privacy Office:
            </p>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-900">Vortex One • Compliance Division</p>
              <p className="text-slate-600">Attn: Privacy &amp; Governance Officer</p>
              <p className="text-slate-600">Email: <a href="mailto:privacy@vortexone.ai" className="text-cyan-700 font-semibold hover:underline">privacy@vortexone.ai</a></p>
              <p className="text-slate-600">Operating Address: Orange County, California</p>
            </div>
          </section>

          {/* Footer inside modal */}
          <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <span>&copy; {new Date().getFullYear()} Vortex One. All legal rights reserved.</span>
            <div className="flex items-center space-x-3">
              <button onClick={() => onNavigate('home')} className="text-cyan-700 hover:underline font-semibold cursor-pointer">Home</button>
              <span>•</span>
              <button onClick={() => onNavigate('dashboard')} className="text-cyan-700 hover:underline font-semibold cursor-pointer">Command Center</button>
              <span>•</span>
              <button onClick={() => onNavigate('terms')} className="text-cyan-700 hover:underline font-semibold cursor-pointer">Terms of Service</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
