import React, { useState } from 'react';
import { Plus, Search, MessageSquare, Copy, Trash2, Tag } from 'lucide-react';
import { QuickSnippet } from '../types';

interface QuickSnippetsPanelProps {
  onInsert: (content: string) => void;
}

const DEFAULT_SNIPPETS: QuickSnippet[] = [
  {
    id: '1',
    title: 'Not Interested - Market Conditions',
    content: 'Lead is not interested in selling at this time due to current market interest rates. Suggested follow-up in 6 months.',
    category: 'objection'
  },
  {
    id: '2',
    title: 'Request Info - Pricing',
    content: 'Owner requested a detailed breakdown of the valuation and recent comparables in the neighborhood.',
    category: 'info'
  },
  {
    id: '3',
    title: 'Callback - Busy',
    content: 'Owner is currently in a meeting. Requested a callback later today after 5:00 PM.',
    category: 'other'
  },
  {
    id: '4',
    title: 'Wrong Number',
    content: 'Verified that this is no longer the correct contact number for the property owner. Marked for skip trace update.',
    category: 'objection'
  }
];

export const QuickSnippetsPanel: React.FC<QuickSnippetsPanelProps> = ({ onInsert }) => {
  const [snippets, setSnippets] = useState<QuickSnippet[]>(() => {
    const saved = localStorage.getItem('vortex_quick_snippets');
    return saved ? JSON.parse(saved) : DEFAULT_SNIPPETS;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');

  const filteredSnippets = snippets.filter(s => {
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const saveSnippets = (newSnippets: QuickSnippet[]) => {
    setSnippets(newSnippets);
    localStorage.setItem('vortex_quick_snippets', JSON.stringify(newSnippets));
  };

  const deleteSnippet = (id: string) => {
    saveSnippets(snippets.filter(s => s.id !== id));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-600" />
          Quick Snippets
        </h3>
        <button className="p-1 hover:bg-slate-200 rounded-md transition text-slate-600">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="p-2 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 border-transparent rounded-lg focus:bg-white focus:ring-2 focus:ring-cyan-500/20 transition outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-1 mt-2 overflow-x-auto pb-1 no-scrollbar">
          {['all', 'objection', 'info', 'closing', 'other'].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize whitespace-nowrap transition ${
                activeCategory === cat 
                  ? 'bg-cyan-600 text-white' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[300px]">
        {filteredSnippets.length > 0 ? (
          filteredSnippets.map(snippet => (
            <div 
              key={snippet.id}
              className="group p-2 rounded-lg border border-slate-100 hover:border-cyan-200 hover:bg-cyan-50/30 transition cursor-pointer relative"
              onClick={() => onInsert(snippet.content)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-bold text-slate-700 truncate pr-8">
                  {snippet.title}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                  snippet.category === 'objection' ? 'bg-rose-100 text-rose-600' :
                  snippet.category === 'info' ? 'bg-blue-100 text-blue-600' :
                  snippet.category === 'closing' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {snippet.category}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 line-clamp-2 italic leading-relaxed">
                "{snippet.content}"
              </p>
              
              <div className="absolute right-1 top-1 hidden group-hover:flex gap-1">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSnippet(snippet.id);
                  }}
                  className="p-1 hover:bg-rose-100 text-rose-400 hover:text-rose-600 rounded transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-8 text-center">
            <Tag className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-xs text-slate-400">No snippets found</p>
          </div>
        )}
      </div>

      <div className="p-2 bg-slate-50 border-t border-slate-100">
        <p className="text-[9px] text-slate-400 text-center uppercase tracking-wider font-bold">
          Click a snippet to insert it into notes
        </p>
      </div>
    </div>
  );
};
