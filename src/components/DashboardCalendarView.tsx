import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, ChevronLeft, ChevronRight, Filter, Plus, User, Building, MapPin, ArrowRight } from 'lucide-react';
import { Task, DialerCampaign, LeadRecord } from '../types';
import { useToast } from '../contexts/ToastContext';

interface DashboardCalendarViewProps {
  tasks: Task[];
  campaigns: DialerCampaign[];
  leads: LeadRecord[];
  onRescheduleItem?: (itemId: string, itemType: 'task' | 'campaign', newDate: string) => void;
}

export const DashboardCalendarView: React.FC<DashboardCalendarViewProps> = ({
  tasks,
  campaigns,
  leads,
  onRescheduleItem,
}) => {
  const { addToast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'all' | 'tasks' | 'campaigns' | 'agent_actions'>('all');
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [draggedItem, setDraggedItem] = useState<any | null>(null);

  // Generate calendar days for the current month view
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Combine tasks, campaigns, and agent actions into calendar events
  const events = [
    ...tasks.map((t, idx) => ({
      id: `task-${t.id || idx}`,
      title: t.title || t.description || 'Task Item',
      type: 'task',
      date: t.due_date || new Date(Date.now() + idx * 86400000).toISOString().split('T')[0],
      status: t.status || 'pending',
      details: t,
    })),
    ...campaigns.map((c, idx) => ({
      id: `campaign-${c.id || idx}`,
      title: `Campaign: ${c.name}`,
      type: 'campaign',
      date: c.scheduled_date || new Date(Date.now() + (idx + 1) * 86400000).toISOString().split('T')[0],
      status: c.status || 'active',
      details: c,
    })),
    // Automated agent actions
    {
      id: 'agent-action-1',
      title: 'Sub-Agent 3: Skip Trace Refresh',
      type: 'agent_action',
      date: new Date().toISOString().split('T')[0],
      status: 'scheduled',
      details: { agent: 'Sub-Agent 3 (Skip Tracer)', action: 'Batch verification across Orange County parcels' },
    },
    {
      id: 'agent-action-2',
      title: 'Sub-Agent 7: Underwriting Recalculation',
      type: 'agent_action',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      status: 'scheduled',
      details: { agent: 'Sub-Agent 7 (Underwriter)', action: 'ARV & Cap Rate re-indexing' },
    },
  ];

  const filteredEvents = events.filter(e => {
    if (filterType === 'all') return true;
    if (filterType === 'tasks') return e.type === 'task';
    if (filterType === 'campaigns') return e.type === 'campaign';
    if (filterType === 'agent_actions') return e.type === 'agent_action';
    return true;
  });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDropOnDate = (dayNum: number) => {
    if (!draggedItem) return;
    const formattedDay = String(dayNum).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    const newDateStr = `${year}-${formattedMonth}-${formattedDay}`;

    if (onRescheduleItem) {
      onRescheduleItem(draggedItem.id, draggedItem.type, newDateStr);
    }
    addToast(`Rescheduled "${draggedItem.title}" to ${monthNames[month]} ${dayNum}, ${year}`, 'success');
    setDraggedItem(null);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
      {/* Header controls */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold shadow-xs">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Task &amp; Agent Action Calendar</h3>
            <p className="text-xs text-slate-500">Drag and drop items or click dates to reschedule follow-up workflows.</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-1.5 shadow-2xs">
            <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-slate-800 min-w-[120px] text-center">
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-lg text-slate-600 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterType}
              onChange={(e: any) => setFilterType(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-cyan-600"
            >
              <option value="all">All Events ({events.length})</option>
              <option value="tasks">Tasks ({tasks.length})</option>
              <option value="campaigns">Campaigns ({campaigns.length})</option>
              <option value="agent_actions">Agent Actions (2)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="p-4">
        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Days cells */}
        <div className="grid grid-cols-7 gap-2">
          {/* Empty leading days */}
          {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-28 bg-slate-50/50 rounded-xl border border-dashed border-slate-200 opacity-40"></div>
          ))}

          {/* Month days */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const formattedDay = String(dayNum).padStart(2, '0');
            const formattedMonth = String(month + 1).padStart(2, '0');
            const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

            const dayEvents = filteredEvents.filter(e => e.date === dateStr);
            const isToday = new Date().toISOString().split('T')[0] === dateStr;

            return (
              <div
                key={`day-${dayNum}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropOnDate(dayNum)}
                className={`h-28 border rounded-xl p-2 flex flex-col justify-between transition bg-white overflow-y-auto ${
                  isToday ? 'border-cyan-500 ring-2 ring-cyan-500/20 bg-cyan-50/10' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${isToday ? 'bg-cyan-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-slate-700'}`}>
                    {dayNum}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-mono">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 my-1 overflow-y-auto flex-1 max-h-16">
                  {dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      draggable
                      onDragStart={() => setDraggedItem(ev)}
                      onClick={() => setSelectedEvent(ev)}
                      className={`text-[10px] px-2 py-1 rounded-lg font-medium cursor-grab active:cursor-grabbing truncate transition shadow-2xs ${
                        ev.type === 'task'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                          : ev.type === 'campaign'
                          ? 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                      title={ev.title}
                    >
                      <div className="font-bold truncate">{ev.title}</div>
                    </div>
                  ))}
                </div>

                <div className="text-[9px] text-slate-400 text-right">
                  {dayEvents.length === 0 ? '+ Drag to schedule' : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Event Details Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  selectedEvent.type === 'task' ? 'bg-blue-100 text-blue-800' : selectedEvent.type === 'campaign' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {selectedEvent.type.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500 font-mono">{selectedEvent.date}</span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 text-base">{selectedEvent.title}</h4>
              <p className="text-xs text-slate-600 mt-1">Status: <span className="font-semibold uppercase">{selectedEvent.status}</span></p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-2">
              <div className="font-semibold text-slate-900">Event Metadata</div>
              <pre className="text-[11px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
                {JSON.stringify(selectedEvent.details, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  addToast(`Completed workflow for ${selectedEvent.title}`, 'success');
                  setSelectedEvent(null);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
