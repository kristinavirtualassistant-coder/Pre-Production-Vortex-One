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
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

const SortableLeadCard: React.FC<{ lead: LeadRecord; onSelect: () => void; onUpdate: (nextStage: LeadRecord['stage']) => void; onSkipTrace: () => void; onScheduleOutreach: () => void; onDialLead?: () => void }> = ({ lead, onSelect, onUpdate, onSkipTrace, onScheduleOutreach, onDialLead }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isHigh = lead.lead_score >= 80;
  const isMid = lead.lead_score >= 60 && lead.lead_score < 80;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      className={`bg-white border rounded-xl p-3.5 space-y-2.5 hover:shadow-md transition cursor-grab relative group ${
        isHigh ? 'border-emerald-200/90 hover:border-emerald-300' : 'border-slate-200 hover:border-cyan-300'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-xs text-slate-900 leading-tight">{lead.owner_name}</div>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 border ${isHigh ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isMid ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          {lead.lead_score} pts
        </span>
      </div>
      <div className="text-[11px] text-slate-600 truncate flex items-center space-x-1">
        <Building className="w-3 h-3 text-slate-400 shrink-0" />
        <span className="truncate">{lead.property_address}</span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 font-mono">
        <span>{lead.phone_number || 'No phone'}</span>
        {lead.dnc_compliant && <span className="text-emerald-700 font-semibold flex items-center space-x-0.5"><span>✓ TCPA</span></span>}
      </div>
    </div>
  );
};

const DroppableColumn: React.FC<{ stage: typeof STAGES[0]; leads: LeadRecord[]; onSelectLead: (lead: LeadRecord) => void; onUpdateLeadStage: (leadId: string, nextStage: LeadRecord['stage']) => Promise<void>; onDialLead?: (lead: LeadRecord) => void; onScheduleOutreach: (lead: LeadRecord) => void; onSkipTrace: (lead: LeadRecord) => void }> = ({ stage, leads, onSelectLead, onUpdateLeadStage, onDialLead, onScheduleOutreach, onSkipTrace }) => {
  const { setNodeRef } = useDroppable({ id: stage.id });
  
  return (
    <div ref={setNodeRef} className="w-72 shrink-0 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col max-h-[75vh] shadow-2xs">
        <div className="p-3.5 border-b border-slate-200 bg-white rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-2">
            <span className={`w-2.5 h-2.5 rounded-full ${stage.id === 'won' ? 'bg-emerald-500' : stage.id === 'lost' ? 'bg-rose-500' : 'bg-cyan-500'}`} />
            <h3 className={`text-xs font-bold ${stage.color}`}>{stage.label}</h3>
          </div>
          <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">{leads.length}</span>
        </div>
        <div className="p-3 space-y-3 overflow-y-auto flex-1">
          <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            {leads.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-[11px]">No leads in this stage</div>
            ) : (
              leads.map((lead) => (
                <SortableLeadCard key={lead.id} lead={lead} onSelect={() => onSelectLead(lead)} onUpdate={onUpdateLeadStage} onSkipTrace={() => onSkipTrace(lead)} onScheduleOutreach={() => onScheduleOutreach(lead)} />
              ))
            )}
          </SortableContext>
        </div>
    </div>
  );
};

export const CrmKanbanBoard: React.FC<CrmKanbanBoardProps> = ({
  leads,
  onSelectLead,
  onUpdateLeadStage,
  onDialLead,
  onScheduleOutreach,
  onSkipTrace,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const leadId = active.id as string;
    const nextStage = over.id as LeadRecord['stage'];
    if (active.id !== over.id && STAGES.some(s => s.id === nextStage)) {
        await onUpdateLeadStage(leadId, nextStage);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4 pt-1">
        <div className="flex space-x-4 min-w-[1300px]">
          {STAGES.map((st) => (
             <DroppableColumn 
                key={st.id} 
                stage={st} 
                leads={leads.filter((l) => l.stage === st.id)}
                onSelectLead={onSelectLead}
                onUpdateLeadStage={onUpdateLeadStage}
                onDialLead={onDialLead}
                onScheduleOutreach={onScheduleOutreach}
                onSkipTrace={onSkipTrace}
             />
          ))}
        </div>
      </div>
    </DndContext>
  );
};
