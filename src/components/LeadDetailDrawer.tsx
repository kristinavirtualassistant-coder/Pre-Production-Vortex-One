import React, { useState } from 'react';
import {
  X,
  Sparkles,
  PhoneCall,
  Mail,
  Building,
  Calendar,
  Tag,
  TrendingUp,
  Clock,
  Send,
  UserCheck,
  CheckCircle2,
  FileText,
  Trash2,
  Edit3,
  ExternalLink,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { LeadRecord, AgentId } from '../types';
import { useToast } from '../contexts/ToastContext';

interface LeadDetailDrawerProps {
  lead: LeadRecord;
  onClose: () => void;
  onUpdateLead: (updated: LeadRecord) => void;
  onDeleteLead?: (leadId: string) => void;
  onDialLead?: (lead: LeadRecord) => void;
  onScheduleOutreach: (lead: LeadRecord) => void;
  onSkipTrace: (lead: LeadRecord) => void;
}

const STAGES: Array<{ id: LeadRecord['stage']; label: string }> = [
  { id: 'identified', label: 'Identified' },
  { id: 'enriched', label: 'Enriched' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'outreach_ready', label: 'Outreach Ready' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
];

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  onClose,
  onUpdateLead,
  onDeleteLead,
  onDialLead,
  onScheduleOutreach,
  onSkipTrace,
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'details' | 'factors' | 'activity' | 'notes'>('details');
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedDisposition, setSelectedDisposition] = useState(lead.disposition || 'uncontacted');

  const handleStageChange = async (nextStage: LeadRecord['stage']) => {
    try {
      setIsSaving(true);
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: nextStage }),
      });
      if (!res.ok) throw new Error('Failed to update stage');
      const updated = await res.json();
      onUpdateLead(updated);
      addToast(`Stage advanced to "${nextStage}"`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Stage update failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDispositionChange = async (disposition: string) => {
    setSelectedDisposition(disposition as any);
    try {
      setIsSaving(true);
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition }),
      });
      if (!res.ok) throw new Error('Failed to update disposition');
      const updated = await res.json();
      onUpdateLead(updated);
      addToast(`Disposition set to "${disposition}"`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Disposition update failed', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    try {
      setIsSaving(true);
      const combinedNotes = lead.notes
        ? `${lead.notes}\n[${new Date().toLocaleDateString()}] ${newNote.trim()}`
        : `[${new Date().toLocaleDateString()}] ${newNote.trim()}`;

      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: combinedNotes }),
      });
      if (!res.ok) throw new Error('Failed to add note');
      const updated = await res.json();
      onUpdateLead(updated);
      setNewNote('');
      addToast('Note logged to CRM record', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to add note', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    const currentTags = lead.tags || [];
    if (currentTags.includes(newTag.trim())) {
      setNewTag('');
      return;
    }

    const updatedTags = [...currentTags, newTag.trim()];
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      });
      if (!res.ok) throw new Error('Failed to update tags');
      const updated = await res.json();
      onUpdateLead(updated);
      setNewTag('');
      addToast(`Tag "${newTag.trim()}" added`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to add tag', 'error');
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = (lead.tags || []).filter((t) => t !== tagToRemove);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: updatedTags }),
      });
      if (!res.ok) throw new Error('Failed to update tags');
      const updated = await res.json();
      onUpdateLead(updated);
      addToast(`Tag "${tagToRemove}" removed`, 'info');
    } catch (err: any) {
      addToast(err.message || 'Failed to remove tag', 'error');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to remove lead "${lead.owner_name}" from the CRM?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete lead');
      if (onDeleteLead) onDeleteLead(lead.id);
      addToast(`Lead "${lead.owner_name}" deleted from CRM`, 'success');
      onClose();
    } catch (err: any) {
      addToast(err.message || 'Delete failed', 'error');
    }
  };

  const isHigh = lead.lead_score >= 80;
  const isMid = lead.lead_score >= 60 && lead.lead_score < 80;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5 flex flex-col justify-between shadow-xs">
      {/* Header Info */}
      <div className="space-y-4">
        <div className="border-b border-slate-200 pb-3 flex items-start justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase font-bold text-cyan-700">Sub-Agent 2 Lead Dossier</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {lead.stage}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1">{lead.owner_name}</h3>
            <p className="text-xs text-slate-500">{lead.property_address}</p>
          </div>

          <div className="text-right">
            <span
              className={`text-sm font-bold font-mono px-2.5 py-1 rounded-full border ${
                isHigh
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : isMid
                  ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {lead.lead_score}/100
            </span>
          </div>
        </div>

        {/* Quick Stage Stepper / Transition Dropdown */}
        <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
            Pipeline Stage Progression
          </label>
          <div className="grid grid-cols-4 gap-1">
            {STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStageChange(s.id)}
                disabled={isSaving}
                className={`px-2 py-1 text-[10px] font-semibold rounded-md border transition cursor-pointer text-center truncate ${
                  lead.stage === s.id
                    ? 'bg-cyan-600 text-white border-cyan-600 shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                }`}
                title={s.label}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Disposition Selector */}
        <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
            Outreach Disposition
          </label>
          <select
            value={selectedDisposition}
            onChange={(e) => handleDispositionChange(e.target.value)}
            disabled={isSaving}
            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600 cursor-pointer font-medium"
          >
            <option value="uncontacted">⏳ Uncontacted (Pending Queue)</option>
            <option value="interested">🔥 Interested / Requesting Proposal</option>
            <option value="call_back_later">📞 Callback Scheduled</option>
            <option value="under_contract">📝 Under Contract / Escrow</option>
            <option value="not_interested">🛑 Not Interested</option>
            <option value="wrong_number">❌ Wrong Number / Dead Lead</option>
            <option value="do_not_call">🚫 DNC / Do Not Call</option>
          </select>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center space-x-2 border-b border-slate-200 pb-1 text-xs">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-3 py-1 font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'details' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('factors')}
            className={`px-3 py-1 font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'factors' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Scoring Factors ({lead.factors?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`px-3 py-1 font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'activity' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            History ({lead.activity_log?.length || 0})
          </button>
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'details' && (
          <div className="space-y-3 animate-in fade-in duration-100">
            {/* Contact Details */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-700">
                <span className="flex items-center space-x-2">
                  <PhoneCall className="w-3.5 h-3.5 text-cyan-600" />
                  <span className="font-mono">{lead.phone_number || 'No phone on record'}</span>
                </span>
                {lead.dnc_compliant && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    TCPA Passed
                  </span>
                )}
              </div>

              {lead.email && (
                <div className="flex items-center space-x-2 text-slate-700">
                  <Mail className="w-3.5 h-3.5 text-cyan-600" />
                  <span>{lead.email}</span>
                </div>
              )}
            </div>

            {/* Custom Tags Manager */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Prospect Tags
              </label>
              <div className="flex flex-wrap gap-1.5 items-center">
                {(lead.tags || ['High Equity', 'Absentee']).map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-cyan-50 text-cyan-800 border border-cyan-200"
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-rose-600 transition cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <div className="inline-flex items-center space-x-1">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="+ Tag..."
                    className="text-[10px] bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 w-16 focus:w-24 transition-all focus:outline-none focus:border-cyan-600"
                  />
                </div>
              </div>
            </div>

            {/* Log a CRM Note */}
            <form onSubmit={handleAddNote} className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                Log CRM Activity / Conversation Note
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="e.g. Left voicemail regarding 1031 exchange management..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-cyan-600"
                />
                <button
                  type="submit"
                  disabled={isSaving || !newNote.trim()}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  Log Note
                </button>
              </div>
              {lead.notes && (
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-700 whitespace-pre-wrap max-h-24 overflow-y-auto">
                  {lead.notes}
                </div>
              )}
            </form>
          </div>
        )}

        {/* Tab 2: Scoring Factors */}
        {activeTab === 'factors' && (
          <div className="space-y-2.5 animate-in fade-in duration-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />
              <span>Sub-Agent 2 Factor Reasoning</span>
            </h4>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {lead.factors?.map((f, idx) => (
                <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{f.factor}</span>
                    <span className="font-mono text-cyan-700 font-bold">
                      +{f.score_contribution || f.impact || 15} pts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                    {f.reasoning || f.description || 'Factor confirmed from cadastral roll'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: History & Activity Log */}
        {activeTab === 'activity' && (
          <div className="space-y-2 max-h-56 overflow-y-auto animate-in fade-in duration-100">
            {(lead.activity_log || [
              {
                id: '1',
                timestamp: lead.created_at,
                action: 'Lead ingested into CRM pipeline',
                agent: lead.assigned_agent || 'Sub-Agent 2',
              },
            ]).map((act, idx) => (
              <div key={act.id || idx} className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>{new Date(act.timestamp).toLocaleString()}</span>
                  <span className="font-semibold text-cyan-700">{act.agent}</span>
                </div>
                <div className="font-medium text-slate-800 text-[11px]">{act.action}</div>
                {act.notes && <div className="text-[10px] text-slate-600 italic">"{act.notes}"</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Action Buttons */}
      <div className="space-y-2 pt-2 border-t border-slate-200">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onSkipTrace(lead)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Skip Trace Owner</span>
          </button>

          <button
            onClick={() => onScheduleOutreach(lead)}
            className="w-full bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-semibold text-xs py-2 rounded-xl transition shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            <span>Schedule Session</span>
          </button>
        </div>

        {onDialLead && (
          <button
            onClick={() => onDialLead(lead)}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition shadow-md shadow-cyan-600/15 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Launch Immediate Dial Session</span>
          </button>
        )}

        {onDeleteLead && (
          <button
            onClick={handleDelete}
            className="w-full text-slate-400 hover:text-rose-600 text-[11px] font-medium py-1 transition cursor-pointer flex items-center justify-center space-x-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove Lead from Pipeline</span>
          </button>
        )}
      </div>
    </div>
  );
};
