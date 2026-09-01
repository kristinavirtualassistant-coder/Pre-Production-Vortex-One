import React from 'react';
import {
  FileText,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  Building2,
  AlertTriangle,
  Scale,
  Lock,
  Printer,
  ExternalLink,
  Layers,
} from 'lucide-react';

interface TermsOfServiceViewProps {
  onNavigate: (view: string) => void;
}

export const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({ onNavigate }) => {
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
          <span className="text-xs font-bold text-slate-900">Terms of Service</span>
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
            onClick={() => onNavigate('privacy')}
            className="flex items-center space-x-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 border border-cyan-200 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <span>View Privacy Policy</span>
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
              <Scale className="w-4 h-4" />
              <span>VORTEX ONE ENTERPRISE TERMS &amp; CONDITIONS</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
              Terms of Service &amp; Operating Agreement
            </h1>
            <p className="text-xs text-slate-500 mt-2 font-mono">
              Effective Date: August 30, 2026 • Last Reviewed: August 2026 • Version 1.0.4
            </p>
          </div>

          {/* Quick Summary Highlights Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-2">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-700" />
              <span>Key Operating Commitments</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Permitted Real Estate Use:</strong> Vortex One is licensed exclusively for legitimate commercial, multifamily, and residential real estate research, underwriting, and compliant acquisitions.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>AI Assistive Disclaimer:</strong> AI-generated valuations, pitch briefs, and underwriting models are analytical aids; all binding contracts and fiduciary decisions require licensed human evaluation.</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Strict Telecommunications Governance:</strong> Users agree to comply with all federal TCPA, TSR, state dialing laws, and the National Do-Not-Call Registry.</span>
              </li>
            </ul>
          </div>

          {/* Section 1: Acceptance */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              1. Acceptance of Terms &amp; Authority
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              By accessing, deploying, or utilizing the Vortex One Multi-Agent Intelligence software platform, related APIs, Cloud SQL databases, and sub-agent dispatch consoles (collectively, the "Platform"), you agree to be bound by these Terms of Service. If you represent an enterprise organization (such as a brokerage, investment fund, or property management entity), you represent that you possess the requisite authority to bind that entity.
            </p>
          </section>

          {/* Section 2: Platform Description */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              2. Description of the Multi-Agent Platform
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Vortex One provides autonomous multi-agent orchestration for real estate property research, GIS cadastral analysis, owner entity discovery, automated underwriting modeling, CRM lead management, and multi-channel outreach assistance. The Platform coordinates 10 specialized sub-agents through a Directed Acyclic Graph (DAG) architecture.
            </p>
          </section>

          {/* Section 3: Public Records & Assessor Data Use */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              3. Permitted Use of Public County Assessor Data
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              Vortex One interfaces with public county assessor records and municipal ArcGIS REST services. Users agree to:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 pl-2">
              <li>Use property records solely for lawful real estate investment, asset management, and brokerage activities.</li>
              <li>Refrain from attempting to circumvent rate limits, technical access controls, or CAPTCHA mechanisms on municipal portals.</li>
              <li>Respect the intellectual property and fair-use conditions established by respective county and state jurisdictions.</li>
            </ul>
          </section>

          {/* Section 4: Telecommunications & Outreach Rules */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              4. Telecommunications, Dialer &amp; TCPA Compliance
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              The Platform includes outbound dialer management and outreach brief generation. When initiating communications:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-slate-700 pl-2">
              <li><strong>TCPA Adherence:</strong> You are solely responsible for ensuring that all calls, SMS, and direct communications comply with the Telephone Consumer Protection Act (47 U.S.C. § 227) and Telemarketing Sales Rule (16 C.F.R. Part 310).</li>
              <li><strong>Suppression Enforcement:</strong> You must respect all suppression lists and immediately honor consumer requests to be placed on internal Do-Not-Call registries.</li>
              <li><strong>Human Gate:</strong> You agree not to bypass the Human Approvals Console for automated bulk voice or SMS broadcasts.</li>
            </ul>
          </section>

          {/* Section 5: AI Output & Advisory Disclaimer */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              5. Artificial Intelligence Disclaimer &amp; No Legal/Appraisal Advice
            </h2>
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs sm:text-sm text-amber-900 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>IMPORTANT REAL ESTATE &amp; APPRAISAL ADVISORY</span>
              </div>
              <p className="leading-relaxed">
                Vortex One outputs (including automated valuations, equity estimates, distress scores, and generated outreach letters) are produced by algorithmic and generative AI models. <strong>They do NOT constitute certified real estate appraisals, formal title guarantees, legal counsel, or financial advice.</strong>
              </p>
              <p className="leading-relaxed">
                All acquisitions, financial commitments, title examinations, and binding contracts must be reviewed by licensed real estate brokers, attorneys, and certified appraisers.
              </p>
            </div>
          </section>

          {/* Section 6: Limitation of Liability */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              6. Limitation of Liability &amp; Disclaimers
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, VORTEX ONE DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL VORTEX ONE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES ARISING FROM THE USE OF THE PLATFORM OR INACCURACIES IN PUBLIC COUNTY ASSESSOR ROLLS.
            </p>
          </section>

          {/* Section 7: Governing Law & Jurisdiction */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2">
              7. Governing Law &amp; Dispute Resolution
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the <strong>State of California</strong>, without regard to conflict of law principles. Any legal action or proceeding arising under these Terms shall be brought exclusively in the state or federal courts located in <strong>Orange County, California</strong>.
            </p>
          </section>

          {/* Section 8: Contact Information */}
          <section className="space-y-3 border-t border-slate-200 pt-6">
            <h2 className="text-lg font-bold text-slate-900">
              8. Legal Contact &amp; Notices
            </h2>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
              For legal inquiries, terms interpretation, or compliance notifications:
            </p>
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-900">Vortex One • Legal & Regulatory Division</p>
              <p className="text-slate-600">Attn: General Counsel</p>
              <p className="text-slate-600">Email: <a href="mailto:legal@vortexone.ai" className="text-cyan-700 font-semibold hover:underline">legal@vortexone.ai</a></p>
              <p className="text-slate-600">Orange County, California</p>
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
              <button onClick={() => onNavigate('privacy')} className="text-cyan-700 hover:underline font-semibold cursor-pointer">Privacy Policy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
