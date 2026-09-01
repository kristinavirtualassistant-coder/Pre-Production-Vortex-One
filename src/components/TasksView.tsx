import React, { useState, useMemo } from 'react';
import {
  ListTodo,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Task, TaskPriority } from '../types';
import { AddTaskModal } from './AddTaskModal';

interface TasksViewProps {
  tasks: Task[];
  onAddTask: (task: { objective: string; priority: TaskPriority; due_date: string }) => Promise<void>;
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const getPriorityColor = (priority: TaskPriority) => {
  switch (priority) {
    case 'critical': return 'text-red-600 bg-red-50 border-red-200';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low': return 'text-slate-600 bg-slate-50 border-slate-200';
    default: return 'text-slate-600 bg-slate-50 border-slate-200';
  }
};

export const TasksView: React.FC<TasksViewProps> = ({ tasks, onAddTask }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('date');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const processedTasks = useMemo(() => {
    let filtered = tasks.filter((t) => {
      const matchesSearch =
        t.objective.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.task_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAgent = selectedAgent === 'all' || t.assigned_agent === selectedAgent;
      return matchesSearch && matchesAgent;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'priority') {
        return PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
  }, [tasks, searchTerm, selectedAgent, sortBy]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/10">
            <ListTodo className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">System Task Console</h1>
            <p className="text-xs text-slate-500">
              Complete task graph inspection: dependencies, execution status, latencies, and input/output payloads.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-xs text-slate-500">
            Total Tasks: <strong className="text-slate-900">{tasks.length}</strong>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs py-2 px-4 rounded-lg transition"
          >
            Add Task
          </button>
        </div>
      </div>

      {/* Filter & Sort Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search task objective or ID..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-cyan-600 flex-1 sm:flex-none"
          >
            <option value="all">All Agents</option>
            <option value="agent_1">agent_1 (Master)</option>
            <option value="sub_agent_1">sub_agent_1 (Property)</option>
            <option value="sub_agent_2">sub_agent_2 (CRM)</option>
            <option value="sub_agent_3">sub_agent_3 (Research)</option>
            <option value="sub_agent_4">sub_agent_4 (Enrichment)</option>
            <option value="sub_agent_5">sub_agent_5 (Outreach)</option>
            <option value="sub_agent_6">sub_agent_6 (Analytics)</option>
            <option value="sub_agent_7">sub_agent_7 (Compliance)</option>
            <option value="sub_agent_8">sub_agent_8 (Automation)</option>
            <option value="sub_agent_9">sub_agent_9 (QA)</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'priority' | 'date')}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-cyan-600 flex-1 sm:flex-none"
          >
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
          </select>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="divide-y divide-slate-200">
          {processedTasks.map((task) => {
            const isExpanded = expandedId === task.task_id;
            return (
              <div key={task.task_id} className="transition">
                <div
                  onClick={() => setExpandedId(isExpanded ? null : task.task_id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="font-mono text-xs font-bold text-cyan-700 shrink-0">
                      {task.assigned_agent}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-900 font-medium truncate">{task.objective}</p>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-500 mt-0.5">
                        <span className="font-mono">{task.task_id}</span>
                        <span>•</span>
                        <span className={`uppercase px-1.5 py-0.5 rounded-md border ${getPriorityColor(task.priority)} font-bold`}>
                          {task.priority} Priority
                        </span>
                        {task.executionTimeMs && <span>• {task.executionTimeMs}ms</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {task.status}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 text-xs">
                    <div>
                      <span className="text-slate-600 font-semibold uppercase text-[10px]">Input Parameters:</span>
                      <pre className="bg-slate-100 border border-slate-200 p-2.5 rounded mt-1 font-mono text-[11px] text-slate-800 overflow-x-auto">
                        {JSON.stringify(task.input, null, 2)}
                      </pre>
                    </div>

                    <div>
                      <span className="text-slate-600 font-semibold uppercase text-[10px]">Execution Result:</span>
                      <pre className="bg-slate-100 border border-slate-200 p-2.5 rounded mt-1 font-mono text-[11px] text-emerald-800 overflow-x-auto max-h-56">
                        {JSON.stringify(task.result, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {processedTasks.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500">
              No tasks matched your filter.
            </div>
          )}
        </div>
      </div>
      <AddTaskModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={onAddTask}
      />
    </div>
  );
};
