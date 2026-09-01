import React, { useState } from 'react';
import { X, Sliders, Sparkles, ShieldCheck, Check, RefreshCw, Layers, Zap } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface CrmOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCustomScoring?: (weights: { absentee: number; equity: number; units: number; delinquency: number }) => Promise<void>;
  defaultViewMode: 'table' | 'kanban' | 'cards' | 'analytics';
  onSaveDefaultViewMode: (mode: 'table' | 'kanban' | 'cards' | 'analytics') => void;
}

export const CrmOptionsModal: React.FC<CrmOptionsModalProps> = ({
  isOpen,
  onClose,
  onApplyCustomScoring,
  defaultViewMode,
  onSaveDefaultViewMode,
}) => {
  const { addToast } = useToast();
  const [absenteeWeight, setAbsenteeWeight] = useState(25);
  const [equityWeight, setEquityWeight] = useState(30);
  const [unitsWeight, setUnitsWeight] = useState(20);
  const [delinquencyWeight, setDelinquencyWeight] = useState(20);

  const [autoAdvanceStageOnCall, setAutoAdvanceStageOnCall] = useState(true);
  const [strictTcpaScrub, setStrictTcpaScrub] = useState(true);
  const [highPriorityThreshold, setHighPriorityThreshold] = useState(80);
  const [selectedDefaultView, setSelectedDefaultView] = useState(defaultViewMode);
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  const totalScoreWeight = absenteeWeight + equityWeight + unitsWeight + delinquencyWeight;

  const handleApplyRules = async () => {
    setIsApplying(true);
    try {
      if (onApplyCustomScoring) {
        await onApplyCustomScoring({
          absentee: absenteeWeight,
          equity: equityWeight,
          units: unitsWeight,
          delinquency: delinquencyWeight,
        });
      }
      onSaveDefaultViewMode(selectedDefaultView);
      addToast('CRM Hub scoring rules and preferences saved successfully!', 'success');
      onClose();
    } catch (err: any) {
      addToast(err.message || 'Failed to apply scoring rules', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  const handleResetDefaults = () => {
    setAbsenteeWeight(25);
    setEquityWeight(30);
    setUnitsWeight(20);
    setDelinquencyWeight(20);
    setHighPriorityThreshold(80);
    setAutoAdvanceStageOnCall(true);
    setStrictTcpaScrub(true);
    addToast('Scoring weights reset to CMC Realty default baseline.', 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-xs">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">CRM Hub Options &amp; Intelligence Choices</h3>
              <p className="text-[11px] text-slate-500">Configure Sub-Agent 2 lead scoring weights, pipeline automations, and view presets</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          {/* Section 1: Sub-Agent 2 Lead Scoring Weights */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Explainable Lead Scoring Model Weights</span>
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Customize the impact of each property attribute when calculating prospect scores (0–100)
                </p>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                totalScoreWeight <= 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
                Total: {totalScoreWeight} pts
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              {/* Absentee Landlord Weight */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Absentee Landlord</span>
                  <span className="font-mono font-bold text-cyan-700">+{absenteeWeight} pts</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  value={absenteeWeight}
                  onChange={(e) => setAbsenteeWeight(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 leading-tight">Bonus for non-owner occupied properties</p>
              </div>

              {/* High Equity Weight */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Substantial Equity (&gt;50%)</span>
                  <span className="font-mono font-bold text-cyan-700">+{equityWeight} pts</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={50}
                  value={equityWeight}
                  onChange={(e) => setEquityWeight(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 leading-tight">Bonus for high equity ratio vs mortgage balance</p>
              </div>

              {/* Multi-Unit Scale Weight */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Multi-Unit Scale</span>
                  <span className="font-mono font-bold text-cyan-700">+{unitsWeight} pts</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  value={unitsWeight}
                  onChange={(e) => setUnitsWeight(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 leading-tight">Bonus for 2-4 unit &amp; commercial apartment parcels</p>
              </div>

              {/* Tax Delinquency Weight */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Tax Delinquency Indicator</span>
                  <span className="font-mono font-bold text-cyan-700">+{delinquencyWeight} pts</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={35}
                  value={delinquencyWeight}
                  onChange={(e) => setDelinquencyWeight(Number(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 leading-tight">Bonus for motivated owners with delinquent tax rolls</p>
              </div>
            </div>
          </div>

          {/* Section 2: Pipeline Stage Automations */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>CRM Workflow Automations</span>
            </h4>

            <div className="space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-cyan-300 transition">
                <div className="pr-4">
                  <div className="text-xs font-bold text-slate-800">Auto-Advance Stage to "Contacted" on Dial</div>
                  <div className="text-[11px] text-slate-500">Automatically transitions lead stage when a live dialer session is placed</div>
                </div>
                <input
                  type="checkbox"
                  checked={autoAdvanceStageOnCall}
                  onChange={(e) => setAutoAdvanceStageOnCall(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 cursor-pointer hover:border-cyan-300 transition">
                <div className="pr-4">
                  <div className="text-xs font-bold text-slate-800">Strict TCPA &amp; DNC Pre-Dial Scrub</div>
                  <div className="text-[11px] text-slate-500">Blocks automated dialer queue placement for phone numbers flagged on national DNC</div>
                </div>
                <input
                  type="checkbox"
                  checked={strictTcpaScrub}
                  onChange={(e) => setStrictTcpaScrub(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 rounded border-slate-300 focus:ring-cyan-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Section 3: Default CRM View Mode */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>Default CRM View Layout Choice</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'table', label: 'Table Grid', desc: 'Dense sorting & bulk action rows' },
                { id: 'kanban', label: 'Kanban Board', desc: '8-stage visual pipeline funnel' },
                { id: 'cards', label: 'Prospect Cards', desc: 'Visual cards with equity & dials' },
                { id: 'analytics', label: 'Analytics Hub', desc: 'Conversion charts & metrics' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedDefaultView(m.id as any)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    selectedDefaultView === m.id
                      ? 'bg-cyan-50/80 border-cyan-500 text-cyan-900 ring-1 ring-cyan-500/20'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold">{m.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
          >
            Reset Defaults
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyRules}
              disabled={isApplying}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-xl shadow-md shadow-cyan-600/20 transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
            >
              {isApplying ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Re-scoring Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Save &amp; Re-Score Pipeline</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
