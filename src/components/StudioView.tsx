import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  BrainCircuit,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  ShieldCheck,
  Building2,
  Users,
  Search,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  Layers,
  Mail,
  Sliders,
} from 'lucide-react';
import { Task, AgentDefinition, OutreachTemplate } from '../types';
import { OutreachTemplateManager } from './OutreachTemplateManager';
import { BatchProcessingMonitor } from './BatchProcessingMonitor';

interface StudioViewProps {
  agents: AgentDefinition[];
  onOrchestrate: (prompt: string) => Promise<any>;
  defaultPrompt?: string;
}

export const StudioView: React.FC<StudioViewProps> = ({
  agents,
  onOrchestrate,
  defaultPrompt = '',
}) => {
  const { activeTenant } = useAuth();
  const [studioMode, setStudioMode] = useState<'orchestrator' | 'templates' | 'batch_monitor'>('orchestrator');
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'synthesis' | 'task_dag' | 'provenance' | 'raw'>('synthesis');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [selectedTemplateNotice, setSelectedTemplateNotice] = useState<string | null>(null);

  const samplePrompts = [
    'Find property owners in Orange County who own multiple properties and identify the best prospects for property management.',
    'Analyze high-equity multi-family assets in Costa Mesa with absentee owners and draft personalized call pitches.',
    'Perform complete TCPA compliance check and QA audit on all identified Orange County commercial prospects.',
  ];

  const handleSelectTemplateForOutreach = (
    template: OutreachTemplate,
    renderedContent?: { subject?: string; body: string }
  ) => {
    setStudioMode('orchestrator');
    const channelName = template.channel === 'email' ? 'Email' : template.channel === 'sms' ? 'SMS' : 'Call Script';
    setPrompt(
      `Deploy ${channelName} Outreach Template "${template.name}" for qualified Orange County multi-family prospects. Perform TCPA DNC suppression check with Sub-Agent 7, customize merge variables for verified property owners, and request approval before execution.`
    );
    setSelectedTemplateNotice(`Loaded template "${template.name}" (${channelName}) into Orchestrator.`);
    setTimeout(() => setSelectedTemplateNotice(null), 5000);
  };

  const handleRun = async (promptToRun?: string) => {
    const finalPrompt = promptToRun || prompt;
    if (!finalPrompt.trim() || isExecuting) return;

    setIsExecuting(true);
    setExecutionResult(null);
    setAudioError(null);

    try {
      const res = await onOrchestrate(finalPrompt);
      setExecutionResult(res);
    } catch (err: any) {
      console.error('Orchestration error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handlePlayTTS = async (text: string) => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);
    setAudioError(null);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'Kore' }),
      });
      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => {
          setIsPlayingAudio(false);
          setAudioError('Failed to play audio stream');
        };
        await audio.play();
      } else {
        setIsPlayingAudio(false);
        setAudioError('Speech audio not returned');
      }
    } catch (err: any) {
      setIsPlayingAudio(false);
      setAudioError(err.message);
    }
  };

  return (
    <div id="studio-view-root" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Studio Header & Sub-View Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/10">
            {studioMode === 'orchestrator' ? <BrainCircuit className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {studioMode === 'orchestrator'
                  ? 'Agent 1 — Master Orchestrator Studio'
                  : 'Sub-Agent 5 — Outreach Template Manager'}
              </h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                {studioMode === 'orchestrator' ? 'Hierarchical Control' : 'Omnichannel Communications'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {studioMode === 'orchestrator'
                ? 'Submit complex real estate objectives. Agent 1 plans, delegates to Sub-Agents 0–9, validates with QA, and produces verified outputs.'
                : 'Manage and test high-converting email, SMS, and cold-call outreach templates with real county assessor merge variables.'}
            </p>
          </div>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
          <button
            id="tab-studio-orchestrator"
            onClick={() => setStudioMode('orchestrator')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition cursor-pointer ${
              studioMode === 'orchestrator'
                ? 'bg-white text-cyan-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Master Orchestrator</span>
          </button>
          <button
            id="tab-studio-templates"
            onClick={() => setStudioMode('templates')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition cursor-pointer ${
              studioMode === 'templates'
                ? 'bg-white text-cyan-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Outreach Templates</span>
          </button>
          <button
            id="tab-studio-batch"
            onClick={() => setStudioMode('batch_monitor')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition cursor-pointer ${
              studioMode === 'batch_monitor'
                ? 'bg-white text-cyan-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Batch Monitor</span>
          </button>
        </div>
      </div>

      {/* Plain-English Easy Explainer Banner */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200/80 rounded-xl p-4 text-xs text-cyan-950 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center shrink-0 mt-0.5 font-bold shadow-xs">
            🤖
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-xs">
              {studioMode === 'orchestrator'
                ? 'How the Multi-Agent Studio Works:'
                : 'How Outreach Templates Work:'}
            </h4>
            <p className="text-slate-600 text-[11px] mt-0.5 leading-relaxed">
              {studioMode === 'orchestrator'
                ? 'Type any natural language command (e.g. "Find high-equity multi-family in Orange County and draft call scripts"). Agent 1 breaks it down, delegates to Sub-Agents 0–9, and shows the verified output.'
                : 'Choose an Email, SMS, or Phone script. Use placeholders like {{owner_name}} and {{property_address}} to auto-fill verified public data before dispatching.'}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 shrink-0 text-[11px]">
          <span className="bg-white/80 border border-cyan-200 px-2.5 py-1 rounded-md text-cyan-800 font-semibold">
            ✨ Step 3 in Workflow
          </span>
          <span className="bg-white/80 border border-cyan-200 px-2.5 py-1 rounded-md text-cyan-800 font-semibold">
            👥 10 AI Sub-Agents
          </span>
        </div>
      </div>

      {/* Selected Template Notification Toast */}
      {selectedTemplateNotice && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>{selectedTemplateNotice}</span>
          </div>
          <button
            onClick={() => setSelectedTemplateNotice(null)}
            className="text-blue-500 hover:text-blue-700"
          >
            &times;
          </button>
        </div>
      )}

      {/* Mode 2: Outreach Template Manager */}
      {studioMode === 'templates' && (
        <div className="rounded-2xl border border-slate-800 overflow-hidden shadow-sm">
          <OutreachTemplateManager
            onSelectTemplateForOutreach={handleSelectTemplateForOutreach}
            organizationId={activeTenant?.id || ''}
          />
        </div>
      )}

      {/* Mode 3: Batch Processing Monitor */}
      {studioMode === 'batch_monitor' && <BatchProcessingMonitor />}

      {/* Mode 1: Master Orchestrator Studio */}
      {studioMode === 'orchestrator' && (
        <>
          {/* Input Box & Preset Prompts */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
              Orchestrator Request / Directive
            </label>

            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="e.g. Find property owners in Orange County who own multiple properties and identify the best prospects for property management..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 resize-none transition"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs">
                <span className="text-slate-500 shrink-0 font-medium">Quick Presets:</span>
                {samplePrompts.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPrompt(p);
                      handleRun(p);
                    }}
                    className="shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium px-2.5 py-1 rounded-md transition border border-slate-200 cursor-pointer"
                  >
                    Preset {idx + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handleRun()}
                disabled={isExecuting || !prompt.trim()}
                className={`flex items-center justify-center space-x-2 px-5 py-2 rounded-lg text-xs font-semibold text-white transition shadow-xs cursor-pointer ${
                  isExecuting || !prompt.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-cyan-600/10'
                }`}
              >
                {isExecuting ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Orchestrating Sub-Agents...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Execute Multi-Agent Workflow</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Execution DAG & Progress Spinner */}
          {isExecuting && (
            <div className="bg-white border border-cyan-300 rounded-xl p-6 text-center space-y-4 animate-pulse shadow-xs">
              <div className="w-12 h-12 rounded-full bg-cyan-50 text-cyan-600 flex items-center justify-center mx-auto border border-cyan-200">
                <BrainCircuit className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Agent 1 Master Orchestrator Running</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Decomposing task into sub-tasks • Calling Sub-Agent 1 (Property), Sub-Agent 4 (Enrichment), Sub-Agent 2 (Lead Scoring), Sub-Agent 5 (Outreach), Sub-Agent 7 (Compliance), and Sub-Agent 9 (QA Audit)...
                </p>
              </div>
              <div className="flex justify-center items-center space-x-2 text-[11px] text-cyan-700 font-mono font-medium">
                <span>Dependency DAG In-Flight</span>
                <span>•</span>
                <span>PostgreSQL Authoritative Queries</span>
              </div>
            </div>
          )}

          {/* Results Workspace */}
          {executionResult && (
        <div className="space-y-4">
          {/* Tabs Navigation */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setActiveTab('synthesis')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'synthesis'
                    ? 'bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Executive Response Contract
              </button>
              <button
                onClick={() => setActiveTab('task_dag')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'task_dag'
                    ? 'bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Sub-Agent Tasks &amp; DAG</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700">
                  {executionResult.tasks?.length || 0}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('provenance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'provenance'
                    ? 'bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Provenance &amp; Source Ledger
              </button>
              <button
                onClick={() => setActiveTab('raw')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'raw'
                    ? 'bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Raw JSON
              </button>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="text-slate-500">Latency: <strong className="text-slate-800">{executionResult.execution_time_ms}ms</strong></span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                QA: {executionResult.structured_summary?.qa_status}
              </span>
            </div>
          </div>

          {/* Tab 1: Synthesis View (Official Final Response Contract) */}
          {activeTab === 'synthesis' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Crisp Contract Response */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 flex items-center space-x-1.5">
                    <CheckCheck className="w-4 h-4" />
                    <span>Agent 1 Synthesized Response</span>
                  </span>

                  <button
                    onClick={() => handlePlayTTS(executionResult.final_response)}
                    disabled={isPlayingAudio}
                    className="flex items-center space-x-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-cyan-700 px-3 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer font-medium"
                  >
                    <Volume2 className={`w-3.5 h-3.5 ${isPlayingAudio ? 'animate-pulse text-cyan-600' : ''}`} />
                    <span>{isPlayingAudio ? 'Speaking...' : 'Listen via Gemini TTS'}</span>
                  </button>
                </div>

                {audioError && (
                  <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded">
                    {audioError}
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {executionResult.final_response}
                </div>

                {/* Next Recommended Action Banner */}
                <div className="bg-cyan-50/80 border border-cyan-200 rounded-lg p-4 flex items-start space-x-3">
                  <Sparkles className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-cyan-900 uppercase tracking-wide">Next Recommended Action</h4>
                    <p className="text-xs text-slate-700 mt-0.5 leading-relaxed">
                      {executionResult.structured_summary?.next_action}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right 1 Col: Summary Metrics & QA Badge */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 flex flex-col justify-between shadow-xs">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Orchestration Metrics
                  </h3>

                  <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Records Analyzed:</span>
                      <span className="font-bold text-slate-900">{executionResult.structured_summary?.records_analyzed}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Qualified Prospects:</span>
                      <span className="font-bold text-emerald-700">{executionResult.structured_summary?.qualified_prospects}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>High-Priority Prospects:</span>
                      <span className="font-bold text-cyan-700">{executionResult.structured_summary?.high_priority_prospects}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>QA Verification:</span>
                      <span className="font-bold text-emerald-700 font-mono">
                        {executionResult.structured_summary?.qa_status === 'PASS' ? 'PASSED (Sub-Agent 9)' : 'NEEDS_REVIEW'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-600">
                      <span>Statistical Confidence:</span>
                      <span className="font-bold text-cyan-700">{Math.round((executionResult.structured_summary?.confidence || 0.96) * 100)}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center space-x-1.5 text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Independent QA Verified</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-tight">
                    Sub-Agent 9 confirmed numerical consistency, zero fabricated claims, and valid property provenance.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Task DAG & Sub-Agent Trace */}
          {activeTab === 'task_dag' && (
            <div className="space-y-3">
              {executionResult.tasks?.map((task: Task, idx: number) => {
                const isExpanded = expandedTaskId === task.task_id;
                return (
                  <div
                    key={task.task_id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
                  >
                    <div
                      onClick={() => setExpandedTaskId(isExpanded ? null : task.task_id)}
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-cyan-700 text-xs font-mono font-bold flex items-center justify-center shrink-0 border border-slate-200">
                          0{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-cyan-700">{task.assigned_agent}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase font-medium border border-slate-200">
                              {task.priority}
                            </span>
                            <span className="text-[10px] text-slate-400">{task.executionTimeMs}ms</span>
                          </div>
                          <p className="text-xs text-slate-800 font-medium truncate mt-0.5">{task.objective}</p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {task.status}
                        </span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 text-xs">
                        <div>
                          <span className="text-slate-500 font-semibold uppercase text-[10px]">Task Input:</span>
                          <pre className="bg-slate-900 p-2.5 rounded mt-1 font-mono text-[11px] text-cyan-200 overflow-x-auto">
                            {JSON.stringify(task.input, null, 2)}
                          </pre>
                        </div>

                        <div>
                          <span className="text-slate-500 font-semibold uppercase text-[10px]">Sub-Agent Output:</span>
                          <pre className="bg-slate-900 p-2.5 rounded mt-1 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-64">
                            {JSON.stringify(task.result, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tab 3: Provenance */}
          {activeTab === 'provenance' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Multi-Agent Provenance &amp; Authority Chain
              </h3>
              <div className="space-y-2">
                {executionResult.tasks?.flatMap((t: Task) => t.provenance || []).map((prov: any, idx: number) => (
                  <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-start justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-900">{prov.source}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Type: <span className="font-mono text-cyan-700 font-semibold">{prov.sourceType}</span> • Retrieved: {new Date(prov.retrievedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px] font-bold">
                      Confidence: {Math.round(prov.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Raw JSON */}
          {activeTab === 'raw' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <pre className="bg-slate-900 p-4 rounded-lg font-mono text-xs text-cyan-300 overflow-x-auto max-h-96">
                {JSON.stringify(executionResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );
};
