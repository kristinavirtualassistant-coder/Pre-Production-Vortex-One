import React, { useState } from 'react';
import { X, UserPlus, Building, Phone, Mail, Sparkles, Tag, ShieldCheck } from 'lucide-react';
import { LeadRecord, AgentId } from '../types';
import { useToast } from '../contexts/ToastContext';

interface CreateLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: (newLead: LeadRecord) => void;
  organizationId?: string;
}

export const CreateLeadModal: React.FC<CreateLeadModalProps> = ({
  isOpen,
  onClose,
  onLeadCreated,
  organizationId = '',
}) => {
  const { addToast } = useToast();
  const [ownerName, setOwnerName] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<LeadRecord['stage']>('identified');
  const [classification, setClassification] = useState<LeadRecord['classification']>('high_priority');
  const [leadScore, setLeadScore] = useState<number>(85);
  const [assignedAgent, setAssignedAgent] = useState<AgentId>('sub_agent_2');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('High Equity, Absentee');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim() || !propertyAddress.trim()) {
      addToast('Owner Name and Property Address are required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const tags = tagInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        organization_id: organizationId,
        owner_name: ownerName.trim(),
        property_address: propertyAddress.trim(),
        phone_number: phoneNumber.trim() || '(949) 555-0199',
        email: email.trim(),
        stage,
        classification,
        lead_score: Number(leadScore),
        assigned_agent: assignedAgent,
        notes: notes.trim(),
        tags: tags.length > 0 ? tags : ['Manual Lead'],
      };

      const res = await fetch('/api/leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create lead');
      }

      const created = await res.json();
      addToast(`Lead "${created.owner_name}" created successfully!`, 'success');
      onLeadCreated(created);
      onClose();
    } catch (err: any) {
      addToast(err.message || 'Failed to create lead', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-xs">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Create New CRM Prospect</h3>
              <p className="text-[11px] text-slate-500">Add a verified property owner into your active sales pipeline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Owner Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Owner / Contact Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Richard & Sarah Sterling"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              />
            </div>

            {/* Property Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Subject Property Address <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                placeholder="e.g. 1724 Newport Blvd, Costa Mesa, CA"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              />
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(949) 555-0144"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@example.com"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
                />
              </div>
            </div>

            {/* Pipeline Stage Choice */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Initial Pipeline Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 cursor-pointer"
              >
                <option value="identified">Identified (Raw Discovery)</option>
                <option value="enriched">Enriched (Skip-Traced)</option>
                <option value="qualified">Qualified (Meets CMC Criteria)</option>
                <option value="outreach_ready">Outreach Ready</option>
                <option value="contacted">Contacted (In Dialogue)</option>
                <option value="meeting_scheduled">Meeting Scheduled</option>
                <option value="won">Won (Contract Signed)</option>
                <option value="lost">Lost / Archived</option>
              </select>
            </div>

            {/* Classification & Priority */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Priority Classification</label>
              <select
                value={classification}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setClassification(val);
                  if (val === 'high_priority') setLeadScore(88);
                  else if (val === 'medium_priority') setLeadScore(70);
                  else if (val === 'nurture') setLeadScore(50);
                  else setLeadScore(30);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 cursor-pointer"
              >
                <option value="high_priority">⭐ High Priority (Score 80+)</option>
                <option value="medium_priority">Medium Priority (60-79)</option>
                <option value="nurture">Nurture Pipeline (40-59)</option>
                <option value="disqualified">Disqualified (&lt;40)</option>
              </select>
            </div>

            {/* Score Number Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Sub-Agent 2 Lead Score</label>
                <span className="text-xs font-bold font-mono text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                  {leadScore}/100
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={leadScore}
                onChange={(e) => setLeadScore(Number(e.target.value))}
                className="w-full accent-cyan-600 cursor-pointer"
              />
            </div>

            {/* Assigned Agent */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Assigned AI Sub-Agent</label>
              <select
                value={assignedAgent}
                onChange={(e) => setAssignedAgent(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 cursor-pointer"
              >
                <option value="sub_agent_2">Sub-Agent 2 (CRM Lead Intelligence)</option>
                <option value="sub_agent_6">Sub-Agent 6 (Outreach &amp; Telephony)</option>
                <option value="sub_agent_5">Sub-Agent 5 (Skip Trace &amp; Enrichment)</option>
                <option value="sub_agent_7">Sub-Agent 7 (Analytics &amp; Underwriting)</option>
                <option value="human_agent">Human Account Executive</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Custom Tags <span className="text-slate-400 font-normal">(comma-separated)</span>
            </label>
            <div className="relative">
              <Tag className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="Absentee, High Equity, 1031 Exchange, Commercial"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
              />
            </div>
          </div>

          {/* Initial Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Initial CRM Notes / Activity Brief</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Owner expressed interest in commercial property management proposal..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 rounded-xl shadow-md shadow-cyan-600/20 transition cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating Lead...' : 'Create Lead'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
