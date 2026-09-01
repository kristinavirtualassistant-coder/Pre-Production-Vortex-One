import React, { useState } from 'react';
import {
  Sparkles,
  X,
  BrainCircuit,
  Search,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building2,
  Zap,
  Play,
  Layers,
} from 'lucide-react';

interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onSetPrompt: (prompt: string) => void;
}

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSetPrompt,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  if (!isOpen) return null;

  const steps = [
    {
      title: 'Welcome to Vortex One Agent OS',
      subtitle: 'Autonomous Real Estate Intelligence & Property Search',
      description:
        'Vortex One empowers real estate investors, acquisition managers, and property operators with a 10-agent autonomous AI workforce. Let’s take a quick 60-second tour on how to set up your first agent and run a high-equity property search.',
      icon: <Sparkles className="w-8 h-8 text-cyan-600" />,
      badge: 'Step 1 of 4: Welcome',
      highlight: 'Discover high-equity absentee parcels, LLC ownership, and automated outreach in seconds.',
    },
    {
      title: 'Meet Agent 1 & The StudioView',
      subtitle: 'Master Orchestration & Hierarchical Sub-Agents',
      description:
        'In the **StudioView**, Agent 1 acts as your Master Orchestrator. When you enter a natural language objective, Agent 1 decomposes it into a multi-step DAG, delegates tasks to Sub-Agents (0-9) for county cadaster lookups, skip-tracing, and compliance audits.',
      icon: <BrainCircuit className="w-8 h-8 text-cyan-600" />,
      badge: 'Step 2 of 4: Agent Setup & Orchestration',
      highlight: 'No complex coding required—just type your objective in plain English.',
    },
    {
      title: 'Running Your First Property Search',
      subtitle: 'Instant County Assessor & Equity Extraction',
      description:
        'Ready to test it? Click the button below to jump directly into the **StudioView**, where we have pre-loaded a high-value Orange County absentee owner search objective. Click **Run Orchestration** to watch the agents execute live!',
      icon: <Search className="w-8 h-8 text-cyan-600" />,
      badge: 'Step 3 of 4: Run Your First Search',
      highlight: 'Sample Objective: "Find property owners in Orange County who own multiple properties with >$1M equity."',
      isActionStep: true,
    },
    {
      title: 'From Leads to Compliant Outreach',
      subtitle: 'Scoring, Provenance Audit, & Human Approvals',
      description:
        'Once your search completes, review explainable 0-100 lead scores, verify data provenance audit ledgers, and safely dispatch TCPA-compliant cold email or SMS campaigns with human-in-the-loop sign-off.',
      icon: <ShieldCheck className="w-8 h-8 text-cyan-600" />,
      badge: 'Step 4 of 4: Pipeline & CRM Sync',
      highlight: 'Every data point is backed by official county tax rolls and audit ledgers.',
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      localStorage.setItem('vortex_guided_tour_seen', 'true');
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleRunSampleSearchAndClose = () => {
    localStorage.setItem('vortex_guided_tour_seen', 'true');
    onSetPrompt(
      'Find property owners in Orange County who own multiple properties and identify the best prospects for property management.'
    );
    onNavigate('studio');
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem('vortex_guided_tour_seen', 'true');
    onClose();
  };

  const current = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full p-7 space-y-6 shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Top Decorative Gradient Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200">
              {current.badge}
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="Close Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 pt-1">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center shrink-0 shadow-inner">
              {current.icon}
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">{current.title}</h2>
              <p className="text-xs font-semibold text-cyan-700">{current.subtitle}</p>
            </div>
          </div>

          <p className="text-sm text-slate-600 leading-relaxed pt-2">
            {current.description}
          </p>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 font-medium flex items-start space-x-2.5">
            <Sparkles className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
            <span>{current.highlight}</span>
          </div>

          {current.isActionStep && (
            <div className="pt-2">
              <button
                onClick={handleRunSampleSearchAndClose}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xs shadow-md shadow-cyan-600/20 flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <Zap className="w-4 h-4" />
                <span>Launch Studio &amp; Run Sample Search Now</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center space-x-1.5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? 'w-6 bg-cyan-600' : 'w-1.5 bg-slate-200'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center space-x-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition flex items-center space-x-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <span>{currentStep === steps.length - 1 ? 'Get Started' : 'Next'}</span>
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
