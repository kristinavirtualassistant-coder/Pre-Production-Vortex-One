import React, { useState, useEffect } from 'react';
import { Search, Zap, X, Upload, UserPlus, Sparkles, PhoneCall, Building, Clock, History, Trash2, ArrowRight } from 'lucide-react';
import { DataImportModal } from './DataImportModal';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onOpenNewLead?: () => void;
  onRunResearchQueue?: () => void;
}

const RECENT_SEARCHES_STORAGE_KEY = 'vortex_recent_command_searches';

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenNewLead,
  onRunResearchQueue,
}) => {
  const [search, setSearch] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.slice(0, 5);
      }
    } catch (e) {
      console.error('Failed to load recent searches from localStorage', e);
    }
    return ['1244 Grand Ave', 'Orange County Parcels', 'John Miller Lead', 'Off-Market Multifamily', 'Skip Trace Queue'];
  });

  if (!isOpen) return null;

  const saveSearchQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5);
      try {
        localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save search history to localStorage', e);
      }
      return updated;
    });
  };

  const removeRecentSearch = (itemToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== itemToRemove);
      try {
        localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
  };

  const clearAllRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    } catch (err) {}
  };

  const handleSelectRecentSearch = (item: string) => {
    setSearch(item);
    saveSearchQuery(item);
    // If it looks like a view, navigate; otherwise search properties
    const lower = item.toLowerCase();
    if (views.includes(lower)) {
      onNavigate(lower);
      onClose();
    } else {
      onNavigate('property_search');
      onClose();
    }
  };

  const quickCommands = [
    {
      id: 'cmd-new-lead',
      label: 'New Lead / Owner Prospect',
      desc: 'Create an off-market owner prospect with skip-trace',
      icon: UserPlus,
      color: 'text-emerald-600 bg-emerald-50',
      action: () => {
        saveSearchQuery('New Lead');
        onClose();
        if (onOpenNewLead) onOpenNewLead();
        else onNavigate('leads');
      },
    },
    {
      id: 'cmd-research-queue',
      label: 'Run Research Queue',
      desc: 'Trigger autonomous sub-agent verification DAG',
      icon: Sparkles,
      color: 'text-indigo-600 bg-indigo-50',
      action: () => {
        saveSearchQuery('Research Queue');
        onClose();
        if (onRunResearchQueue) onRunResearchQueue();
        else onNavigate('research_queue');
      },
    },
    {
      id: 'cmd-dialer',
      label: 'Launch Outbound Dialer',
      desc: 'Start live calling session or view campaigns',
      icon: PhoneCall,
      color: 'text-blue-600 bg-blue-50',
      action: () => {
        saveSearchQuery('Outbound Dialer');
        onClose();
        onNavigate('dialer');
      },
    },
    {
      id: 'cmd-gis-search',
      label: 'GIS & Parcel Search',
      desc: 'County assessor map & zoning discovery',
      icon: Building,
      color: 'text-amber-600 bg-amber-50',
      action: () => {
        saveSearchQuery('GIS Search');
        onClose();
        onNavigate('property_search');
      },
    },
  ];

  const views = [
    'home',
    'dashboard',
    'property_search',
    'properties',
    'owners',
    'portfolios',
    'opportunities',
    'leads',
    'dialer',
    'campaigns',
    'tasks',
    'research_queue',
    'studio',
    'agents',
    'workflows',
    'approvals',
    'audit',
    'analytics',
    'reports',
    'settings',
    'database',
  ];

  const filteredCommands = quickCommands.filter(
    (c) =>
      c.label.toLowerCase().includes(search.toLowerCase()) ||
      c.desc.toLowerCase().includes(search.toLowerCase())
  );

  const filteredViews = views.filter((v) => v.toLowerCase().includes(search.toLowerCase()));

  const filteredRecentSearches = recentSearches.filter((item) =>
    item.toLowerCase().includes(search.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      saveSearchQuery(search.trim());
      const matchView = views.find((v) => v.toLowerCase() === search.trim().toLowerCase());
      if (matchView) {
        onNavigate(matchView);
      } else {
        onNavigate('property_search');
      }
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-fadeIn" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center p-4 border-b border-slate-200 bg-slate-50/50">
            <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
            <input
              autoFocus
              className="flex-1 outline-none text-slate-900 placeholder:text-slate-400 text-sm font-medium bg-transparent"
              placeholder="Type a command, query, or view name (press Enter to search)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
            {/* Recent Searches Section (Saved to localStorage, max 5 items) */}
            {filteredRecentSearches.length > 0 && (
              <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                <div className="flex items-center justify-between px-2 py-1 mb-1">
                  <div className="flex items-center space-x-1.5">
                    <History className="w-3.5 h-3.5 text-cyan-600" />
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recent Searches</p>
                    <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-mono font-medium">
                      {filteredRecentSearches.length} / 5 saved
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearAllRecentSearches}
                    className="text-[10px] font-semibold text-slate-400 hover:text-rose-600 transition flex items-center space-x-1 cursor-pointer"
                    title="Clear search history"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear all</span>
                  </button>
                </div>
                <div className="space-y-1">
                  {filteredRecentSearches.slice(0, 5).map((item) => (
                    <div
                      key={item}
                      onClick={() => handleSelectRecentSearch(item)}
                      className="group w-full text-left px-2.5 py-2 hover:bg-white rounded-lg flex items-center justify-between transition cursor-pointer text-xs font-semibold text-slate-800 border border-transparent hover:border-slate-200 shadow-2xs"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Clock className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-600 shrink-0" />
                        <span className="truncate group-hover:text-cyan-700">{item}</span>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-0.5">
                          <span>Search</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(item, e)}
                          className="p-1 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
                          title="Remove item"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Action Commands */}
            {filteredCommands.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">Quick Actions</p>
                <div className="space-y-1">
                  {filteredCommands.map((cmd) => {
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        type="button"
                        onClick={cmd.action}
                        className="w-full text-left p-2.5 hover:bg-slate-100/80 rounded-xl flex items-center justify-between transition cursor-pointer group"
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-lg ${cmd.color} flex items-center justify-center shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">{cmd.label}</p>
                            <p className="text-[11px] text-slate-500">{cmd.desc}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 opacity-0 group-hover:opacity-100 transition-opacity">
                          Run
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Navigation Views */}
            {filteredViews.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">Navigate Views</p>
                <div className="grid grid-cols-2 gap-1">
                  {filteredViews.map((view) => (
                    <button
                      key={view}
                      type="button"
                      onClick={() => {
                        saveSearchQuery(view);
                        onNavigate(view);
                        onClose();
                      }}
                      className="w-full text-left p-2.5 hover:bg-slate-100 rounded-xl capitalize flex items-center space-x-2 text-xs font-semibold text-slate-700 hover:text-slate-900 transition cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      <span className="truncate">{view.replace(/_/g, ' ')}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsImportOpen(true)}
                className="w-full text-left p-2.5 hover:bg-blue-50 rounded-xl text-blue-700 flex items-center space-x-3 text-xs font-semibold transition cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold">Import Data</p>
                  <p className="text-[11px] text-blue-600/80 font-normal">Bulk upload CSV/Excel leads, contacts &amp; properties</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
      <DataImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onSuccess={() => onClose()} />
    </>
  );
};

