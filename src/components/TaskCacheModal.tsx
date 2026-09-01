import React, { useState, useEffect } from 'react';
import {
  Database,
  Zap,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Cpu,
  Layers,
  ChevronRight,
  X,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRatio: number;
  totalTimeSavedMs: number;
  entriesByCategory: Record<string, number>;
  memoryUsageBytes: number;
  lastClearedAt: string | null;
}

export interface CacheEntry {
  key: string;
  category: string;
  inputDigest: string;
  data: any;
  cachedAt: string;
  expiresAt: string | null;
  hitCount: number;
  executionTimeSavedMs: number;
}

interface TaskCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaskCacheModal: React.FC<TaskCacheModalProps> = ({ isOpen, onClose }) => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<CacheEntry | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCacheData = async () => {
    setLoading(true);
    setActionError(null);
    try {
      const headers = {
        'Accept': 'application/json',
        ...(getAuthHeaders ? getAuthHeaders() : {}),
      };

      const [statsRes, entriesRes] = await Promise.all([
        fetch('/api/cache/stats', { headers }),
        fetch('/api/cache/entries?limit=100', { headers }),
      ]);

      if (statsRes.ok) {
        const text = await statsRes.text();
        try {
          const s = text ? JSON.parse(text) : null;
          if (s) setStats(s);
        } catch {
          // ignore non-json
        }
      }
      if (entriesRes.ok) {
        const text = await entriesRes.text();
        try {
          const e = text ? JSON.parse(text) : [];
          if (Array.isArray(e)) setEntries(e);
        } catch {
          // ignore non-json
        }
      }
    } catch (err: any) {
      console.warn('Failed to load cache data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCacheData();
    }
  }, [isOpen]);

  const handleClearCache = async (category?: string) => {
    setClearing(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(getAuthHeaders ? getAuthHeaders() : {}),
      };

      const res = await fetch('/api/cache/clear', {
        method: 'POST',
        headers,
        body: JSON.stringify({ category: category && category !== 'all' ? category : undefined }),
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (parseErr) {
        console.warn('Cache clear received non-JSON response:', text);
      }

      if (res.ok && data && data.success !== false) {
        const count = typeof data.clearedEntriesCount === 'number' ? data.clearedEntriesCount : 0;
        setActionSuccess(`Successfully purged ${count} cached entries!`);
        setTimeout(() => setActionSuccess(null), 3500);
        setSelectedEntry(null);
        await fetchCacheData();
      } else {
        const errMsg = data?.error || (res.statusText ? `Status ${res.status}: ${res.statusText}` : 'Could not purge cache');
        setActionError(errMsg);
        setTimeout(() => setActionError(null), 4000);
      }
    } catch (err: any) {
      console.warn('Failed to clear cache:', err?.message || err);
      setActionError(err?.message || 'Network error while purging cache');
      setTimeout(() => setActionError(null), 4000);
    } finally {
      setClearing(false);
    }
  };

  const handleDeleteEntry = async (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        ...(getAuthHeaders ? getAuthHeaders() : {}),
      };
      const res = await fetch(`/api/cache/entries/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((item) => item.key !== key));
        if (selectedEntry?.key === key) setSelectedEntry(null);
        fetchCacheData();
      }
    } catch (err) {
      console.warn('Failed to delete cache entry:', err);
    }
  };

  if (!isOpen) return null;

  const filteredEntries = entries.filter((item) => {
    if (activeCategory !== 'all' && item.category !== activeCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.key.toLowerCase().includes(q) ||
        item.inputDigest.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTimeSaved = (ms: number) => {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                Task Cache & Saved Answers
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono border border-cyan-500/20">
                  Memory Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Persistent caching for Gemini AI, County GIS searches, skip tracing, and heavy agent workloads
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchCacheData}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action notification */}
        {actionSuccess && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-2 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Overview Stat Cards */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950/40 border-b border-slate-800">
          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
            <div className="flex items-center text-xs text-slate-400 mb-1">
              <Database className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
              Cached Answers
            </div>
            <div className="text-xl font-bold font-mono text-slate-100">
              {stats?.totalEntries ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Memory: {formatBytes(stats?.memoryUsageBytes ?? 0)}
            </div>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
            <div className="flex items-center text-xs text-slate-400 mb-1">
              <Zap className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              Cache Hits
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {stats?.totalHits ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Hit Ratio: {((stats?.hitRatio ?? 0) * 100).toFixed(1)}%
            </div>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
            <div className="flex items-center text-xs text-slate-400 mb-1">
              <Clock className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
              Time Saved
            </div>
            <div className="text-xl font-bold font-mono text-amber-300">
              {formatTimeSaved(stats?.totalTimeSavedMs ?? 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Latency avoided
            </div>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800/60">
            <div className="flex items-center text-xs text-slate-400 mb-1">
              <Cpu className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
              API Requests Avoided
            </div>
            <div className="text-xl font-bold font-mono text-indigo-300">
              {stats?.totalHits ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Token & rate quota saved
            </div>
          </div>
        </div>

        {/* Controls: Search, Filter Tabs, Clear Button */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Categories */}
          <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'All Saved' },
              { id: 'gemini_text', label: 'Gemini AI' },
              { id: 'property_search', label: 'Property Searches' },
              { id: 'skip_trace', label: 'Skip Traces' },
              { id: 'tts_audio', label: 'Speech Synthesis' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  activeCategory === cat.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search bar & Clear button */}
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search cached answers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <button
              onClick={() => handleClearCache(activeCategory === 'all' ? undefined : activeCategory)}
              disabled={clearing || loading}
              className="px-3 py-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-xs font-medium transition flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Trash2 className={`w-3.5 h-3.5 ${clearing ? 'animate-spin' : ''}`} />
              <span>{clearing ? 'Purging...' : 'Purge Cache'}</span>
            </button>
          </div>
        </div>

        {/* Content Table / Main list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <Layers className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              No saved cached answers matching the current filter.
            </div>
          ) : (
            filteredEntries.map((item) => (
              <div
                key={item.key}
                onClick={() => setSelectedEntry(item)}
                className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                  selectedEntry?.key === item.key
                    ? 'bg-cyan-500/10 border-cyan-500/40'
                    : 'bg-slate-800/30 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start space-x-3 min-w-0 flex-1">
                  <div className="p-2 rounded-lg bg-slate-800 text-slate-300 mt-0.5">
                    {item.category.includes('gemini') ? (
                      <Sparkles className="w-4 h-4 text-purple-400" />
                    ) : item.category.includes('property') ? (
                      <Database className="w-4 h-4 text-cyan-400" />
                    ) : item.category.includes('skip') ? (
                      <HardDrive className="w-4 h-4 text-amber-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-300 uppercase tracking-wider">
                        {item.category}
                      </span>
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {item.inputDigest}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-[11px] text-slate-400 font-mono">
                      <span>Saved: {new Date(item.cachedAt).toLocaleTimeString()}</span>
                      <span className="text-emerald-400">{item.hitCount} hits</span>
                      <span className="text-amber-400 font-semibold">
                        +{formatTimeSaved(item.executionTimeSavedMs * Math.max(1, item.hitCount))} saved
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={(e) => handleDeleteEntry(item.key, e)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                    title="Delete Entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Entry Detail Drawer / Inspector */}
        {selectedEntry && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/90 text-xs font-mono space-y-2">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800/80 pb-2">
              <span className="font-semibold text-cyan-400">Cached Payload Details [{selectedEntry.key}]</span>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                Close Inspector
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto p-2 bg-slate-900 rounded-lg text-slate-300 border border-slate-800">
              <pre className="whitespace-pre-wrap break-all text-[11px]">
                {JSON.stringify(selectedEntry.data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
