import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  Building2,
  Users,
  Bot,
  ArrowRight,
  CornerDownLeft,
  X,
  Sparkles,
  Command,
  CheckCircle2,
  Tag,
  ShieldCheck,
  Zap,
  DollarSign,
  MapPin,
  Flame,
  ChevronRight,
} from 'lucide-react';
import { Property, LeadRecord, AgentDefinition } from '../types';

export type SearchCategory = 'all' | 'properties' | 'leads' | 'agents';

interface GlobalSearchProps {
  properties: Property[];
  leads: LeadRecord[];
  agents: AgentDefinition[];
  onSelectProperty?: (property: Property) => void;
  onSelectLead?: (lead: LeadRecord) => void;
  onSelectAgent?: (agent: AgentDefinition) => void;
  onNavigate?: (view: string) => void;
  className?: string;
}

interface SearchItem {
  id: string;
  type: 'property' | 'lead' | 'agent';
  title: string;
  subtitle: string;
  data: Property | LeadRecord | AgentDefinition;
  meta: {
    badge?: string;
    badgeColor?: string;
    detail1?: string;
    detail2?: string;
    extra?: string;
  };
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
  properties = [],
  leads = [],
  agents = [],
  onSelectProperty,
  onSelectLead,
  onSelectAgent,
  onNavigate,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K or '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      // '/' when not in input/textarea/editable
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
        return;
      }

      // Escape key to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered dataset calculations
  const searchResults = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    // Matching properties
    const matchedProps: SearchItem[] = (properties || [])
      .filter((p) => {
        if (!cleanQuery) return true;
        const addr = (p.address || '').toLowerCase();
        const city = (p.city || '').toLowerCase();
        const county = (p.county || '').toLowerCase();
        const zip = (p.zip || '').toLowerCase();
        const owner = (p.owner_name || '').toLowerCase();
        const apn = (p.apn || '').toLowerCase();
        const type = (p.property_type || '').toLowerCase();
        const tags = (p.tags || []).map((t) => t.toLowerCase()).join(' ');

        return (
          addr.includes(cleanQuery) ||
          city.includes(cleanQuery) ||
          county.includes(cleanQuery) ||
          zip.includes(cleanQuery) ||
          owner.includes(cleanQuery) ||
          apn.includes(cleanQuery) ||
          type.includes(cleanQuery) ||
          tags.includes(cleanQuery)
        );
      })
      .map((p) => ({
        id: `prop-${p.id}`,
        type: 'property',
        title: p.address || 'Cadastral Parcel',
        subtitle: `${p.city || 'Costa Mesa'}, ${p.state || 'CA'} ${p.zip || ''} • ${p.county || 'Orange County'}`,
        data: p,
        meta: {
          badge: p.property_type || 'Property',
          badgeColor: 'bg-cyan-50 text-cyan-800 border-cyan-200',
          detail1: p.owner_name ? `Owner: ${p.owner_name}` : 'Owner: Undisclosed',
          detail2: p.apn ? `APN: ${p.apn}` : undefined,
          extra: p.estimated_value
            ? `$${(p.estimated_value / 1000000).toFixed(2)}M Est. Value`
            : undefined,
        },
      }));

    // Matching leads
    const matchedLeads: SearchItem[] = (leads || [])
      .filter((l) => {
        if (!cleanQuery) return true;
        const owner = (l.owner_name || '').toLowerCase();
        const addr = (l.property_address || '').toLowerCase();
        const stage = (l.stage || '').toLowerCase();
        const classification = (l.classification || '').toLowerCase();
        const action = (l.next_recommended_action || '').toLowerCase();

        return (
          owner.includes(cleanQuery) ||
          addr.includes(cleanQuery) ||
          stage.includes(cleanQuery) ||
          classification.includes(cleanQuery) ||
          action.includes(cleanQuery)
        );
      })
      .map((l) => ({
        id: `lead-${l.id}`,
        type: 'lead',
        title: l.owner_name || 'Qualified Prospect',
        subtitle: l.property_address || 'Orange County Property',
        data: l,
        meta: {
          badge: `Score: ${l.lead_score || 85}/100`,
          badgeColor:
            (l.lead_score || 0) >= 90
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200',
          detail1: l.stage ? `Stage: ${l.stage.replace(/_/g, ' ')}` : 'Stage: Identified',
          detail2: l.classification ? l.classification.replace(/_/g, ' ') : undefined,
          extra: l.next_recommended_action ? `Action: ${l.next_recommended_action}` : undefined,
        },
      }));

    // Matching agents
    const matchedAgents: SearchItem[] = (agents || [])
      .filter((a) => {
        if (!cleanQuery) return true;
        const name = (a.name || '').toLowerCase();
        const role = (a.role || '').toLowerCase();
        const id = (a.id || '').toLowerCase();
        const desc = (a.description || '').toLowerCase();
        const resp = (a.primaryResponsibility || '').toLowerCase();
        const caps = (a.capabilities || []).map((c) => c.toLowerCase()).join(' ');

        return (
          name.includes(cleanQuery) ||
          role.includes(cleanQuery) ||
          id.includes(cleanQuery) ||
          desc.includes(cleanQuery) ||
          resp.includes(cleanQuery) ||
          caps.includes(cleanQuery)
        );
      })
      .map((a) => ({
        id: `agent-${a.id}`,
        type: 'agent',
        title: a.name || 'Sub-Agent Intelligence',
        subtitle: `Role: ${a.role.toUpperCase()} • Model: ${a.model || 'Gemini'}`,
        data: a,
        meta: {
          badge: a.role,
          badgeColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          detail1: a.primaryResponsibility || a.description,
          detail2: a.enabled ? 'Active Online' : 'Standby',
          extra: `ID: ${a.id}`,
        },
      }));

    return {
      properties: matchedProps,
      leads: matchedLeads,
      agents: matchedAgents,
      all: [...matchedProps, ...matchedLeads, ...matchedAgents],
    };
  }, [query, properties, leads, agents]);

  // Filtered active list for category selection
  const activeList: SearchItem[] = useMemo(() => {
    if (activeCategory === 'properties') return searchResults.properties;
    if (activeCategory === 'leads') return searchResults.leads;
    if (activeCategory === 'agents') return searchResults.agents;
    return searchResults.all;
  }, [activeCategory, searchResults]);

  // Reset selected index when query or category changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeCategory]);

  // Execute selection of an item
  const handleSelectItem = (item: SearchItem) => {
    setIsOpen(false);

    if (item.type === 'property') {
      const prop = item.data as Property;
      if (onSelectProperty) {
        onSelectProperty(prop);
      } else if (onNavigate) {
        onNavigate('properties');
      }
    } else if (item.type === 'lead') {
      const lead = item.data as LeadRecord;
      if (onSelectLead) {
        onSelectLead(lead);
      } else if (onNavigate) {
        onNavigate('leads');
      }
    } else if (item.type === 'agent') {
      const agent = item.data as AgentDefinition;
      if (onSelectAgent) {
        onSelectAgent(agent);
      } else if (onNavigate) {
        onNavigate('agents');
      }
    }
  };

  // Keyboard navigation within the dropdown
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < activeList.length - 1 ? prev + 1 : 0));
      // Scroll into view
      setTimeout(() => {
        const el = resultsContainerRef.current?.querySelector(`[data-index="${selectedIndex + 1}"]`);
        el?.scrollIntoView({ block: 'nearest' });
      }, 20);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : Math.max(0, activeList.length - 1)));
      // Scroll into view
      setTimeout(() => {
        const el = resultsContainerRef.current?.querySelector(`[data-index="${selectedIndex - 1}"]`);
        el?.scrollIntoView({ block: 'nearest' });
      }, 20);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeList.length > 0 && activeList[selectedIndex]) {
        handleSelectItem(activeList[selectedIndex]);
      }
    } else if (e.key === 'Tab') {
      // Cycle through categories
      e.preventDefault();
      const categories: SearchCategory[] = ['all', 'properties', 'leads', 'agents'];
      const currentIndex = categories.indexOf(activeCategory);
      const nextCategory = categories[(currentIndex + 1) % categories.length];
      setActiveCategory(nextCategory);
    }
  };

  const handleQuickPreset = (presetText: string, category: SearchCategory = 'all') => {
    setQuery(presetText);
    setActiveCategory(category);
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const counts = {
    all: searchResults.all.length,
    properties: searchResults.properties.length,
    leads: searchResults.leads.length,
    agents: searchResults.agents.length,
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Search Input Bar */}
      <div
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
        className={`flex items-center space-x-2.5 bg-slate-50 hover:bg-slate-100/90 border ${
          isOpen ? 'border-cyan-500 ring-2 ring-cyan-500/20 bg-white' : 'border-slate-200'
        } rounded-xl px-3 py-1.5 transition-all duration-150 cursor-text shadow-2xs w-64 md:w-80 lg:w-96`}
      >
        <Search className={`w-4 h-4 shrink-0 transition-colors ${isOpen ? 'text-cyan-600' : 'text-slate-400'}`} />
        <input
          ref={inputRef}
          id="global-header-search-input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search properties, leads, agents... (Ctrl+K)"
          className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 font-medium focus:outline-hidden"
        />

        {query ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQuery('');
              inputRef.current?.focus();
            }}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition"
            title="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="hidden sm:flex items-center space-x-1 shrink-0 px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-500 font-semibold shadow-2xs">
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </div>
        )}
      </div>

      {/* Floating Search Popover Results */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-[340px] sm:w-[480px] md:w-[580px] lg:w-[640px] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* Category Tabs */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center space-x-1">
              {(
                [
                  { id: 'all', label: 'All Results', count: counts.all },
                  { id: 'properties', label: 'Properties', count: counts.properties },
                  { id: 'leads', label: 'Leads', count: counts.leads },
                  { id: 'agents', label: 'Agents', count: counts.agents },
                ] as const
              ).map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                    activeCategory === cat.id
                      ? 'bg-cyan-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded-full ${
                      activeCategory === cat.id
                        ? 'bg-cyan-700/80 text-cyan-100'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            <span className="text-[10px] text-slate-400 font-medium hidden sm:inline-block">
              Tab to switch • ↑↓ to navigate
            </span>
          </div>

          {/* Results List */}
          <div
            ref={resultsContainerRef}
            className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-100"
          >
            {activeList.length > 0 ? (
              activeList.slice(0, 30).map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    data-index={idx}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`group px-3 py-2.5 rounded-xl cursor-pointer transition flex items-start justify-between space-x-3 ${
                      isSelected
                        ? 'bg-cyan-50/80 text-slate-900 ring-1 ring-cyan-200'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {/* Left Icon + Details */}
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      {/* Icon */}
                      <div className="mt-0.5 shrink-0">
                        {item.type === 'property' && (
                          <div className="w-8 h-8 rounded-lg bg-cyan-100/70 border border-cyan-200 flex items-center justify-center text-cyan-700">
                            <Building2 className="w-4 h-4" />
                          </div>
                        )}
                        {item.type === 'lead' && (
                          <div className="w-8 h-8 rounded-lg bg-amber-100/70 border border-amber-200 flex items-center justify-center text-amber-700">
                            <Users className="w-4 h-4" />
                          </div>
                        )}
                        {item.type === 'agent' && (
                          <div className="w-8 h-8 rounded-lg bg-indigo-100/70 border border-indigo-200 flex items-center justify-center text-indigo-700">
                            <Bot className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {item.title}
                          </span>
                          {item.meta.badge && (
                            <span
                              className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                item.meta.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {item.meta.badge}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                          {item.subtitle}
                        </p>

                        {/* Extra detail line */}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-slate-500">
                          {item.meta.detail1 && (
                            <span className="font-semibold text-slate-700 truncate max-w-[220px]">
                              {item.meta.detail1}
                            </span>
                          )}
                          {item.meta.detail2 && (
                            <span className="text-slate-400">
                              • {item.meta.detail2}
                            </span>
                          )}
                          {item.meta.extra && (
                            <span className="text-cyan-700 font-medium truncate">
                              • {item.meta.extra}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Jump Action Icon */}
                    <div className="shrink-0 pt-1 flex items-center space-x-1">
                      {isSelected && (
                        <span className="text-[10px] font-semibold text-cyan-700 flex items-center space-x-1">
                          <span>Open</span>
                          <CornerDownLeft className="w-3 h-3" />
                        </span>
                      )}
                      <ChevronRight
                        className={`w-4 h-4 transition ${
                          isSelected ? 'text-cyan-600 translate-x-0.5' : 'text-slate-300 group-hover:text-slate-400'
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              /* Empty State */
              <div className="py-8 text-center px-4">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">
                  No matches found for "{query}"
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  Try searching by street address, owner name, APN parcel number, lead status, or agent role.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Quick Search Shortcuts */}
          <div className="px-3 py-2.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Suggested:
              </span>
              <button
                type="button"
                onClick={() => handleQuickPreset('Newport', 'properties')}
                className="text-[11px] font-medium text-slate-600 hover:text-cyan-700 hover:bg-slate-200/70 px-2 py-0.5 rounded transition cursor-pointer"
              >
                1420 Newport Blvd
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('Sterling', 'leads')}
                className="text-[11px] font-medium text-slate-600 hover:text-cyan-700 hover:bg-slate-200/70 px-2 py-0.5 rounded transition cursor-pointer"
              >
                Jonathan Sterling
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('Outreach', 'agents')}
                className="text-[11px] font-medium text-slate-600 hover:text-cyan-700 hover:bg-slate-200/70 px-2 py-0.5 rounded transition cursor-pointer"
              >
                Outreach Agent
              </button>
              <button
                type="button"
                onClick={() => handleQuickPreset('QA', 'agents')}
                className="text-[11px] font-medium text-slate-600 hover:text-cyan-700 hover:bg-slate-200/70 px-2 py-0.5 rounded transition cursor-pointer"
              >
                QA Audit
              </button>
            </div>

            <div className="flex items-center space-x-2 text-[10px] text-slate-400">
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono shadow-2xs">
                ESC
              </kbd>
              <span>to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
