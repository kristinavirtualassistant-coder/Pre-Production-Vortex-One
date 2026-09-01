import React, { useState } from 'react';
import {
  Sparkles,
  PhoneCall,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Tag,
  Building,
  MoreVertical,
  CheckCircle2,
  Clock,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { LeadRecord } from '../types';

interface CrmKanbanBoardProps {
  leads: LeadRecord[];
  onSelectLead: (lead: LeadRecord) => void;
  onUpdateLeadStage: (leadId: string, nextStage: LeadRecord['stage']) => Promise<void>;
  onDialLead?: (lead: LeadRecord) => void;
  onScheduleOutreach: (lead: LeadRecord) => void;
  onSkipTrace: (lead: LeadRecord) => void;
}

const STAGES: Array<{ id: LeadRecord['stage']; label: string; color: string; bgClass: string; borderClass: string }> = [
  { id: 'identified', label: '1. Identified', color: 'text-slate-700', bgClass: 'bg-slate-100', borderClass: 'border-slate-300' },
  { id: 'enriched', label: '2. Enriched', color: 'text-indigo-700', bgClass: 'bg-indigo-50', borderClass: 'border-indigo-200' },
  { id: 'qualified', label: '3. Qualified', color: 'text-blue-700', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' },
  { id: 'outreach_ready', label: '4. Outreach Ready', color: 'text-purple-700', bgClass: 'bg-purple-50', borderClass: 'border-purple-200' },
  { id: 'contacted', label: '5. Contacted', color: 'text-amber-700', bgClass: 'bg-amber-50', borderClass: 'border-amber-200' },
  { id: 'meeting_scheduled', label: '6. Meeting Scheduled', color: 'text-teal-700', bgClass: 'bg-teal-50', borderClass: 'border-teal-200' },
  { id: 'won', label: '7. Won / Contract', color: 'text-emerald-700', bgClass: 'bg-emerald-50', borderClass: 'border-emerald-200' },
  { id: 'lost', label: '8. Lost / Archived', color: 'text-rose-700', bgClass: 'bg-rose-50', borderClass: 'border-rose-200' },
];

export const CrmKanbanBoard: React.FC<CrmKanbanBoardProps> = ({
  leads,
  onSelectLead,
  onUpdateLeadStage,
  onDialLead,
  onScheduleOutreach,
  onSkipTrace,
}) => {
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);

  const handleMove = async (leadId: string, nextStage: LeadRecord['stage'], e: React.MouseEvent) => {
    e.stopPropagation();
    setMovingLeadId(leadId);
    try {
      await onUpdateLeadStage(leadId, nextStage);
    } finally {
      setMovingLeadId(null);
    }
  };

  const getStageIndex = (stage: LeadRecord['stage']) => STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="overflow-x-auto pb-4 pt-1">
      <div className="flex space-x-4 min-w-[1300px]">
        {STAGES.map((st, sIdx) => {
          const columnLeads = leads.filter((l) => l.stage === st.id);

          return (
            <div
              key={st.id}
              className="w-72 shrink-0 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col max-h-[75vh] shadow-2xs"
            >
              {/* Column Header */}
              <div className="p-3.5 border-b border-slate-200 bg-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    st.id === 'won' ? 'bg-emerald-500' : st.id === 'lost' ? 'bg-rose-500' : 'bg-cyan-500'
                  }`} />
                  <h3 className={`text-xs font-bold ${st.color}`}>{st.label}</h3>
                </div>
                <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                  {columnLeads.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {columnLeads.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-[11px]">
                    No leads in this stage
                  </div>
                ) : (
                  columnLeads.map((lead) => {
                    const isHigh = lead.lead_score >= 80;
                    const isMid = lead.lead_score >= 60 && lead.lead_score < 80;
                    const currentIdx = getStageIndex(lead.stage);

                    return (
                      <div
                        key={lead.id}
                        onClick={() => onSelectLead(lead)}
                        className={`bg-white border rounded-xl p-3.5 space-y-2.5 hover:shadow-md transition cursor-pointer relative group ${
                          movingLeadId === lead.id ? 'opacity-50 pointer-events-none' : ''
                        } ${
                          isHigh
                            ? 'border-emerald-200/90 hover:border-emerald-300'
                            : 'border-slate-200 hover:border-cyan-300'
                        }`}
                      >
                        {/* Header: Score & Name */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-bold text-xs text-slate-900 leading-tight">
                            {lead.owner_name}
                          </div>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                              isHigh
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isMid
                                ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {lead.lead_score} pts
                          </span>
                        </div>

                        {/* Property Address */}
                        <div className="text-[11px] text-slate-600 truncate flex items-center space-x-1">
                          <Building className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{lead.property_address}</span>
                        </div>

                        {/* Contact & Verification Badge */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 font-mono">
                          <span>{lead.phone_number || 'No phone'}</span>
                          {lead.dnc_compliant && (
                            <span className="text-emerald-700 font-semibold flex items-center space-x-0.5">
                              <span>✓ TCPA</span>
                            </span>
                          )}
                        </div>

                        {/* Stage Progressor Arrows & Actions */}
                        <div className="flex items-center justify-between pt-1 text-xs">
                          <div className="flex items-center space-x-1">
                            {currentIdx > 0 && (
                              <button
                                type="button"
                                onClick={(e) => handleMove(lead.id, STAGES[currentIdx - 1].id, e)}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                title={`Move backward to ${STAGES[currentIdx - 1].label}`}
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {currentIdx < STAGES.length - 1 && (
                              <button
                                type="button"
                                onClick={(e) => handleMove(lead.id, STAGES[currentIdx + 1].id, e)}
                                className="p-1 rounded bg-cyan-50 hover:bg-cyan-100 text-cyan-700 transition cursor-pointer"
                                title={`Advance stage to ${STAGES[currentIdx + 1].label}`}
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSkipTrace(lead);
                              }}
                              className="p-1 rounded text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                              title="Skip Trace Owner"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onScheduleOutreach(lead);
                              }}
                              className="p-1 rounded text-purple-600 hover:bg-purple-50 transition cursor-pointer"
                              title="Schedule Outreach"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                            </button>
                            {onDialLead && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDialLead(lead);
                                }}
                                className="p-1 rounded text-cyan-600 hover:bg-cyan-50 transition cursor-pointer"
                                title="Instant Dial"
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
