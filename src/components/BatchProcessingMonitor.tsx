import React, { useState, useEffect } from 'react';
import {
  Layers,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Download,
  Trash2,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface BatchJob {
  id: string;
  name: string;
  type: 'skip_trace' | 'enrichment' | 'compliance_sweep' | 'tax_assessment';
  status: 'running' | 'paused' | 'completed' | 'failed' | 'queued';
  totalItems: number;
  processedItems: number;
  successCount: number;
  errorCount: number;
  startTime: string;
  estimatedSecondsRemaining: number;
  errorLogs: Array<{ timestamp: string; itemKey: string; error: string }>;
}

export const BatchProcessingMonitor: React.FC = () => {
  const { addToast } = useToast();
  const [batches, setBatches] = useState<BatchJob[]>([
    {
      id: 'batch_oc_skip_01',
      name: 'Orange County Multi-Family Bulk Skip Trace',
      type: 'skip_trace',
      status: 'running',
      totalItems: 250,
      processedItems: 142,
      successCount: 138,
      errorCount: 4,
      startTime: new Date(Date.now() - 45000).toISOString(),
      estimatedSecondsRemaining: 38,
      errorLogs: [
        { timestamp: new Date(Date.now() - 30000).toLocaleTimeString(), itemKey: 'APN 425-091-18', error: 'County Assessor record temporarily locked' },
        { timestamp: new Date(Date.now() - 22000).toLocaleTimeString(), itemKey: 'APN 425-092-04', error: 'Statutory DNC suppression matched - skipped' },
        { timestamp: new Date(Date.now() - 15000).toLocaleTimeString(), itemKey: 'APN 425-093-11', error: 'Missing active phone listing in cadastral roll' },
        { timestamp: new Date(Date.now() - 5000).toLocaleTimeString(), itemKey: 'APN 425-095-22', error: 'Timeout connecting to secondary GIS provider' },
      ],
    },
    {
      id: 'batch_equity_enrich_02',
      name: 'High-Equity Commercial Portfolio Enrichment',
      type: 'enrichment',
      status: 'completed',
      totalItems: 500,
      processedItems: 500,
      successCount: 495,
      errorCount: 5,
      startTime: new Date(Date.now() - 600000).toISOString(),
      estimatedSecondsRemaining: 0,
      errorLogs: [
        { timestamp: '05:12:10 AM', itemKey: 'APN 119-240-02', error: 'Deed transfer date format unparseable' },
        { timestamp: '05:13:40 AM', itemKey: 'APN 119-241-15', error: 'Invalid parcel geometry polygon' },
      ],
    },
    {
      id: 'batch_tcpa_sweep_03',
      name: 'TCPA & DNC Regulatory Compliance Sweep',
      type: 'compliance_sweep',
      status: 'paused',
      totalItems: 1200,
      processedItems: 340,
      successCount: 340,
      errorCount: 0,
      startTime: new Date(Date.now() - 120000).toISOString(),
      estimatedSecondsRemaining: 185,
      errorLogs: [],
    },
  ]);

  const [expandedBatchId, setExpandedBatchId] = useState<string | null>('batch_oc_skip_01');
  const [isStartingNew, setIsStartingNew] = useState(false);
  const [newBatchName, setNewBatchName] = useState('New Property Enrichment Batch');
  const [newBatchType, setNewBatchType] = useState<'skip_trace' | 'enrichment' | 'compliance_sweep' | 'tax_assessment'>('skip_trace');
  const [newBatchCount, setNewBatchCount] = useState(150);

  // Simulate progress for running batches
  useEffect(() => {
    const timer = setInterval(() => {
      setBatches((prev) =>
        prev.map((b) => {
          if (b.status === 'running' && b.processedItems < b.totalItems) {
            const nextProcessed = Math.min(b.totalItems, b.processedItems + Math.floor(Math.random() * 3) + 1);
            const remaining = Math.max(0, b.estimatedSecondsRemaining - 1);
            const isFinished = nextProcessed >= b.totalItems;
            return {
              ...b,
              processedItems: nextProcessed,
              successCount: isFinished ? nextProcessed - b.errorCount : b.successCount + 1,
              status: isFinished ? 'completed' : 'running',
              estimatedSecondsRemaining: isFinished ? 0 : remaining,
            };
          }
          return b;
        })
      );
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleTogglePause = (id: string) => {
    const target = batches.find((b) => b.id === id);
    if (!target) return;
    const nextStatus = target.status === 'running' ? 'paused' : 'running';
    setBatches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: nextStatus } : b))
    );
    addToast(`Batch "${target.name}" ${nextStatus === 'running' ? 'resumed' : 'paused'}.`, 'info');
  };

  const handleCancelBatch = (id: string) => {
    setBatches((prev) => prev.filter((b) => b.id !== id));
    addToast('Batch operation terminated.', 'info');
  };

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;

    const newJob: BatchJob = {
      id: `batch_${Date.now()}`,
      name: newBatchName.trim(),
      type: newBatchType,
      status: 'running',
      totalItems: newBatchCount,
      processedItems: 0,
      successCount: 0,
      errorCount: 0,
      startTime: new Date().toISOString(),
      estimatedSecondsRemaining: newBatchCount * 0.4,
      errorLogs: [],
    };

    setBatches([newJob, ...batches]);
    setIsStartingNew(false);
    setNewBatchName('New Property Enrichment Batch');
    addToast(`Started batch job: "${newJob.name}"`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <Layers className="w-5 h-5 text-cyan-600" />
            <span>Batch Processing &amp; Enrichment Monitor</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time telemetry, progress tracking, ETA estimation, and itemized error logging for bulk skip tracing and property enrichment jobs.
          </p>
        </div>
        <button
          onClick={() => setIsStartingNew(true)}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg text-xs shadow-sm transition flex items-center gap-2 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Launch New Batch Job</span>
        </button>
      </div>

      {/* New Batch Modal */}
      {isStartingNew && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Zap className="w-4 h-4 text-cyan-600" />
                <span>Configure New Batch Job</span>
              </h3>
              <button onClick={() => setIsStartingNew(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateBatch} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Batch Job Name</label>
                <input
                  type="text"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Job Type</label>
                  <select
                    value={newBatchType}
                    onChange={(e: any) => setNewBatchType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  >
                    <option value="skip_trace">Bulk Skip Trace</option>
                    <option value="enrichment">Portfolio Enrichment</option>
                    <option value="compliance_sweep">TCPA / DNC Compliance Sweep</option>
                    <option value="tax_assessment">Tax Assessment Sync</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Total Parcels / Items</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={newBatchCount}
                    onChange={(e) => setNewBatchCount(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStartingNew(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-lg shadow-sm cursor-pointer"
                >
                  Start Processing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch List */}
      <div className="space-y-4">
        {batches.map((batch) => {
          const percent = Math.round((batch.processedItems / batch.totalItems) * 100);
          const isExpanded = expandedBatchId === batch.id;

          return (
            <div key={batch.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      batch.status === 'running'
                        ? 'bg-cyan-50 text-cyan-600 animate-pulse'
                        : batch.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-600'
                        : batch.status === 'paused'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {batch.status === 'running' && <Layers className="w-5 h-5 animate-spin" />}
                    {batch.status === 'completed' && <CheckCircle2 className="w-5 h-5" />}
                    {batch.status === 'paused' && <Clock className="w-5 h-5" />}
                    {batch.status === 'failed' && <XCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-bold text-slate-900">{batch.name}</h3>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${
                          batch.status === 'running'
                            ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                            : batch.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : batch.status === 'paused'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {batch.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                      <span>Type: <strong className="text-slate-700">{batch.type}</strong></span>
                      <span>Started: <strong className="text-slate-700">{new Date(batch.startTime).toLocaleTimeString()}</strong></span>
                      {batch.status === 'running' && (
                        <span className="text-cyan-700 font-semibold">ETA: ~{batch.estimatedSecondsRemaining}s remaining</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Control Actions */}
                <div className="flex items-center space-x-2">
                  {batch.status === 'running' && (
                    <button
                      onClick={() => handleTogglePause(batch.id)}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  )}
                  {batch.status === 'paused' && (
                    <button
                      onClick={() => handleTogglePause(batch.id)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Resume</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleCancelBatch(batch.id)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-700">
                    Processed {batch.processedItems.toLocaleString()} of {batch.totalItems.toLocaleString()} items ({percent}%)
                  </span>
                  <div className="space-x-3 text-[11px]">
                    <span className="text-emerald-600 font-semibold">✓ {batch.successCount} success</span>
                    <span className="text-rose-600 font-semibold">⚠ {batch.errorCount} errors</span>
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                  <div
                    className={`h-full transition-all duration-500 ${
                      batch.status === 'completed'
                        ? 'bg-emerald-500'
                        : batch.status === 'paused'
                        ? 'bg-amber-500'
                        : 'bg-cyan-600'
                    }`}
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>

              {/* Expanded Error Logs Section */}
              {isExpanded && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Itemized Error &amp; Exception Logs</h4>
                    <span className="text-[11px] text-slate-500 font-mono">{batch.errorLogs.length} exceptions recorded</span>
                  </div>
                  {batch.errorLogs.length === 0 ? (
                    <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Zero exceptions or warning events recorded for this batch job.</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {batch.errorLogs.map((log, idx) => (
                        <div key={idx} className="bg-rose-50/40 border border-rose-200 rounded-lg p-2.5 text-xs flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-rose-900 font-mono">{log.itemKey}</div>
                            <div className="text-rose-700">{log.error}</div>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0">{log.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
