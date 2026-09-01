import React, { useState } from 'react';
import { 
  Sparkles, 
  BrainCircuit, 
  CheckCircle2, 
  Calendar, 
  Plus, 
  Loader2, 
  Flame, 
  Smile, 
  Meh, 
  Frown, 
  ShieldAlert 
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { TaskPriority } from '../types';

interface CallAnalysisResult {
  disposition: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'hostile';
  urgencyScore: number;
  keyTakeaways: string[];
  suggestedFollowUpTask?: {
    objective: string;
    priority: TaskPriority;
    dueDate: string;
  };
}

interface CallTranscriptAnalyzerProps {
  callId?: string;
  contactName?: string;
  defaultNotes?: string;
  onTaskCreated?: (task: { objective: string; priority: TaskPriority; due_date: string }) => void;
}

export const CallTranscriptAnalyzer: React.FC<CallTranscriptAnalyzerProps> = ({
  callId,
  contactName = 'Contact',
  defaultNotes = '',
  onTaskCreated,
}) => {
  const { addToast } = useToast();
  const [transcript, setTranscript] = useState(defaultNotes);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CallAnalysisResult | null>(null);
  const [taskAdded, setTaskAdded] = useState(false);

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      addToast('Please enter or paste call notes/transcript first', 'error');
      return;
    }

    setIsAnalyzing(true);
    setAnalysis(null);
    setTaskAdded(false);

    try {
      const res = await fetch('/api/ai/analyze-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callId,
          contactName,
          transcript,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to analyze transcript');
      }

      const data = await res.json();
      setAnalysis(data);
      addToast('Call analyzed by Gemini AI', 'success');
    } catch (err: any) {
      console.error('Call analysis error:', err);
      addToast(err.message || 'Failed to analyze call transcript', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCreateTask = () => {
    if (!analysis?.suggestedFollowUpTask) return;

    if (onTaskCreated) {
      onTaskCreated({
        objective: analysis.suggestedFollowUpTask.objective,
        priority: analysis.suggestedFollowUpTask.priority,
        due_date: analysis.suggestedFollowUpTask.dueDate,
      });
    }

    setTaskAdded(true);
    addToast('Follow-up task added to CRM pipeline', 'success');
  };

  const getSentimentBadge = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Smile className="w-3.5 h-3.5" /> Positive
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Frown className="w-3.5 h-3.5" /> Negative
          </span>
        );
      case 'hostile':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
            <ShieldAlert className="w-3.5 h-3.5" /> Hostile / DNC Risk
          </span>
        );
      case 'neutral':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            <Meh className="w-3.5 h-3.5" /> Neutral
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">AI Call Transcript &amp; Sentiment Analyzer</h3>
            <p className="text-xs text-slate-500">Gemini extracts disposition, sentiment, urgency &amp; follow-up tasks</p>
          </div>
        </div>
        <span className="text-[11px] font-medium text-slate-400">Target: {contactName}</span>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-700">
          Call Transcript or Agent Raw Notes
        </label>
        <textarea
          rows={3}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste call notes, audio transcript, or agent summary here (e.g., 'Spoke with Jonathan. Highly interested in selling Newport Blvd property before Q3 due to tax 1031 exchange...')"
          className="w-full text-xs text-slate-800 p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || !transcript.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing Call with Gemini...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Analyze Transcript &amp; Extract Tasks</span>
            </>
          )}
        </button>
      </div>

      {analysis && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 bg-slate-50/70 p-4 rounded-xl border">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Suggested Disposition</span>
              <span className="text-xs font-bold text-slate-800 mt-1 block">{analysis.disposition}</span>
            </div>
            
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Owner Sentiment</span>
              <div className="mt-1">{getSentimentBadge(analysis.sentiment)}</div>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Urgency Score (1–10)</span>
              <div className="flex items-center gap-2 mt-1">
                <Flame className={`w-4 h-4 ${analysis.urgencyScore >= 7 ? 'text-amber-500' : 'text-slate-400'}`} />
                <span className="text-sm font-black text-slate-800">{analysis.urgencyScore} / 10</span>
              </div>
            </div>
          </div>

          {analysis.keyTakeaways && analysis.keyTakeaways.length > 0 && (
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Key Actionable Takeaways</span>
              <ul className="space-y-1 text-xs text-slate-600 list-disc list-inside">
                {analysis.keyTakeaways.map((takeaway, idx) => (
                  <li key={idx}>{takeaway}</li>
                ))}
              </ul>
            </div>
          )}

          {analysis.suggestedFollowUpTask && (
            <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-200/60 text-indigo-800 px-2 py-0.5 rounded">
                    AI Auto-Generated Task
                  </span>
                  <span className="text-xs font-semibold text-indigo-900">
                    {analysis.suggestedFollowUpTask.priority.toUpperCase()} PRIORITY
                  </span>
                </div>
                <p className="text-xs text-indigo-950 font-medium">{analysis.suggestedFollowUpTask.objective}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-700">
                  <Calendar className="w-3 h-3" />
                  <span>Due Date: {analysis.suggestedFollowUpTask.dueDate}</span>
                </div>
              </div>

              <button
                onClick={handleCreateTask}
                disabled={taskAdded}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition cursor-pointer ${
                  taskAdded
                    ? 'bg-emerald-600 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                }`}
              >
                {taskAdded ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Added to CRM
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> Add Task to CRM
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
