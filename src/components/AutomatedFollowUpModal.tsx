import React, { useState } from 'react';
import { Bot, X, Sparkles, Bell, CheckCircle2, Mail, Phone, Clock, Sliders, ToggleLeft, ToggleRight, Play, ShieldAlert } from 'lucide-react';
import { LeadRecord } from '../types';
import { useToast } from '../contexts/ToastContext';

interface AutomatedFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: LeadRecord[];
  isGlobalEnabled: boolean;
  onToggleGlobal: (enabled: boolean) => void;
}

interface FollowUpRule {
  id: string;
  name: string;
  triggerType: 'status_change' | 'inactivity' | 'high_score';
  condition: string;
  actionType: 'ai_email' | 'schedule_call' | 'sms_sequence';
  enabled: boolean;
}

export const AutomatedFollowUpModal: React.FC<AutomatedFollowUpModalProps> = ({
  isOpen,
  onClose,
  leads,
  isGlobalEnabled,
  onToggleGlobal,
}) => {
  const { addToast } = useToast();
  const [enabled, setEnabled] = useState(isGlobalEnabled);
  const [rules, setRules] = useState<FollowUpRule[]>([
    {
      id: 'rule-1',
      name: 'Status Change to Contacted',
      triggerType: 'status_change',
      condition: 'When lead moves to Contacted',
      actionType: 'ai_email',
      enabled: true,
    },
    {
      id: 'rule-2',
      name: 'Inactivity Threshold (48 Hours)',
      triggerType: 'inactivity',
      condition: 'No outreach interaction for 48h',
      actionType: 'schedule_call',
      enabled: true,
    },
    {
      id: 'rule-3',
      name: 'High Score Lead Priority',
      triggerType: 'high_score',
      condition: 'Lead Intelligence Score >= 85',
      actionType: 'ai_email',
      enabled: true,
    },
  ]);

  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  if (!isOpen) return null;

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    setSimulationLogs(['[Sub-Agent 2] Scanning lead pipeline for inactivity and status changes...']);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setSimulationLogs((prev) => [
        ...prev,
        '[Sub-Agent 6] Found 3 leads meeting inactivity threshold (>48h). Triggering automated AI outreach...',
      ]);
      await new Promise((r) => setTimeout(r, 900));
      setSimulationLogs((prev) => [
        ...prev,
        '[Sub-Agent 3] Generated personalized acquisition email for Robert Vance (Orange County Portfolio). Sent via SendGrid.',
      ]);
      await new Promise((r) => setTimeout(r, 800));
      setSimulationLogs((prev) => [
        ...prev,
        '[Sub-Agent 5] Scheduled priority broker follow-up call in CRM calendar for Linda Sterling.',
      ]);
      setIsSimulating(false);
      addToast('Automated AI follow-up sweep successfully executed!', 'success');
    } catch (err: any) {
      setIsSimulating(false);
      addToast('Simulation error: ' + err.message, 'error');
    }
  };

  const toggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Autonomous AI Follow-up &amp; Outreach Engine
              </h3>
              <p className="text-xs text-slate-500">
                Configure automated rules for AI email generation and broker call scheduling based on lead status and inactivity.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Master Toggle Banner */}
        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl p-4 flex items-center justify-between shadow-2xs">
          <div className="space-y-0.5">
            <div className="font-bold text-slate-900 text-xs flex items-center space-x-2">
              <span>Master Automated Follow-up Trigger</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                {enabled ? 'Active' : 'Paused'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600">
              When active, background Sub-Agents continuously monitor lead status changes and inactivity thresholds.
            </p>
          </div>
          <button
            onClick={() => {
              const next = !enabled;
              setEnabled(next);
              onToggleGlobal(next);
              addToast(next ? 'Automated Follow-up enabled globally.' : 'Automated Follow-up paused.', 'info');
            }}
            className="cursor-pointer text-cyan-600 hover:text-cyan-700 transition"
          >
            {enabled ? <ToggleRight className="w-10 h-10 text-cyan-600" /> : <ToggleLeft className="w-10 h-10 text-slate-400" />}
          </button>
        </div>

        {/* Rules Config List */}
        <div className="space-y-3">
          <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Configured Trigger Rules</h4>
          <div className="space-y-2.5">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${rule.actionType === 'ai_email' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                    {rule.actionType === 'ai_email' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-slate-900">{rule.name}</div>
                    <div className="text-[11px] text-slate-500">{rule.condition} &rarr; <span className="font-medium text-cyan-700 uppercase">{rule.actionType === 'ai_email' ? 'Send AI Email' : 'Schedule Call'}</span></div>
                  </div>
                </div>

                <button
                  onClick={() => toggleRule(rule.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                    rule.enabled
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                      : 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Simulation / Manual Trigger */}
        <div className="bg-slate-900 rounded-xl p-4 space-y-3 text-slate-200 shadow-inner">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400">
              <Bot className="w-4 h-4" />
              <span>Live Agent Execution Simulator</span>
            </div>
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer inline-flex items-center space-x-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isSimulating ? 'Running Sweep...' : 'Trigger Follow-up Sweep'}</span>
            </button>
          </div>

          <div className="font-mono text-[11px] bg-slate-950 rounded-lg p-3 space-y-1.5 text-emerald-400 min-h-[90px] max-h-[140px] overflow-y-auto">
            {simulationLogs.length === 0 ? (
              <span className="text-slate-500 italic">Click 'Trigger Follow-up Sweep' to test automated AI agent follow-ups across leads...</span>
            ) : (
              simulationLogs.map((log, idx) => (
                <div key={idx} className="flex items-start space-x-2">
                  <span className="text-slate-500">&gt;</span>
                  <span>{log}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
