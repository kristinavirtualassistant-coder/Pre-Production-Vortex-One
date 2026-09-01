import React, { useState } from 'react';
import {
  UserPlus,
  Bot,
  Sparkles,
  CheckCircle2,
  Wrench,
  Shield,
  Layers,
  Zap,
} from 'lucide-react';
import { AgentDefinition } from '../types';

interface AgentBuilderViewProps {
  onRegisterAgent: (agent: AgentDefinition) => Promise<any>;
}

export const AgentBuilderView: React.FC<AgentBuilderViewProps> = ({ onRegisterAgent }) => {
  const [agentId, setAgentId] = useState('sub_agent_10');
  const [name, setName] = useState('Commercial Lease Specialist');
  const [role, setRole] = useState('custom');
  const [description, setDescription] = useState('Specialist in analyzing commercial triple-net (NNN) leases and lease rollover schedules.');
  const [responsibility, setResponsibility] = useState('Extract lease expiration dates, calculate escalation clauses, and audit tenant credit.');
  const [instructions, setInstructions] = useState('You are Sub-Agent 10 (Commercial Lease Specialist). Analyze lease agreements and retain provenance.');
  const [model, setModel] = useState('gemini-3.5-flash');
  const [isRegistering, setIsRegistering] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    setSuccessMsg(null);

    const newAgent: AgentDefinition = {
      id: agentId as any,
      name,
      role: role as any,
      description,
      primaryResponsibility: responsibility,
      systemInstructions: instructions,
      allowedTools: ['search_property', 'analyze_data'],
      allowedData: ['properties', 'commercial_leases'],
      model,
      temperature: 0.1,
      permissions: ['read_only', 'lease_analysis'],
      parentAgentId: 'agent_1',
      enabled: true,
      capabilities: ['commercial_leases', 'nnn_analysis', 'lease_rollover'],
      avatarIcon: 'Bot',
    };

    try {
      await onRegisterAgent(newAgent);
      setSuccessMsg(`Successfully registered ${newAgent.name} (${newAgent.id}) in the central agent registry!`);
    } catch (err: any) {
      console.error('Registration error:', err);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/10">
          <UserPlus className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Dynamic Agent Registration Studio</h1>
          <p className="text-xs text-slate-500">
            Register new sub-agents (Sub-Agent 10+) to expand the multi-agent capability map at runtime without redeploying.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center space-x-2 text-xs text-emerald-800 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-700 mb-1">Agent Identifier (ID)</label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-700 mb-1">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-700 mb-1">Domain Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
            >
              <option value="custom">Custom Specialist</option>
              <option value="property">Property Domain</option>
              <option value="crm_lead">CRM &amp; Lead</option>
              <option value="research">Market Research</option>
              <option value="analytics">Analytics &amp; Math</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase text-slate-700 mb-1">Gemini AI Model</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 font-mono"
            >
              <option value="gemini-3.5-flash">gemini-3.5-flash (Fast &amp; Accurate)</option>
              <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex Reasoning)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra-Low Latency)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase text-slate-700 mb-1">General Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase text-slate-700 mb-1">Primary Responsibility</label>
          <input
            type="text"
            value={responsibility}
            onChange={(e) => setResponsibility(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold uppercase text-slate-700 mb-1">System Instructions / Prompt</label>
          <textarea
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-cyan-900 font-mono focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 resize-none"
            required
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isRegistering}
            className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold text-xs px-6 py-2.5 rounded-lg transition shadow-xs cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register &amp; Attach to Master Agent 1</span>
          </button>
        </div>
      </form>
    </div>
  );
};
